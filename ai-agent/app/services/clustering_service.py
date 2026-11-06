"""
Topic clustering service.

Implements:
1. K-means clustering on post embeddings (configurable 30-50 clusters, default 40).
2. Fast nearest-cluster assignment at publish time (40 dot products, no model call).
3. Cluster ID stability matching across reclustering runs (Hungarian algorithm / linear sum assignment).
4. Transition matrix computation and proportional mix remapping (strict point conservation).
"""
import logging
import os
from typing import Any, Optional, Union

import numpy as np
from scipy.optimize import linear_sum_assignment
from sklearn.cluster import KMeans

logger = logging.getLogger(__name__)

DEFAULT_N_CLUSTERS = 40
MIN_CLUSTERS = 30
MAX_CLUSTERS = 50


def get_cluster_config() -> int:
    """
    Read TOPIC_N_CLUSTERS from environment.
    Must be between 30 and 50 inclusive; defaults to 40.
    """
    env_val = os.getenv("TOPIC_N_CLUSTERS")
    if not env_val:
        return DEFAULT_N_CLUSTERS
    try:
        val = int(env_val)
    except ValueError as exc:
        raise ValueError(
            f"Invalid TOPIC_N_CLUSTERS='{env_val}'. Must be an integer."
        ) from exc

    if not (MIN_CLUSTERS <= val <= MAX_CLUSTERS):
        raise ValueError(
            f"TOPIC_N_CLUSTERS must be between {MIN_CLUSTERS} and {MAX_CLUSTERS}, got {val}"
        )
    return val


def normalize_centres(centres: np.ndarray) -> np.ndarray:
    """
    L2-normalize each cluster centre to unit length so that
    cosine similarity is strictly the dot product.
    """
    norms = np.linalg.norm(centres, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return centres / norms


def fit_clusters(
    embeddings: np.ndarray,
    n_clusters: Optional[int] = None,
    n_init: int = 10,
    random_state: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Fit K-means on post embeddings.

    Args:
        embeddings: (N, D) numpy array of unit-normalized embeddings.
        n_clusters: Number of clusters (30-50). If None, reads from config.
        n_init: Number of initializations (default 10 as per ticket).
        random_state: Seed for reproducibility.

    Returns:
        (centres, labels):
            centres: (K, D) array of L2-normalized cluster centres.
            labels: (N,) array of cluster assignments for each post.
    """
    if n_clusters is None:
        n_clusters = get_cluster_config()
    else:
        if not (MIN_CLUSTERS <= n_clusters <= MAX_CLUSTERS):
            raise ValueError(
                f"n_clusters must be between {MIN_CLUSTERS} and {MAX_CLUSTERS}, got {n_clusters}"
            )

    n_samples = len(embeddings)
    if n_samples < n_clusters:
        raise ValueError(
            f"Not enough embeddings ({n_samples}) to form {n_clusters} clusters. "
            f"Need at least {n_clusters} samples."
        )

    # Ensure float64 for numerical precision
    arr = np.asarray(embeddings, dtype=np.float64)

    kmeans = KMeans(
        n_clusters=n_clusters,
        n_init=n_init,
        random_state=random_state,
    )
    kmeans.fit(arr)

    # L2-normalize cluster centres
    centres = normalize_centres(kmeans.cluster_centers_)

    # Re-assign labels using dot product against unit-normalized centres
    scores = np.dot(arr, centres.T)  # (N, K)
    labels = np.argmax(scores, axis=1)

    return centres, labels


def match_clusters_to_old(
    old_centres: np.ndarray,
    new_centres: np.ndarray,
    new_labels: Optional[np.ndarray] = None,
) -> tuple[np.ndarray, Optional[np.ndarray], dict[int, int]]:
    """
    Match new clusters to old clusters by centre distance so that cluster IDs persist.

    Uses the Hungarian algorithm (scipy.optimize.linear_sum_assignment) on the
    cosine distance cost matrix D_ij = 1 - (c_old_i . c_new_j).

    Args:
        old_centres: (K_old, D) array of old cluster centres.
        new_centres: (K_new, D) array of newly fitted cluster centres.
        new_labels: Optional (N,) array of cluster labels assigned to posts.

    Returns:
        (reordered_centres, reordered_labels, raw_to_stable_id):
            reordered_centres: (K_new, D) array where row i matches old cluster i.
            reordered_labels: (N,) updated post labels with preserved IDs (or None).
            raw_to_stable_id: mapping from raw new cluster index -> stable cluster ID.
    """
    old_arr = np.asarray(old_centres, dtype=np.float64)
    new_arr = np.asarray(new_centres, dtype=np.float64)

    k_old = len(old_arr)
    k_new = len(new_arr)

    # Cost matrix: cosine distance in [0, 2]
    # D_ij = 1 - dot(old_i, new_j)
    dot_products = np.dot(old_arr, new_arr.T)  # (K_old, K_new)
    cost_matrix = 1.0 - dot_products

    row_ind, col_ind = linear_sum_assignment(cost_matrix)

    # col_ind[m] is the raw new cluster matching old cluster row_ind[m]
    raw_to_stable_id: dict[int, int] = {}
    assigned_stable_ids: set[int] = set()

    for old_id, raw_idx in zip(row_ind, col_ind):
        raw_to_stable_id[int(raw_idx)] = int(old_id)
        assigned_stable_ids.add(int(old_id))

    # If new_centres has more clusters than old_centres, assign new stable IDs
    next_id = 0
    for raw_idx in range(k_new):
        if raw_idx not in raw_to_stable_id:
            while next_id in assigned_stable_ids:
                next_id += 1
            raw_to_stable_id[raw_idx] = next_id
            assigned_stable_ids.add(next_id)

    # Reorder new centres so index == stable ID
    total_k = max(max(raw_to_stable_id.values()) + 1, k_new)
    dim = new_arr.shape[1]
    reordered_centres = np.zeros((total_k, dim), dtype=np.float64)

    for raw_idx, stable_id in raw_to_stable_id.items():
        reordered_centres[stable_id] = new_arr[raw_idx]

    # Re-index post labels
    reordered_labels: Optional[np.ndarray] = None
    if new_labels is not None:
        reordered_labels = np.array(
            [raw_to_stable_id[int(lbl)] for lbl in new_labels],
            dtype=int,
        )

    return reordered_centres, reordered_labels, raw_to_stable_id


def compute_transition_matrix(
    old_labels: np.ndarray,
    new_labels: np.ndarray,
    n_clusters: int,
) -> np.ndarray:
    """
    Compute transition matrix M where M[i, j] = P(new=j | old=i).

    Represents the proportion of posts in old cluster i that moved to new cluster j.
    If a cluster splits, points are shared according to how many of its posts
    went to each part.

    Rows sum to 1.0 (stochastic matrix).
    """
    M = np.zeros((n_clusters, n_clusters), dtype=np.float64)

    old_lbls = np.asarray(old_labels, dtype=int)
    new_lbls = np.asarray(new_labels, dtype=int)

    for i in range(n_clusters):
        mask = old_lbls == i
        total_in_old = int(np.sum(mask))

        if total_in_old == 0:
            # Empty old cluster: identity transition
            M[i, i] = 1.0
        else:
            # Count posts moving to each new cluster j
            for j in range(n_clusters):
                count_i_to_j = int(np.sum(mask & (new_lbls == j)))
                M[i, j] = count_i_to_j / total_in_old

    # Invariant assertion: rows sum to 1.0
    row_sums = np.sum(M, axis=1)
    assert np.allclose(row_sums, 1.0, atol=1e-5), f"Row sums not 1.0: {row_sums}"

    return M


def remap_mix(
    mix: Union[dict[Union[int, str], float], np.ndarray, list[float]],
    transition_matrix: np.ndarray,
) -> Union[dict[int, float], np.ndarray]:
    """
    Remap a user_mix, circle_mix, or creator_mix using the transition matrix:
        v_new = v_old * M

    Guarantees strict point conservation: sum(v_new) == sum(v_old).
    """
    k = transition_matrix.shape[0]

    is_dict = isinstance(mix, dict)
    if is_dict:
        vec = np.zeros(k, dtype=np.float64)
        for cid, val in mix.items():
            cid_int = int(cid)
            if 0 <= cid_int < k:
                vec[cid_int] = float(val)
    else:
        vec = np.asarray(mix, dtype=np.float64)
        if len(vec) < k:
            padded = np.zeros(k, dtype=np.float64)
            padded[: len(vec)] = vec
            vec = padded
        elif len(vec) > k:
            vec = vec[:k]

    # Remap points via matrix multiplication: v_new = v_old * M
    new_vec = np.dot(vec, transition_matrix)

    # Invariant: point conservation check
    old_sum = float(np.sum(vec))
    new_sum = float(np.sum(new_vec))
    assert abs(new_sum - old_sum) < 1e-5, f"Points lost: old={old_sum}, new={new_sum}"

    if is_dict:
        # Return sparse dictionary of positive clusters
        result: dict[int, float] = {}
        for idx in range(k):
            val = float(new_vec[idx])
            if val > 1e-6:
                result[idx] = round(val, 4)
        return result

    return new_vec


def assign_to_nearest_cluster(
    embedding: Union[list[float], np.ndarray],
    centres: Union[np.ndarray, list[dict[str, Any]]],
) -> tuple[int, float]:
    """
    Online cluster assignment at publish time.

    Computes 40 dot products against L2-normalized cluster centres.
    No model call, execution time < 0.1 ms.

    Returns:
        (nearest_cluster_id, similarity_score)
    """
    emb = np.asarray(embedding, dtype=np.float64)
    # Ensure unit length
    norm = np.linalg.norm(emb)
    if norm > 0:
        emb = emb / norm

    if isinstance(centres, list):
        if not centres:
            raise ValueError("No cluster centres available for assignment")
        best_id = -1
        best_score = float("-inf")
        for c in centres:
            c_vec = np.asarray(c["centre"], dtype=np.float64)
            score = float(np.dot(emb, c_vec))
            if score > best_score:
                best_score = score
                best_id = int(c.get("cluster_id", c.get("clusterId", 0)))
        return best_id, best_score

    # Matrix multiplication: scores = centres * emb (shape: K)
    centres_arr = np.asarray(centres, dtype=np.float64)
    scores = np.dot(centres_arr, emb)
    best_id = int(np.argmax(scores))
    best_score = float(scores[best_id])
    return best_id, best_score

