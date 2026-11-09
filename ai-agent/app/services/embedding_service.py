from dotenv import load_dotenv
load_dotenv()

"""
Embedding service using Google's text-embedding-004 model.
Provides text preparation, embedding generation, L2-normalization,
and nearest-cluster lookup.
"""
import logging
import os
import time
from typing import Optional

import numpy as np
from langchain_google_genai import GoogleGenerativeAIEmbeddings

logger = logging.getLogger(__name__)

_EMBED_MODEL = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")
_MODEL_NAME = _EMBED_MODEL.replace("models/", "")
_MODEL_VERSION = "1"
_EMBED_DIM = int(os.getenv("EMBEDDING_DIM", "768"))

__all__ = [
    "embed_text",
    "find_nearest_cluster",
    "prepare_embed_text",
    "get_embeddings_client",
]


def get_embeddings_client() -> GoogleGenerativeAIEmbeddings:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    kwargs = {"model": _EMBED_MODEL}
    if api_key:
        kwargs["google_api_key"] = api_key
    if _EMBED_DIM:
        kwargs["output_dimensionality"] = _EMBED_DIM
    return GoogleGenerativeAIEmbeddings(**kwargs)


def prepare_embed_text(post: dict) -> str:
    """
    Build a single input string from post fields for embedding.

    For aggregated (external) posts: title + excerpt + ai_summary only.
    For native posts: also includes content_text (up to 400 chars).
    Always appends hashtags, circle_name, and author_handle when present.
    """
    parts: list[str] = []

    # Title is always included
    title = (post.get("title") or "").strip()
    if title:
        parts.append(title)

    # Excerpt always included, trimmed to 300 chars
    excerpt = (post.get("excerpt") or "").strip()[:300]
    if excerpt:
        parts.append(excerpt)

    # AI summary if present, trimmed to 200 chars
    ai_summary = (post.get("ai_summary") or "").strip()[:200]
    if ai_summary:
        parts.append(ai_summary)

    # For native posts also include content_text (trimmed to 400 chars)
    origin = (post.get("origin") or "native").strip()
    if origin != "aggregated":
        content_text = (post.get("content_text") or "").strip()[:400]
        if content_text:
            parts.append(content_text)

    # Hashtags prefixed with '#', joined with spaces
    hashtags = post.get("hashtags") or []
    if hashtags:
        tagged = " ".join(f"#{tag}" for tag in hashtags)
        parts.append(tagged)

    # Circle name if present
    circle_name = (post.get("circle_name") or "").strip()
    if circle_name:
        parts.append(circle_name)

    # Author handle if present
    author_handle = (post.get("author_handle") or "").strip()
    if author_handle:
        parts.append(author_handle)

    return " | ".join(parts).strip()


def embed_text(text: str) -> tuple[list[float], str, str]:
    """
    Embed a string using Google text-embedding-004.

    Returns (vector, model_name, model_version).
    The returned vector is L2-normalized to unit length.
    Retries up to 3 times with exponential backoff on failure.
    """
    last_exc: Optional[Exception] = None
    delays = [1, 2, 4]
    client = get_embeddings_client()

    for attempt, delay in enumerate(delays, start=1):
        try:
            vector: list[float] = client.embed_query(text)

            # L2-normalize
            arr = np.array(vector, dtype=np.float64)
            norm = np.linalg.norm(arr)
            if norm > 0:
                arr = arr / norm
            normalized: list[float] = arr.tolist()

            return normalized, _MODEL_NAME, _MODEL_VERSION

        except Exception as exc:
            last_exc = exc
            logger.error(
                "[embed] attempt %d/%d failed: %s",
                attempt,
                len(delays),
                exc,
            )
            if attempt < len(delays):
                time.sleep(delay)

    raise RuntimeError(
        f"[embed] all {len(delays)} embedding attempts failed"
    ) from last_exc


def find_nearest_cluster(
    embedding: list[float],
    clusters: list[dict],
) -> Optional[int]:
    """
    Return the cluster_id whose centre has the highest dot product
    (cosine similarity for L2-normalized vectors) with the embedding.

    Returns None if clusters is empty.
    """
    if not clusters:
        return None

    emb = np.array(embedding, dtype=np.float64)
    best_id: Optional[int] = None
    best_score = float("-inf")

    for cluster in clusters:
        centre = np.array(cluster["centre"], dtype=np.float64)
        score = float(np.dot(emb, centre))
        if score > best_score:
            best_score = score
            best_id = int(cluster["cluster_id"])

    return best_id
