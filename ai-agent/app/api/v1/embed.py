"""
Embedding API endpoints.

POST /v1/embed-post        — async (BackgroundTasks), returns immediately
POST /v1/embed-post/sync   — synchronous, returns full result (used by backfill / tests)
GET  /v1/embed-post/validate — model validation: similarity matrix + storage report
"""
import logging
import os

import httpx
import numpy as np
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from app.services.embedding_service import (
    embed_text,
    find_nearest_cluster,
    prepare_embed_text,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1")

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:8000")
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "dev-internal-secret")

_INTERNAL_HEADERS = {"X-Internal-Secret": AI_INTERNAL_SECRET}


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class EmbedPostRequest(BaseModel):
    postId: str
    title: str
    excerpt: str
    aiSummary: str | None = None
    hashtags: list[str] | None = None
    circleName: str | None = None
    authorHandle: str | None = None
    origin: str  # "native" | "aggregated"
    contentText: str | None = None


class EmbedPostAsyncResult(BaseModel):
    postId: str
    status: str  # "queued"


class EmbedPostSyncResult(BaseModel):
    postId: str
    embedding: list[float]
    clusterId: int | None
    modelName: str
    modelVersion: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _request_to_post_dict(request: EmbedPostRequest) -> dict:
    return {
        "title": request.title,
        "excerpt": request.excerpt,
        "ai_summary": request.aiSummary,
        "hashtags": request.hashtags or [],
        "circle_name": request.circleName,
        "author_handle": request.authorHandle,
        "origin": request.origin,
        "content_text": request.contentText,
    }


async def _fetch_clusters() -> list[dict]:
    """Fetch current cluster centres from the backend."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NODE_BACKEND_URL}/api/v1/internal/clusters",
                headers=_INTERNAL_HEADERS,
            )
            resp.raise_for_status()
            return resp.json()  # [{cluster_id, centre, version}, ...]
    except Exception as exc:
        logger.warning("[embed] failed to fetch clusters: %s", exc)
        return []


async def _patch_embedding_completed(
    post_id: str,
    embedding: list[float],
    cluster_id: int | None,
    model_name: str,
    model_version: str,
) -> None:
    payload: dict = {
        "embeddingStatus": "completed",
        "embedding": embedding,
        "clusterId": cluster_id,
        "modelName": model_name,
        "modelVersion": model_version,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.patch(
                f"{NODE_BACKEND_URL}/api/v1/internal/posts/{post_id}/embedding",
                json=payload,
                headers=_INTERNAL_HEADERS,
            )
    except Exception as exc:
        logger.error("[embed] callback patch failed for %s: %s", post_id, exc)


async def _patch_embedding_failed(post_id: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.patch(
                f"{NODE_BACKEND_URL}/api/v1/internal/posts/{post_id}/embedding",
                json={"embeddingStatus": "failed"},
                headers=_INTERNAL_HEADERS,
            )
    except Exception as exc:
        logger.error(
            "[embed] failed-status patch failed for %s: %s", post_id, exc
        )


async def _run_embedding(request: EmbedPostRequest) -> EmbedPostSyncResult:
    """Core embedding logic shared by sync and async paths."""
    post_dict = _request_to_post_dict(request)
    text = prepare_embed_text(post_dict)
    vector, model_name, model_version = embed_text(text)
    clusters = await _fetch_clusters()
    cluster_id = find_nearest_cluster(vector, clusters)
    return EmbedPostSyncResult(
        postId=request.postId,
        embedding=vector,
        clusterId=cluster_id,
        modelName=model_name,
        modelVersion=model_version,
    )


async def _background_embed(request: EmbedPostRequest) -> None:
    """Background task: embed and PATCH result back to backend."""
    try:
        result = await _run_embedding(request)
        await _patch_embedding_completed(
            post_id=result.postId,
            embedding=result.embedding,
            cluster_id=result.clusterId,
            model_name=result.modelName,
            model_version=result.modelVersion,
        )
    except Exception as exc:
        logger.error("[embed] background embed failed for %s: %s", request.postId, exc)
        await _patch_embedding_failed(request.postId)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/embed-post", response_model=EmbedPostAsyncResult)
async def embed_post_async(
    request: EmbedPostRequest,
    background_tasks: BackgroundTasks,
) -> EmbedPostAsyncResult:
    """
    Async embed: returns immediately with status='queued'.
    Embedding runs as a background task and PATCHes the result back to the backend.
    """
    background_tasks.add_task(_background_embed, request)
    return EmbedPostAsyncResult(postId=request.postId, status="queued")


@router.post("/embed-post/sync", response_model=EmbedPostSyncResult)
async def embed_post_sync(request: EmbedPostRequest) -> EmbedPostSyncResult:
    """
    Synchronous embed: waits for the result and returns it.
    Used by the backfill script and integration tests.
    Also PATCHes the result back to the backend.
    """
    try:
        result = await _run_embedding(request)
        await _patch_embedding_completed(
            post_id=result.postId,
            embedding=result.embedding,
            cluster_id=result.clusterId,
            model_name=result.modelName,
            model_version=result.modelVersion,
        )
        return result
    except Exception as exc:
        logger.error("[embed] sync embed failed for %s: %s", request.postId, exc)
        await _patch_embedding_failed(request.postId)
        raise


@router.get("/embed-post/validate")
async def validate_embed_model() -> dict:
    """
    Model validation endpoint.
    Embeds 5 fashion-topic sentences, computes the pairwise cosine similarity
    matrix (dot product of L2-normalized vectors), and returns a storage report.
    """
    sentences = [
        "Sustainable fashion trends redefine modern wardrobes with eco-friendly fabrics",
        "Street style photography captures urban fashion subcultures worldwide",
        "Luxury couture houses unveil fall collections at Paris Fashion Week",
        "Thrift shopping and vintage resale markets are reshaping fast fashion",
        "Inclusive sizing and body-positive campaigns challenge traditional fashion standards",
    ]

    vectors: list[list[float]] = []
    for sentence in sentences:
        vec, _, _ = embed_text(sentence)
        vectors.append(vec)

    n = len(vectors)
    dim = len(vectors[0]) if vectors else 0

    # Pairwise cosine similarity matrix (dot product of L2-normalized vectors)
    matrix: list[list[float]] = []
    off_diagonal: list[float] = []
    for i in range(n):
        row: list[float] = []
        for j in range(n):
            score = float(
                sum(a * b for a, b in zip(vectors[i], vectors[j]))
            )
            row.append(round(score, 6))
            if i != j:
                off_diagonal.append(score)
        matrix.append(row)

    min_sim = round(min(off_diagonal), 6) if off_diagonal else 0.0
    max_sim = round(max(off_diagonal), 6) if off_diagonal else 0.0
    mean_sim = round(sum(off_diagonal) / len(off_diagonal), 6) if off_diagonal else 0.0

    # Storage report: float32 per dimension
    bytes_per_vector = dim * 4  # float32
    storage_1m = bytes_per_vector * 1_000_000

    return {
        "sentences": sentences,
        "similarity_matrix": matrix,
        "stats": {
            "min_similarity": min_sim,
            "max_similarity": max_sim,
            "mean_similarity": mean_sim,
        },
        "vector_dim": dim,
        "storage_report": {
            "bytes_per_vector_float32": bytes_per_vector,
            "storage_1m_vectors_mb": round(storage_1m / (1024 * 1024), 2),
            "storage_10m_vectors_gb": round(storage_1m * 10 / (1024 ** 3), 2),
        },
    }
