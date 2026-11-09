"""
Reclustering orchestrator service.

Executes the weekly / periodic reclustering job and initial bootstrap:
1. Fetches current cluster version & centres.
2. Fetches all post embeddings.
3. Fits new K-means clusters.
4. Matches new clusters to old via Hungarian assignment to persist cluster IDs.
5. Computes transition matrix M for proportional mix remapping.
6. Stages clusters for next version.
7. Executes versioned atomic cutover:
   - Updates posts' cluster assignments with new version.
   - Activates new version in system metadata.
   - Feeds never see mixed versions.
"""
import logging
import os
from typing import Any, Optional

import httpx
import numpy as np

from app.services.clustering_service import (
    assign_to_nearest_cluster,
    compute_transition_matrix,
    fit_clusters,
    get_cluster_config,
    match_clusters_to_old,
    remap_mix,
)

logger = logging.getLogger(__name__)

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:8000")
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "dev-internal-secret")
_INTERNAL_HEADERS = {"X-Internal-Secret": AI_INTERNAL_SECRET}


async def fetch_cluster_metadata() -> dict[str, Any]:
    """Fetch active version and total clusters from backend."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NODE_BACKEND_URL}/api/v1/internal/clusters/metadata",
                headers=_INTERNAL_HEADERS,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("[recluster] failed to fetch metadata: %s", exc)
        return {"activeVersion": 1, "totalClusters": 0}


async def fetch_current_clusters(version: Optional[int] = None) -> list[dict[str, Any]]:
    """Fetch existing cluster documents for a given version or active version."""
    url = f"{NODE_BACKEND_URL}/api/v1/internal/clusters"
    params = {}
    if version is not None:
        params["version"] = str(version)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url,
                params=params,
                headers=_INTERNAL_HEADERS,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("[recluster] failed to fetch clusters: %s", exc)
        return []


async def fetch_all_post_embeddings(batch_size: int = 1000) -> list[dict[str, Any]]:
    """Fetch all posts that have completed embeddings from backend."""
    all_posts: list[dict[str, Any]] = []
    offset = 0

    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            url = (
                f"{NODE_BACKEND_URL}/api/v1/internal/posts/with-embedding"
                f"?limit={batch_size}&offset={offset}"
            )
            try:
                resp = await client.get(url, headers=_INTERNAL_HEADERS)
                resp.raise_for_status()
                batch = resp.json()
            except Exception as exc:
                logger.error("[recluster] failed to fetch posts offset=%d: %s", offset, exc)
                break

            if not batch:
                break

            all_posts.extend(batch)
            if len(batch) < batch_size:
                break
            offset += batch_size

    return all_posts


async def stage_clusters_to_backend(
    version: int,
    clusters: list[dict[str, Any]],
) -> dict[str, Any]:
    """Save new clusters to backend under staged version."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{NODE_BACKEND_URL}/api/v1/internal/clusters/bulk",
            json={"version": version, "clusters": clusters},
            headers=_INTERNAL_HEADERS,
        )
        resp.raise_for_status()
        return resp.json()


async def execute_cutover_on_backend(
    new_version: int,
    post_assignments: list[dict[str, Any]],
) -> dict[str, Any]:
    """Atomically activate new version and update post assignments."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{NODE_BACKEND_URL}/api/v1/internal/clusters/cutover",
            json={
                "newVersion": new_version,
                "postAssignments": post_assignments,
            },
            headers=_INTERNAL_HEADERS,
        )
        resp.raise_for_status()
        return resp.json()


def execute_clustering(
    post_data: list[dict[str, Any]],
    old_clusters: list[dict[str, Any]],
    current_version: int,
    n_clusters: Optional[int] = None,
    random_state: int = 42,
) -> dict[str, Any]:
    """
    Pure in-memory execution of the clustering & remapping algorithms.
    Separated from I/O for direct deterministic testing.
    """
    k = n_clusters or get_cluster_config()
    n_posts = len(post_data)

    if n_posts < k:
        raise ValueError(
            f"Insufficient posts ({n_posts}) to cluster into {k} topics. "
            f"Need at least {k} posts."
        )

    embeddings = np.array([p["embedding"] for p in post_data], dtype=np.float64)
    next_version = current_version + 1 if old_clusters else 1

    # 1. Fit K-Means
    raw_centres, raw_labels = fit_clusters(
        embeddings,
        n_clusters=k,
        n_init=10,
        random_state=random_state,
    )

    # 2. Stable ID matching against old clusters if they exist
    matched_mapping: dict[int, int] = {}
    transition_matrix: Optional[np.ndarray] = None

    if old_clusters:
        old_centres = np.array([c["centre"] for c in old_clusters], dtype=np.float64)
        centres, labels, matched_mapping = match_clusters_to_old(
            old_centres=old_centres,
            new_centres=raw_centres,
            new_labels=raw_labels,
        )

        # Build old labels for transition matrix calculation
        # If post had previous clusterId, use it; otherwise assign to nearest old cluster
        old_labels = []
        for p in post_data:
            if "clusterId" in p and p["clusterId"] is not None:
                old_labels.append(int(p["clusterId"]))
            else:
                cid, _ = assign_to_nearest_cluster(p["embedding"], old_centres)
                old_labels.append(cid)

        old_labels_arr = np.array(old_labels, dtype=int)
        transition_matrix = compute_transition_matrix(
            old_labels=old_labels_arr,
            new_labels=labels,
            n_clusters=k,
        )
    else:
        centres = raw_centres
        labels = raw_labels

    # 3. Compute post counts per cluster
    counts = np.bincount(labels, minlength=k)

    # 4. Prepare cluster documents
    cluster_docs = []
    for cid in range(k):
        cluster_docs.append({
            "clusterId": cid,
            "centre": centres[cid].tolist(),
            "postCount": int(counts[cid]),
            "version": next_version,
        })

    # 5. Prepare post assignment list
    post_assignments = []
    for idx, p in enumerate(post_data):
        post_assignments.append({
            "postId": str(p["_id"]),
            "clusterId": int(labels[idx]),
        })

    return {
        "version": next_version,
        "n_clusters": k,
        "n_posts": n_posts,
        "centres": centres,
        "labels": labels,
        "cluster_docs": cluster_docs,
        "post_assignments": post_assignments,
        "transition_matrix": transition_matrix,
        "id_mapping": matched_mapping,
    }


async def run_recluster_job(
    dry_run: bool = False,
    n_clusters: Optional[int] = None,
) -> dict[str, Any]:
    """
    Run full end-to-end reclustering job:
    1. Fetch current version & centres.
    2. Fetch all post embeddings.
    3. Run clustering & stable matching.
    4. If not dry_run: stage clusters -> execute cutover.
    """
    meta = await fetch_cluster_metadata()
    current_version = meta.get("activeVersion", 1)

    old_clusters = await fetch_current_clusters(version=current_version)
    posts = await fetch_all_post_embeddings()

    if not posts:
        return {
            "status": "skipped",
            "reason": "No posts with embeddings found to cluster",
            "posts_count": 0,
        }

    k = n_clusters or get_cluster_config()
    if len(posts) < k:
        return {
            "status": "skipped",
            "reason": f"Only {len(posts)} posts available, requires at least {k}",
            "posts_count": len(posts),
        }

    plan = execute_clustering(
        post_data=posts,
        old_clusters=old_clusters,
        current_version=current_version,
        n_clusters=k,
    )

    if dry_run:
        return {
            "status": "dry_run",
            "target_version": plan["version"],
            "clusters_count": plan["n_clusters"],
            "posts_count": plan["n_posts"],
            "sample_assignments": plan["post_assignments"][:5],
            "has_transition_matrix": plan["transition_matrix"] is not None,
        }

    # Execute cutover on backend
    # Step A: Stage clusters under target version
    await stage_clusters_to_backend(
        version=plan["version"],
        clusters=plan["cluster_docs"],
    )

    # Step B: Atomic cutover
    cutover_res = await execute_cutover_on_backend(
        new_version=plan["version"],
        post_assignments=plan["post_assignments"],
    )

    return {
        "status": "completed",
        "active_version": plan["version"],
        "clusters_count": plan["n_clusters"],
        "posts_updated": cutover_res.get("updatedPostsCount", len(posts)),
        "has_transition_matrix": plan["transition_matrix"] is not None,
    }

