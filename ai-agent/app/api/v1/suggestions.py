"""
Suggestions API Endpoints (Ticket #107 / Flow 6).

Endpoints:
- GET  /v1/suggestions/circles/{user_id}   — Personalized circle recommendations with reason lines
- GET  /v1/suggestions/creators/{user_id}  — Personalized creator recommendations with variety and reasons
- POST /v1/suggestions/feedback           — Ingest join/follow, dismiss (30d), and ignore (14d after 3x)
- GET  /v1/suggestions/parameters         — Inspect current suggestion scoring parameters
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.suggestion_parameters import (
    DEFAULT_SUGGESTION_PARAMS,
    SuggestionParameters,
)
from app.services.suggestion_service import (
    CircleCandidate,
    CreatorCandidate,
    feedback_store,
    generate_circle_suggestions,
    generate_creator_suggestions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/suggestions", tags=["suggestions"])

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:8000")
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "dev-internal-secret")
_INTERNAL_HEADERS = {"X-Internal-Secret": AI_INTERNAL_SECRET}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CircleSuggestionSchema(BaseModel):
    id: str
    name: str
    description: str = ""
    clusterId: Optional[int] = None
    isPrivate: bool = False
    memberCount: int = 0
    score: float = 0.0
    reason: str = ""
    scoreBreakdown: Dict[str, float] = Field(default_factory=dict)


class CreatorSuggestionSchema(BaseModel):
    id: str
    handle: str
    name: str = ""
    bio: str = ""
    clusterId: Optional[int] = None
    followerCount: int = 0
    isEmerging: bool = False
    score: float = 0.0
    reason: str = ""
    scoreBreakdown: Dict[str, float] = Field(default_factory=dict)


class SuggestionsFeedbackRequest(BaseModel):
    userId: str
    targetId: str
    targetType: str = Field(..., description="'circle' or 'creator'")
    action: str = Field(..., description="'join', 'follow', 'dismiss', or 'ignore'")
    targetTopClusters: List[int] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Core Backend Fetch Helpers (Resilient)
# ---------------------------------------------------------------------------

async def fetch_user_social_context(user_id: str) -> Dict[str, Any]:
    """Fetch user's followed creators, circle memberships, and exclusions."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{NODE_BACKEND_URL}/api/v1/internal/users/{user_id}/social-graph",
                headers=_INTERNAL_HEADERS,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as exc:
        logger.warning("[suggestions_api] failed to fetch social graph for %s: %s", user_id, exc)

    return {
        "userId": user_id,
        "followedUserIds": [],
        "membershipCircleIds": [],
        "allExcludedAuthorIds": [],
    }


async def fetch_user_topic_mix(user_id: str) -> Dict[int, float]:
    """Fetch user's topic mix shares."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{NODE_BACKEND_URL}/api/v1/internal/users/{user_id}/topic-mix",
                headers=_INTERNAL_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                mix = data.get("mix", {})
                res: Dict[Any, float] = {}
                for k, v in mix.items():
                    try:
                        res[int(k)] = float(v)
                    except (ValueError, TypeError):
                        res[str(k)] = float(v)
                return res
    except Exception as exc:
        logger.warning("[suggestions_api] failed to fetch topic mix for %s: %s", user_id, exc)

    return {}


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@router.get("/circles/{user_id}", response_model=List[CircleSuggestionSchema])
async def get_circle_suggestions(
    user_id: str,
    limit: int = Query(10, ge=1, le=50),
) -> List[CircleSuggestionSchema]:
    """
    Get personalized Circle suggestions with reason lines.
    - Excludes already joined circles, blocked circles, and dismissed circles.
    - Ranks via: 3 * match + 2 * friends + 1.5 * activity + 1 * engagement.
    - Enforces cluster variety (max 2 consecutive).
    """
    now = datetime.now(timezone.utc)
    social_context = await fetch_user_social_context(user_id)
    user_mix = await fetch_user_topic_mix(user_id)

    member_circle_ids = set(social_context.get("membershipCircleIds", []))
    blocked_ids = set(social_context.get("allExcludedAuthorIds", []))

    # In production, query candidates from core sync or DB.
    # Here we gracefully handle empty or populated candidates.
    candidates: List[CircleCandidate] = []

    results = generate_circle_suggestions(
        user_id=user_id,
        user_topic_mix=user_mix,
        all_circles=candidates,
        member_circle_ids=member_circle_ids,
        blocked_or_muted_ids=blocked_ids,
        now=now,
        limit=limit,
    )

    return [
        CircleSuggestionSchema(
            id=c.id,
            name=c.name,
            description=c.description,
            clusterId=c.cluster_id,
            isPrivate=c.is_private,
            memberCount=c.member_count,
            score=c.score,
            reason=c.reason,
            scoreBreakdown=c.score_breakdown,
        )
        for c in results
    ]


@router.get("/creators/{user_id}", response_model=List[CreatorSuggestionSchema])
async def get_creator_suggestions(
    user_id: str,
    limit: int = Query(10, ge=1, le=50),
) -> List[CreatorSuggestionSchema]:
    """
    Get personalized Creator suggestions with reason lines.
    - Excludes followed creators, self, and blocked creators.
    - Ranks via: 3 * match + 3 * engaged + 2 * friends + 1 * active + 1 * engagement.
    - Enforces diversity: 1 in 4 emerging creators, max 2 consecutive from same cluster.
    """
    now = datetime.now(timezone.utc)
    social_context = await fetch_user_social_context(user_id)
    user_mix = await fetch_user_topic_mix(user_id)

    followed_ids = set(social_context.get("followedUserIds", []))
    blocked_ids = set(social_context.get("allExcludedAuthorIds", []))

    candidates: List[CreatorCandidate] = []

    results = generate_creator_suggestions(
        user_id=user_id,
        user_topic_mix=user_mix,
        all_creators=candidates,
        followed_ids=followed_ids,
        blocked_or_muted_ids=blocked_ids,
        now=now,
        limit=limit,
    )

    return [
        CreatorSuggestionSchema(
            id=cr.id,
            handle=cr.handle,
            name=cr.name,
            bio=cr.bio,
            clusterId=cr.cluster_id,
            followerCount=cr.follower_count,
            isEmerging=cr.is_emerging,
            score=cr.score,
            reason=cr.reason,
            scoreBreakdown=cr.score_breakdown,
        )
        for cr in results
    ]


@router.post("/feedback")
def record_suggestion_feedback(request: SuggestionsFeedbackRequest) -> Dict[str, Any]:
    """
    Record user feedback on suggestions:
    - join / follow: awards +3 points to target's top clusters.
    - dismiss: hides suggestion for 30 days.
    - ignore: 3 ignores hides suggestion for 14 days.
    """
    now = datetime.now(timezone.utc)
    action = request.action.lower()

    if action in ("join", "follow"):
        points_awarded = feedback_store.record_follow_or_join(
            user_id=request.userId,
            target_top_clusters=request.targetTopClusters,
        )
        return {
            "status": "ok",
            "action": action,
            "topicPointsDelta": points_awarded,
        }
    elif action == "dismiss":
        hidden_until = feedback_store.record_dismiss(
            user_id=request.userId,
            target_id=request.targetId,
            now=now,
        )
        return {
            "status": "ok",
            "action": "dismiss",
            "hiddenUntil": hidden_until.isoformat(),
        }
    elif action == "ignore":
        count, hidden_until = feedback_store.record_ignore(
            user_id=request.userId,
            target_id=request.targetId,
            now=now,
        )
        return {
            "status": "ok",
            "action": "ignore",
            "ignoreCount": count,
            "hiddenUntil": hidden_until.isoformat() if hidden_until else None,
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported feedback action: {request.action}")


@router.get("/parameters")
def get_parameters() -> Dict[str, Any]:
    """Return the current suggestion engine parameters."""
    return {
        "CIRCLE_WEIGHT_MATCH": DEFAULT_SUGGESTION_PARAMS.CIRCLE_WEIGHT_MATCH,
        "CIRCLE_WEIGHT_FRIENDS": DEFAULT_SUGGESTION_PARAMS.CIRCLE_WEIGHT_FRIENDS,
        "CIRCLE_WEIGHT_ACTIVITY": DEFAULT_SUGGESTION_PARAMS.CIRCLE_WEIGHT_ACTIVITY,
        "CIRCLE_WEIGHT_ENGAGEMENT": DEFAULT_SUGGESTION_PARAMS.CIRCLE_WEIGHT_ENGAGEMENT,
        "CREATOR_WEIGHT_MATCH": DEFAULT_SUGGESTION_PARAMS.CREATOR_WEIGHT_MATCH,
        "CREATOR_WEIGHT_ENGAGED": DEFAULT_SUGGESTION_PARAMS.CREATOR_WEIGHT_ENGAGED,
        "CREATOR_WEIGHT_FRIENDS": DEFAULT_SUGGESTION_PARAMS.CREATOR_WEIGHT_FRIENDS,
        "CREATOR_WEIGHT_ACTIVE": DEFAULT_SUGGESTION_PARAMS.CREATOR_WEIGHT_ACTIVE,
        "CREATOR_WEIGHT_ENGAGEMENT": DEFAULT_SUGGESTION_PARAMS.CREATOR_WEIGHT_ENGAGEMENT,
        "DISMISS_HIDE_DAYS": DEFAULT_SUGGESTION_PARAMS.DISMISS_HIDE_DAYS,
        "IGNORE_HIDE_DAYS": DEFAULT_SUGGESTION_PARAMS.IGNORE_HIDE_DAYS,
        "EMERGING_CREATOR_INTERVAL": DEFAULT_SUGGESTION_PARAMS.EMERGING_CREATOR_INTERVAL,
        "MAX_CONSECUTIVE_CLUSTER": DEFAULT_SUGGESTION_PARAMS.MAX_CONSECUTIVE_CLUSTER,
    }

