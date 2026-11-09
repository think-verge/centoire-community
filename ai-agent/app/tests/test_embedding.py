"""
Unit tests for embedding_service.py

All tests mock google.generativeai so no live API calls are made.
Run with: python -m pytest app/tests/test_embedding.py -v
"""
import math
import sys
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


def _make_unit_vector(n: int = 768, seed: int = 42) -> list[float]:
    """Return a reproducible L2-normalised random vector of length n."""
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(n)
    v = v / np.linalg.norm(v)
    return v.tolist()


def _mock_genai_embed(vector: list[float]):
    """Patch google.generativeai.embed_content to return a fixed vector."""
    mock = MagicMock()
    mock.return_value = {"embedding": vector}
    return mock


# ---------------------------------------------------------------------------
# prepare_embed_text tests
# ---------------------------------------------------------------------------


def test_prepare_embed_text_native():
    """Native posts include content_text in the embed string."""
    from app.services.embedding_service import prepare_embed_text

    post = {
        "title": "My Article",
        "excerpt": "Short excerpt",
        "ai_summary": None,
        "hashtags": [],
        "circle_name": None,
        "author_handle": None,
        "origin": "native",
        "content_text": "This is the full body of the article.",
    }
    result = prepare_embed_text(post)
    assert "My Article" in result
    assert "Short excerpt" in result
    assert "full body" in result  # content_text included for native


def test_prepare_embed_text_aggregated():
    """Aggregated posts must NOT include content_text."""
    from app.services.embedding_service import prepare_embed_text

    post = {
        "title": "External Article",
        "excerpt": "Aggregated excerpt here",
        "ai_summary": "AI generated summary",
        "hashtags": [],
        "circle_name": None,
        "author_handle": None,
        "origin": "aggregated",
        "content_text": "SHOULD_NOT_APPEAR",
    }
    result = prepare_embed_text(post)
    assert "External Article" in result
    assert "Aggregated excerpt here" in result
    assert "AI generated summary" in result
    assert "SHOULD_NOT_APPEAR" not in result


def test_prepare_embed_text_hashtags():
    """Hashtags must be prefixed with '#' and joined with spaces."""
    from app.services.embedding_service import prepare_embed_text

    post = {
        "title": "Fashion Post",
        "excerpt": "Some excerpt",
        "ai_summary": None,
        "hashtags": ["fashion", "style", "ootd"],
        "circle_name": None,
        "author_handle": None,
        "origin": "native",
        "content_text": None,
    }
    result = prepare_embed_text(post)
    assert "#fashion" in result
    assert "#style" in result
    assert "#ootd" in result


# ---------------------------------------------------------------------------
# embed_text / L2-normalisation tests
# ---------------------------------------------------------------------------


def test_l2_normalisation():
    """The returned vector must have unit L2 norm (within floating-point tolerance)."""
    # Use a raw (non-unit) vector; the service must normalize it.
    raw = [3.0, 4.0]  # norm = 5.0 → after normalization: [0.6, 0.8]

    mock_client = MagicMock()
    mock_client.embed_query.return_value = raw

    with patch("app.services.embedding_service.get_embeddings_client", return_value=mock_client):
        import app.services.embedding_service as svc
        vector, model_name, model_version = svc.embed_text("test text")

    norm = math.sqrt(sum(x ** 2 for x in vector))
    assert abs(norm - 1.0) < 1e-6, f"Expected unit vector, got norm={norm}"
    assert model_name in ["gemini-embedding-001", "text-embedding-004"]
    assert model_version == "1"


# ---------------------------------------------------------------------------
# find_nearest_cluster tests
# ---------------------------------------------------------------------------


def test_find_nearest_cluster():
    """Returns the cluster_id with the highest dot product."""
    from app.services.embedding_service import find_nearest_cluster

    # Embedding points toward cluster 2
    embedding = [1.0, 0.0, 0.0]
    clusters = [
        {"cluster_id": 1, "centre": [0.0, 1.0, 0.0]},  # dot = 0.0
        {"cluster_id": 2, "centre": [1.0, 0.0, 0.0]},  # dot = 1.0  ← best
        {"cluster_id": 3, "centre": [0.0, 0.0, 1.0]},  # dot = 0.0
    ]
    result = find_nearest_cluster(embedding, clusters)
    assert result == 2


def test_find_nearest_cluster_empty():
    """Returns None for an empty cluster list."""
    from app.services.embedding_service import find_nearest_cluster

    result = find_nearest_cluster([1.0, 0.0, 0.0], [])
    assert result is None
