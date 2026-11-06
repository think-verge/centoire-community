"""
Feed Service API Endpoints (Ticket #106 / Flow 5).

Endpoints:
- GET  /v1/feed/for-you/{user_id}         — Get personalized For You feed page (cached 15 min, 20/page)
- POST /v1/feed/for-you/{user_id}/rebuild — Invalidate cache and rebuild feed on pull-to-refresh
- POST /v1/feed/impressions               — Log impressions from client/gateway
- GET  /v1/feed/impressions/{user_id}     — Query impression logs for audit/validation
- GET  /v1/feed/parameters               — Inspect current tunable feed parameters
"""

import logging
import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.feed_parameters import DEFAULT_FEED_PARAMS, FeedParameters
from app.services.feed_service import (
    CandidatePost,
    build_for_you_feed,
    feed_cache,
    impression_tracker,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/feed", tags=["feed"])

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:8000")
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "dev-internal-secret")
_INTERNAL_HEADERS = {"X-Internal-Secret": AI_INTERNAL_SECRET}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class FeedItemSchema(BaseModel):
    id: str
    title: str = ""
    authorId: str = ""
    clusterId: Optional[int] = None
    circleId: Optional[str] = None
    sources: List[str] = Field(default_factory=list)
    score: float = 0.0
    scoreBreakdown: Dict[str, float] = Field(default_factory=dict)


class FeedResponseSchema(BaseModel):
    items: List[FeedItemSchema]
    cursor: Optional[str] = None
    hasMore: bool = False
    cached: bool = False
    totalBuilt: int = 0


class ImpressionInput(BaseModel):
    userId: str
    postId: str
    position: int
    source: str
    score: float


class ImpressionBatchRequest(BaseModel):
    impressions: List[ImpressionInput]


# ---------------------------------------------------------------------------
# Backend Integration Helpers
# ---------------------------------------------------------------------------

async def fetch_social_graph(user_id: str) -> Dict[str, Any]:
    """Fetch user's social graph from core backend (Ticket #113 endpoint)."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{NODE_BACKEND_URL}/api/v1/internal/recsys/social-graph/{user_id}",
                headers=_INTERNAL_HEADERS,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as exc:
        logger.warning("[feed_api] failed to fetch social graph for %s: %s", user_id, exc)

    return {
        "userId": user_id,
        "followedUserIds": [],
        "membershipCircleIds": [],
        "dismissedPostIds": [],
        "blockedUserIds": [],
        "mutedUserIds": [],
        "allExcludedAuthorIds": [],
    }


async def fetch_user_topic_mix(user_id: str) -> Dict[int, float]:
    """Fetch user's current topic mix from topic-mix endpoint."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{NODE_BACKEND_URL}/api/v1/internal/users/{user_id}/topic-mix",
                headers=_INTERNAL_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                mix = data.get("mix", {})
                return {int(k): float(v) for k, v in mix.items()}
    except Exception as exc:
        logger.warning("[feed_api] failed to fetch topic mix for %s: %s", user_id, exc)

    return {}


async def fetch_posts_from_backend() -> List[CandidatePost]:
    """Fetch recent candidate pool from core backend sync/search endpoint."""
    posts: List[CandidatePost] = []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{NODE_BACKEND_URL}/api/v1/internal/sync/posts?limit=250",
                headers=_INTERNAL_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                for it in items:
                    posts.append(
                        CandidatePost(
                            id=str(it.get("id")),
                            title=it.get("title", ""),
                            author_id=it.get("authorId", ""),
                            cluster_id=it.get("clusterId"),
                            circle_id=it.get("circleId"),
                            circle_is_private=bool(it.get("circlePrivate", False)),
                            curated=bool(it.get("curated", False)),
                            status=it.get("status", "published"),
                        )
                    )
    except Exception as exc:
        logger.warning("[feed_api] failed to fetch sync posts: %s", exc)

    return posts


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@router.get("/for-you/{user_id}", response_model=FeedResponseSchema)
async def get_for_you_feed(
    user_id: str,
    cursor: Optional[str] = None,
    limit: int = 20,
    rebuild: bool = False,
) -> FeedResponseSchema:
    """
    Build and serve the personalized 'For You' feed:
    - Checks 15-minute cache; rebuilds on pull-to-refresh.
    - Assembles ~200 candidates across topic mix, following, circles, curated, exploration.
    - Excludes seen, hidden, blocked/muted authors, and non-member private circles.
    - Scores via 3.0*interest + 2.0*freshness + 2.0*follows + 1.5*in_circle.
    - Arranges top 20 with variety and exploration slots.
    """
    cursor_str = str(cursor) if cursor is not None and not hasattr(cursor, "default") else None
    offset = int(cursor_str) if cursor_str and cursor_str.isdigit() else 0
    rebuild_bool = bool(rebuild) if not hasattr(rebuild, "default") else False
    limit_int = int(limit) if not hasattr(limit, "default") else 20

    # 1. Check cache fast path
    if not rebuild_bool:
        cached = feed_cache.get(user_id)
        if cached is not None:
            slice_items = cached[offset : offset + limit]
            next_cursor = str(offset + limit) if (offset + limit) < len(cached) else None
            return FeedResponseSchema(
                items=[
                    FeedItemSchema(
                        id=p.id,
                        title=p.title,
                        authorId=p.author_id,
                        clusterId=p.cluster_id,
                        circleId=p.circle_id,
                        sources=list(p.sources),
                        score=p.score,
                        scoreBreakdown=p.score_breakdown,
                    )
                    for p in slice_items
                ],
                cursor=next_cursor,
                hasMore=next_cursor is not None,
                cached=True,
                totalBuilt=len(cached),
            )

    # 2. Parallel data fetching
    social_graph = await fetch_social_graph(user_id)
    topic_mix = await fetch_user_topic_mix(user_id)
    posts = await fetch_posts_from_backend()

    followed_author_ids = set(social_graph.get("followedUserIds", []))
    member_circle_ids = set(social_graph.get("membershipCircleIds", []))
    blocked_or_muted_authors = set(social_graph.get("allExcludedAuthorIds", []))
    seen_post_ids = set(social_graph.get("dismissedPostIds", []))

    result = build_for_you_feed(
        user_id=user_id,
        all_posts=posts,
        user_topic_shares=topic_mix,
        followed_author_ids=followed_author_ids,
        member_circle_ids=member_circle_ids,
        blocked_or_muted_authors=blocked_or_muted_authors,
        seen_post_ids=seen_post_ids,
        hidden_post_embeddings=[],
        rebuild=rebuild,
        page_size=limit,
        offset=offset,
    )

    items_out = [
        FeedItemSchema(
            id=p.id,
            title=p.title,
            authorId=p.author_id,
            clusterId=p.cluster_id,
            circleId=p.circle_id,
            sources=list(p.sources),
            score=p.score,
            scoreBreakdown=p.score_breakdown,
        )
        for p in result["items"]
    ]

    return FeedResponseSchema(
        items=items_out,
        cursor=result["cursor"],
        hasMore=result["hasMore"],
        cached=result["cached"],
        totalBuilt=result["totalBuilt"],
    )


@router.post("/for-you/{user_id}/rebuild", response_model=FeedResponseSchema)
async def rebuild_for_you_feed(user_id: str) -> FeedResponseSchema:
    """Invalidate 15-minute cache and force-rebuild feed (Pull-to-refresh)."""
    feed_cache.invalidate(user_id)
    return await get_for_you_feed(user_id=user_id, rebuild=True)


@router.post("/impressions")
async def record_impressions(batch: ImpressionBatchRequest) -> Dict[str, Any]:
    """Ingest impression events for behavioral ranking and logging."""
    for imp in batch.impressions:
        impression_tracker.log_impression(
            user_id=imp.userId,
            post_id=imp.postId,
            position=imp.position,
            source=imp.source,
            score=imp.score,
        )
    return {"status": "ok", "recorded": len(batch.impressions)}


@router.get("/impressions/{user_id}")
async def get_impressions(user_id: str) -> Dict[str, Any]:
    """Query recent impression logs for audit and evaluation."""
    logs = impression_tracker.get_user_impressions(user_id)
    return {
        "userId": user_id,
        "count": len(logs),
        "impressions": [
            {
                "postId": l.post_id,
                "position": l.position,
                "source": l.source,
                "score": l.score,
                "timestamp": l.timestamp.isoformat(),
            }
            for l in logs
        ],
    }


@router.get("/parameters")
async def get_parameters() -> Dict[str, Any]:
    """Inspect current tunable feed parameters."""
    return DEFAULT_FEED_PARAMS.__dict__
