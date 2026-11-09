"""
User Topic-Mix API Endpoints (Ticket #105).

Endpoints:
- GET  /v1/topic-mix/{user_id}            — Retrieve current user topic mix profile
- POST /v1/topic-mix/{user_id}/events     — Process behavioral event batch (read, like, save, hide, etc.)
- POST /v1/topic-mix/{user_id}/onboarding — Seed topic mix from chosen onboarding domains (10 pts each)
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.topic_mix_service import (
    apply_lazy_decay,
    normalize_mix,
    process_user_event_batch,
    seed_onboarding_mix,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/topic-mix", tags=["topic-mix"])

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:8000")
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "dev-internal-secret")
_INTERNAL_HEADERS = {"X-Internal-Secret": AI_INTERNAL_SECRET}


def _safe_mix_key(k: Any) -> Any:
    try:
        return int(k)
    except (ValueError, TypeError):
        return str(k)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class BehavioralEvent(BaseModel):
    action: str = Field(..., description="Action name: read, like, follow_author, save, comment, share, hide, report")
    clusterId: Optional[int] = Field(None, description="Topic cluster ID the post belongs to")
    postId: Optional[str] = Field(None, description="Post ID for negative list tracking")
    dwellSeconds: Optional[float] = Field(None, description="Dwell time in seconds (read >= 10s)")


class EventBatchRequest(BaseModel):
    events: list[BehavioralEvent] = Field(..., description="Batch of behavioral actions")


class OnboardingSeedRequest(BaseModel):
    domainClusterIds: list[int] = Field(..., min_length=1, description="List of cluster IDs chosen during onboarding")


class TopicMixResponse(BaseModel):
    userId: str
    mix: dict[str, float]
    rawPoints: dict[str, float]
    activeDays: int
    lastActiveDate: str
    hiddenPostIds: list[str]
    clusterVersion: int


# ---------------------------------------------------------------------------
# Backend Storage Helpers
# ---------------------------------------------------------------------------


async def fetch_user_mix_from_backend(user_id: str) -> dict[str, Any]:
    """Fetch user's current topic-mix record from backend."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NODE_BACKEND_URL}/api/v1/internal/users/{user_id}/topic-mix",
                headers=_INTERNAL_HEADERS,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("[topic_mix] failed to fetch mix for %s: %s", user_id, exc)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return {
            "userId": user_id,
            "mix": {},
            "rawPoints": {},
            "dailyEarned": {},
            "activeDays": 1,
            "lastActiveDate": today,
            "hiddenPostIds": [],
            "clusterVersion": 1,
        }


async def save_user_mix_to_backend(user_id: str, payload: dict[str, Any]) -> None:
    """Save user's updated topic-mix record to backend."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.put(
                f"{NODE_BACKEND_URL}/api/v1/internal/users/{user_id}/topic-mix",
                json=payload,
                headers=_INTERNAL_HEADERS,
            )
            resp.raise_for_status()
    except Exception as exc:
        logger.error("[topic_mix] failed to save mix for %s: %s", user_id, exc)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/{user_id}", response_model=TopicMixResponse)
async def get_user_topic_mix(user_id: str) -> TopicMixResponse:
    """
    Get the user's current normalized topic mix profile.
    Applies lazy decay if a new active day has started.
    """
    doc = await fetch_user_mix_from_backend(user_id)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_active = doc.get("lastActiveDate", today)
    active_days = int(doc.get("activeDays", 1))

    raw_points = {_safe_mix_key(k): float(v) for k, v in doc.get("rawPoints", {}).items()}
    daily_earned = {_safe_mix_key(k): float(v) for k, v in doc.get("dailyEarned", {}).items()}

    # Check if a new active day started
    if last_active != today:
        active_days += 1
        # 1 active day elapsed -> apply lazy decay
        for cid in list(raw_points.keys()):
            raw_points[cid] = apply_lazy_decay(raw_points[cid], active_days_elapsed=1)
        daily_earned = {}
        last_active = today

        # Re-normalize
        new_mix = normalize_mix(raw_points)
        update_payload = {
            "mix": {str(k): v for k, v in new_mix.items()},
            "rawPoints": {str(k): v for k, v in raw_points.items()},
            "dailyEarned": {},
            "activeDays": active_days,
            "lastActiveDate": today,
            "hiddenPostIds": doc.get("hiddenPostIds", []),
            "clusterVersion": doc.get("clusterVersion", 1),
        }
        await save_user_mix_to_backend(user_id, update_payload)
        doc.update(update_payload)

    return TopicMixResponse(
        userId=user_id,
        mix={str(k): float(v) for k, v in doc.get("mix", {}).items()},
        rawPoints={str(k): float(v) for k, v in raw_points.items()},
        activeDays=active_days,
        lastActiveDate=last_active,
        hiddenPostIds=doc.get("hiddenPostIds", []),
        clusterVersion=int(doc.get("clusterVersion", 1)),
    )


@router.post("/{user_id}/events", response_model=TopicMixResponse)
async def ingest_user_events(user_id: str, request: EventBatchRequest) -> TopicMixResponse:
    """
    Process a batch of behavioral actions for the user:
    - Read (>=10s), Like, Save, Follow, Comment, Share, Hide, Report.
    - Floor rule (>= 0), Daily cap (<= 15 pts/day), Lazy decay (14-day half-life).
    - Drops clusters under 3% and re-normalizes to 100%.
    - Updates last 50 hidden posts.
    """
    doc = await fetch_user_mix_from_backend(user_id)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_active = doc.get("lastActiveDate", today)
    active_days = int(doc.get("activeDays", 1))

    active_days_elapsed = 0
    if last_active != today:
        active_days_elapsed = 1
        active_days += 1
        last_active = today

    raw_points = {_safe_mix_key(k): float(v) for k, v in doc.get("rawPoints", {}).items()}
    daily_earned = {_safe_mix_key(k): float(v) for k, v in doc.get("dailyEarned", {}).items()}
    hidden_posts = list(doc.get("hiddenPostIds", []))

    # Convert events to dicts
    events_dicts = [e.model_dump() for e in request.events]

    result = process_user_event_batch(
        current_raw_points=raw_points,
        events=events_dicts,
        current_daily_earned=daily_earned,
        active_days_elapsed=active_days_elapsed,
        current_hidden_posts=hidden_posts,
    )

    update_payload = {
        "mix": {str(k): v for k, v in result["normalized_mix"].items()},
        "rawPoints": {str(k): v for k, v in result["raw_points"].items()},
        "dailyEarned": {str(k): v for k, v in result["daily_earned"].items()},
        "activeDays": active_days,
        "lastActiveDate": today,
        "hiddenPostIds": result["hidden_post_ids"],
        "clusterVersion": doc.get("clusterVersion", 1),
    }

    await save_user_mix_to_backend(user_id, update_payload)

    return TopicMixResponse(
        userId=user_id,
        mix=update_payload["mix"],
        rawPoints=update_payload["rawPoints"],
        activeDays=active_days,
        lastActiveDate=today,
        hiddenPostIds=result["hidden_post_ids"],
        clusterVersion=int(doc.get("clusterVersion", 1)),
    )


@router.post("/{user_id}/onboarding", response_model=TopicMixResponse)
async def seed_user_onboarding(user_id: str, request: OnboardingSeedRequest) -> TopicMixResponse:
    """
    Onboarding seed: Give 10 points to each chosen domain cluster,
    normalize to 100%, and persist profile.
    """
    raw_points, normalized = seed_onboarding_mix(request.domainClusterIds)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    update_payload = {
        "mix": {str(k): v for k, v in normalized.items()},
        "rawPoints": {str(k): v for k, v in raw_points.items()},
        "dailyEarned": {str(k): 10.0 for k in raw_points},
        "activeDays": 1,
        "lastActiveDate": today,
        "hiddenPostIds": [],
        "clusterVersion": 1,
    }

    await save_user_mix_to_backend(user_id, update_payload)

    return TopicMixResponse(
        userId=user_id,
        mix=update_payload["mix"],
        rawPoints=update_payload["rawPoints"],
        activeDays=1,
        lastActiveDate=today,
        hiddenPostIds=[],
        clusterVersion=1,
    )

