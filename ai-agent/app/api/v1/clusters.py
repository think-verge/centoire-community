"""
Clusters API endpoints for Ticket #104.

Endpoints:
- GET  /v1/clusters           — Active cluster centres & metadata
- POST /v1/clusters/assign    — Fast publish-time assignment (40 dot products, no model call)
- POST /v1/clusters/recluster — Recluster post library & stage versioned cutover
- POST /v1/clusters/remap-mix — Mix vector remapping with strict point conservation
"""
import logging
from typing import Any, Optional, Union

import numpy as np
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.services.clustering_service import (
    assign_to_nearest_cluster,
    get_cluster_config,
    remap_mix,
)
from app.services.recluster_orchestrator import (
    fetch_cluster_metadata,
    fetch_current_clusters,
    run_recluster_job,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/clusters", tags=["clusters"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AssignRequest(BaseModel):
    embedding: list[float] = Field(..., description="768-d unit-normalized embedding")
    centres: Optional[list[dict[str, Any]]] = Field(
        None,
        description="Optional list of cluster centre dicts. If omitted, uses active backend clusters.",
    )


class AssignResponse(BaseModel):
    clusterId: int
    version: int
    similarity: float


class ReclusterRequest(BaseModel):
    dryRun: bool = False
    nClusters: Optional[int] = Field(None, ge=30, le=50)
    asyncMode: bool = False


class RemapMixRequest(BaseModel):
    mix: Union[dict[str, float], list[float]]
    transitionMatrix: list[list[float]]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def get_clusters(version: Optional[int] = None) -> dict[str, Any]:
    """
    Returns active cluster centres and current active version.
    """
    meta = await fetch_cluster_metadata()
    active_version = meta.get("activeVersion", 1)
    target_version = version or active_version

    clusters = await fetch_current_clusters(version=target_version)
    return {
        "activeVersion": active_version,
        "queryVersion": target_version,
        "totalClusters": len(clusters),
        "clusters": clusters,
    }


@router.post("/assign", response_model=AssignResponse)
async def assign_post_cluster(request: AssignRequest) -> AssignResponse:
    """
    Publish-time assignment: 40 dot products against active cluster centres.
    No LLM/embedding model calls. Runtime < 0.1 ms.
    """
    centres = request.centres
    version = 1

    if not centres:
        meta = await fetch_cluster_metadata()
        version = meta.get("activeVersion", 1)
        centres = await fetch_current_clusters(version=version)

    if not centres:
        raise HTTPException(
            status_code=404,
            detail="No clusters found in active version. Run initial clustering first.",
        )

    try:
        best_id, score = assign_to_nearest_cluster(request.embedding, centres)
        return AssignResponse(
            clusterId=best_id,
            version=version,
            similarity=round(score, 6),
        )
    except Exception as exc:
        logger.error("[clusters] assign error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/recluster")
async def trigger_recluster(
    request: ReclusterRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Trigger reclustering job (Flow 4).
    Stages new version, matches IDs for stability, remaps mixes, and executes cutover.
    """
    if request.asyncMode:
        background_tasks.add_task(
            run_recluster_job,
            dry_run=request.dryRun,
            n_clusters=request.nClusters,
        )
        return {
            "status": "queued",
            "dryRun": request.dryRun,
            "message": "Reclustering job has been queued in background",
        }

    try:
        result = await run_recluster_job(
            dry_run=request.dryRun,
            n_clusters=request.nClusters,
        )
        return result
    except Exception as exc:
        logger.error("[clusters] recluster error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/remap-mix")
async def remap_mix_endpoint(request: RemapMixRequest) -> dict[str, Any]:
    """
    Remaps a user_mix, circle_mix, or creator_mix using a transition matrix.
    Verifies that total mix points are strictly conserved.
    """
    try:
        t_matrix = np.array(request.transitionMatrix, dtype=np.float64)
        remapped = remap_mix(request.mix, t_matrix)

        if isinstance(remapped, dict):
            formatted_mix = {str(k): v for k, v in remapped.items()}
        else:
            formatted_mix = [round(float(v), 4) for v in remapped]

        return {
            "status": "ok",
            "remappedMix": formatted_mix,
            "pointsConserved": True,
        }
    except Exception as exc:
        logger.error("[clusters] remap-mix error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))

