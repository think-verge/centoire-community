"""
Feed Service: Candidate Generation, Negative Filtering, Scoring, Variety Arrangement, Caching & Impression Logging (Ticket #106 / Flow 5).

Key Architectural Rules:
1. ~200 candidates:
   - Topic mix: 100 slots (proportional to share, floor 5 / cap 40 per cluster, 7 days window).
   - Following: 40 slots (72 h window).
   - Circles: 30 slots (most-engaged, 72 h window).
   - Curated: 15 slots.
   - Exploration: 15 slots (good posts from clusters at 0% user share).
   - Merge & deduplicate discovery sources.
2. Negative Filters:
   - Remove posts shown in last 7 days.
   - Remove posts very similar to hidden posts (cosine similarity >= 0.82).
   - Remove blocked/muted authors (from social graph).
   - Remove moderation-flagged / non-published posts.
   - Never include posts from private circles for non-members (hard security check).
3. Scoring Formula:
   Score = 3.0 * interest + 2.0 * freshness(48 h half-life) + 2.0 * follows + 1.5 * in_circle
   (Doc's worked examples score exactly 6.44 / 4.50 / 3.35).
4. Variety Arrangement:
   - Top 20: skip author if already 2 in last 10 positions.
   - Skip cluster if previous 3 positions are the same cluster.
   - Exploration posts slotted at positions 5, 12, 18.
5. Show, Cache & Log:
   - Build 60 posts, cache 15 min, serve 20 per page with pagination cursor.
   - Invalidate/rebuild on pull-to-refresh.
   - Log impressions: (user, post, position, source, score, time).
"""

from __future__ import annotations

import logging
import math
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

import httpx

from app.services.feed_parameters import FeedParameters, DEFAULT_FEED_PARAMS

logger = logging.getLogger(__name__)

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:8000")
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "dev-internal-secret")
_INTERNAL_HEADERS = {"X-Internal-Secret": AI_INTERNAL_SECRET}


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class CandidatePost:
    id: str
    title: str = ""
    author_id: str = ""
    cluster_id: Optional[int] = None
    circle_id: Optional[str] = None
    circle_is_private: bool = False
    published_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    upvotes: int = 0
    comments: int = 0
    curated: bool = False
    status: str = "published"
    embedding: Optional[List[float]] = None
    sources: Set[str] = field(default_factory=set)
    score: float = 0.0
    score_breakdown: Dict[str, float] = field(default_factory=dict)

    @property
    def engagement_score(self) -> float:
        """Engagement ranking signal for candidate pre-sorting."""
        return float(self.upvotes * 2 + self.comments * 3)


@dataclass
class ImpressionLog:
    user_id: str
    post_id: str
    position: int
    source: str
    score: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Scoring Utilities
# ---------------------------------------------------------------------------

def compute_freshness(
    published_at: datetime,
    now: datetime,
    half_life_hours: float = DEFAULT_FEED_PARAMS.FRESHNESS_HALF_LIFE_HOURS,
) -> float:
    """Freshness decay: 0.5 ** (age_in_hours / half_life_hours)."""
    age_hours = max(0.0, (now - published_at).total_seconds() / 3600.0)
    return 0.5 ** (age_hours / half_life_hours)


def score_candidate(
    post: CandidatePost,
    user_topic_shares: Dict[int, float],
    followed_author_ids: Set[str],
    member_circle_ids: Set[str],
    now: datetime,
    params: FeedParameters = DEFAULT_FEED_PARAMS,
) -> float:
    """
    Score = 3.0 * interest + 2.0 * freshness(48 h half-life) + 2.0 * follows + 1.5 * in_circle.

    Worked examples:
    - Post A (interest=0.98, age=0h, follows=False, in_circle=True)  -> 6.44
    - Post B (interest=0.50, age=48h, follows=True, in_circle=False)  -> 4.50
    - Post C (interest=0.45, age=0h, follows=False, in_circle=False) -> 3.35
    """
    # Interest: normalized user topic share between 0.0 and 1.0
    raw_interest = user_topic_shares.get(post.cluster_id, 0.0) if post.cluster_id is not None else 0.0
    interest = raw_interest / 100.0 if raw_interest > 1.0 else max(0.0, min(1.0, raw_interest))

    freshness = compute_freshness(post.published_at, now, params.FRESHNESS_HALF_LIFE_HOURS)
    is_followed = post.author_id in followed_author_ids if post.author_id else False
    is_in_circle = (
        bool(post.circle_id and post.circle_id in member_circle_ids)
        if post.circle_id
        else False
    )

    interest_val = params.WEIGHT_INTEREST * interest
    freshness_val = params.WEIGHT_FRESHNESS * freshness
    follows_val = params.WEIGHT_FOLLOWS * (1.0 if is_followed else 0.0)
    circle_val = params.WEIGHT_IN_CIRCLE * (1.0 if is_in_circle else 0.0)

    total_score = round(interest_val + freshness_val + follows_val + circle_val, 2)
    post.score = total_score
    post.score_breakdown = {
        "interest": round(interest_val, 4),
        "freshness": round(freshness_val, 4),
        "follows": round(follows_val, 4),
        "in_circle": round(circle_val, 4),
        "total": total_score,
    }
    return total_score


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return dot / (norm1 * norm2)


# ---------------------------------------------------------------------------
# Candidate Allocation & Merging
# ---------------------------------------------------------------------------

def calculate_topic_mix_slots(
    user_topic_shares: Dict[int, float],
    params: FeedParameters = DEFAULT_FEED_PARAMS,
) -> Dict[int, int]:
    """
    Allocate 100 topic mix candidate slots proportionally across active clusters,
    bounded by floor (5) and cap (40) per cluster.
    """
    active_clusters = {cid: share for cid, share in user_topic_shares.items() if share > 0}
    if not active_clusters:
        return {}

    total_share = sum(active_clusters.values())
    slots_per_cluster: Dict[int, int] = {}

    for cid, share in active_clusters.items():
        raw_slots = int(round(params.TOPIC_MIX_SLOTS * (share / total_share)))
        clamped_slots = max(params.TOPIC_MIX_CLUSTER_FLOOR, min(params.TOPIC_MIX_CLUSTER_CAP, raw_slots))
        slots_per_cluster[cid] = clamped_slots

    return slots_per_cluster


def merge_candidate_pools(pool_map: Dict[str, List[CandidatePost]]) -> List[CandidatePost]:
    """
    Merge candidate lists from different sources (topic_mix, following, circles, curated, exploration),
    deduplicating by post ID while merging their source tags.
    """
    merged: Dict[str, CandidatePost] = {}
    for source_name, posts in pool_map.items():
        for p in posts:
            if p.id in merged:
                merged[p.id].sources.add(source_name)
            else:
                p.sources.add(source_name)
                merged[p.id] = p
    return list(merged.values())


# ---------------------------------------------------------------------------
# Negative Filters
# ---------------------------------------------------------------------------

def apply_negative_filters(
    candidates: List[CandidatePost],
    seen_post_ids: Set[str],
    hidden_post_embeddings: List[List[float]],
    blocked_or_muted_authors: Set[str],
    member_circle_ids: Set[str],
    now: datetime,
    params: FeedParameters = DEFAULT_FEED_PARAMS,
) -> List[CandidatePost]:
    """
    Negative Filters:
    - Exclude posts seen in the last 7 days.
    - Exclude posts authored by blocked or muted users.
    - Exclude moderation-flagged / non-published posts.
    - Exclude posts in private circles where user is not a member.
    - Exclude posts very similar (cosine similarity >= 0.82) to hidden posts.
    """
    filtered: List[CandidatePost] = []
    seen_cutoff = now - timedelta(days=params.SEEN_POSTS_WINDOW_DAYS)

    for p in candidates:
        # 1. Moderation status check
        if p.status != "published":
            continue

        # 2. Seen posts in last 7 days
        if p.id in seen_post_ids:
            continue

        # 3. Blocked and muted authors
        if p.author_id in blocked_or_muted_authors:
            continue

        # 4. Private circle isolation defense
        if p.circle_is_private:
            if not p.circle_id or p.circle_id not in member_circle_ids:
                continue

        # 5. Hidden post vector similarity check (threshold >= 0.82)
        if p.embedding and hidden_post_embeddings:
            is_too_similar = False
            for hidden_emb in hidden_post_embeddings:
                sim = cosine_similarity(p.embedding, hidden_emb)
                if sim >= params.HIDDEN_SIMILARITY_THRESHOLD:
                    is_too_similar = True
                    break
            if is_too_similar:
                continue

        filtered.append(p)

    return filtered


# ---------------------------------------------------------------------------
# Variety Arrangement (Top 20)
# ---------------------------------------------------------------------------

def satisfies_variety(
    candidate: CandidatePost,
    arranged: List[CandidatePost],
    params: FeedParameters = DEFAULT_FEED_PARAMS,
) -> bool:
    """
    Variety rules:
    - Author check: Skip if author already has 2 in the last 10 positions.
    - Cluster check: Skip if the previous 3 are the same cluster.
    """
    # 1. Author window check
    if candidate.author_id:
        recent_window = arranged[-params.VARIETY_AUTHOR_WINDOW:] if len(arranged) >= params.VARIETY_AUTHOR_WINDOW else arranged
        author_count = sum(1 for p in recent_window if p.author_id == candidate.author_id)
        if author_count >= params.VARIETY_AUTHOR_MAX_COUNT:
            return False

    # 2. Consecutive cluster check
    if candidate.cluster_id is not None and len(arranged) >= params.VARIETY_CONSECUTIVE_CLUSTER_LIMIT:
        last_three = arranged[-params.VARIETY_CONSECUTIVE_CLUSTER_LIMIT:]
        if all(p.cluster_id is not None and p.cluster_id == candidate.cluster_id for p in last_three):
            return False

    return True


def arrange_feed(
    scored_candidates: List[CandidatePost],
    exploration_candidates: List[CandidatePost],
    target_count: int = DEFAULT_FEED_PARAMS.BUILD_SIZE,
    params: FeedParameters = DEFAULT_FEED_PARAMS,
) -> List[CandidatePost]:
    """
    Arrange the top 20 (and up to target_count = 60):
    - Place exploration candidates at positions 5, 12, 18 (1-based indices).
    - Enforce author and cluster variety rules on every position.
    - Gracefully relax constraints if candidate pools become exhausted.
    """
    # Separate exploration candidates and sort descending by score
    std_pool = sorted([p for p in scored_candidates if "exploration" not in p.sources], key=lambda x: x.score, reverse=True)
    exp_pool = sorted([p for p in exploration_candidates], key=lambda x: x.score, reverse=True)

    arranged: List[CandidatePost] = []
    chosen_ids: Set[str] = set()

    max_slots = min(target_count, len(std_pool) + len(exp_pool))
    exploration_slots_1based = set(params.EXPLORATION_POSITIONS)

    for pos in range(1, max_slots + 1):
        placed: Optional[CandidatePost] = None
        wants_exploration = pos in exploration_slots_1based and bool(exp_pool)

        # 1. Try exploration if at position 5, 12, 18
        if wants_exploration:
            for idx, cand in enumerate(exp_pool):
                if cand.id in chosen_ids:
                    continue
                if satisfies_variety(cand, arranged, params):
                    placed = cand
                    exp_pool.pop(idx)
                    break

        # 2. Try standard pool if not exploration or if exploration variety failed
        if not placed and std_pool:
            for idx, cand in enumerate(std_pool):
                if cand.id in chosen_ids:
                    continue
                if satisfies_variety(cand, arranged, params):
                    placed = cand
                    std_pool.pop(idx)
                    break

        # 3. Fallback: if variety blocked everything, take top available from std_pool or exp_pool
        if not placed:
            for pool in (std_pool, exp_pool):
                for idx, cand in enumerate(pool):
                    if cand.id not in chosen_ids:
                        placed = cand
                        pool.pop(idx)
                        break
                if placed:
                    break

        if placed:
            arranged.append(placed)
            chosen_ids.add(placed.id)
        else:
            break

    return arranged


# ---------------------------------------------------------------------------
# Feed Cache & Impression Logger
# ---------------------------------------------------------------------------

class FeedCache:
    """In-memory 15-minute TTL cache storing the 60-post ranked feed per user."""

    def __init__(self, ttl_seconds: int = DEFAULT_FEED_PARAMS.CACHE_TTL_SECONDS) -> None:
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get(self, user_id: str) -> Optional[List[CandidatePost]]:
        entry = self._cache.get(user_id)
        if not entry:
            return None
        if time.time() - entry["timestamp"] > self.ttl_seconds:
            del self._cache[user_id]
            return None
        return list(entry["items"])

    def set(self, user_id: str, items: List[CandidatePost]) -> None:
        self._cache[user_id] = {
            "items": list(items),
            "timestamp": time.time(),
        }

    def invalidate(self, user_id: str) -> None:
        self._cache.pop(user_id, None)

    def clear(self) -> None:
        self._cache.clear()


class ImpressionTracker:
    """Logs impressions (user, post, position, source, score, timestamp)."""

    def __init__(self) -> None:
        self._logs: List[ImpressionLog] = []

    def log_impression(
        self,
        user_id: str,
        post_id: str,
        position: int,
        source: str,
        score: float,
        timestamp: Optional[datetime] = None,
    ) -> ImpressionLog:
        entry = ImpressionLog(
            user_id=user_id,
            post_id=post_id,
            position=position,
            source=source,
            score=score,
            timestamp=timestamp or datetime.now(timezone.utc),
        )
        self._logs.append(entry)
        return entry

    def get_user_impressions(self, user_id: str) -> List[ImpressionLog]:
        return [log for log in self._logs if log.user_id == user_id]

    def clear(self) -> None:
        self._logs.clear()


# Global singletons
feed_cache = FeedCache()
impression_tracker = ImpressionTracker()


# ---------------------------------------------------------------------------
# Feed Generation Orchestrator
# ---------------------------------------------------------------------------

def build_for_you_feed(
    user_id: str,
    all_posts: List[CandidatePost],
    user_topic_shares: Dict[int, float],
    followed_author_ids: Set[str],
    member_circle_ids: Set[str],
    blocked_or_muted_authors: Set[str],
    seen_post_ids: Set[str],
    hidden_post_embeddings: List[List[float]],
    now: Optional[datetime] = None,
    rebuild: bool = False,
    page_size: int = DEFAULT_FEED_PARAMS.SERVE_PAGE_SIZE,
    offset: int = 0,
    params: FeedParameters = DEFAULT_FEED_PARAMS,
) -> Dict[str, Any]:
    """
    Main entry point for building and serving the For You feed:
    1. Checks 15-minute cache unless rebuild=True.
    2. Gathers ~200 candidates across topic_mix, following, circles, curated, exploration.
    3. Filters out seen (7d), hidden post similarities, blocked/muted authors, private circles.
    4. Scores candidates with 3.0*interest + 2.0*freshness + 2.0*follows + 1.5*in_circle.
    5. Arranges top 20 with variety rules and positions 5, 12, 18 for exploration.
    6. Stores top 60 in cache and serves page (default 20 items).
    7. Logs impressions for served page.
    """
    current_time = now or datetime.now(timezone.utc)

    # 1. Cache Check
    if not rebuild:
        cached_items = feed_cache.get(user_id)
        if cached_items is not None:
            page_slice = cached_items[offset : offset + page_size]
            next_cursor = str(offset + page_size) if (offset + page_size) < len(cached_items) else None

            # Log impressions for served page
            for idx, post in enumerate(page_slice):
                src = ",".join(post.sources) if post.sources else "recsys"
                impression_tracker.log_impression(
                    user_id=user_id,
                    post_id=post.id,
                    position=offset + idx + 1,
                    source=src,
                    score=post.score,
                    timestamp=current_time,
                )

            return {
                "items": page_slice,
                "cursor": next_cursor,
                "hasMore": next_cursor is not None,
                "cached": True,
                "totalBuilt": len(cached_items),
            }

    # 2. Candidate Allocation
    # Pre-filter by negative lists first to reduce candidate overhead
    valid_posts = apply_negative_filters(
        candidates=all_posts,
        seen_post_ids=seen_post_ids,
        hidden_post_embeddings=hidden_post_embeddings,
        blocked_or_muted_authors=blocked_or_muted_authors,
        member_circle_ids=member_circle_ids,
        now=current_time,
        params=params,
    )

    # Bucketing
    topic_mix_slots = calculate_topic_mix_slots(user_topic_shares, params)
    seven_days_ago = current_time - timedelta(days=params.TOPIC_MIX_WINDOW_DAYS)
    seventy_two_hours_ago = current_time - timedelta(hours=params.FOLLOWING_WINDOW_HOURS)

    # A. Topic mix pool (target 100)
    topic_mix_pool: List[CandidatePost] = []
    by_cluster: Dict[int, List[CandidatePost]] = {}
    for p in valid_posts:
        if p.cluster_id is not None and p.published_at >= seven_days_ago:
            by_cluster.setdefault(p.cluster_id, []).append(p)

    for cid, max_slots in topic_mix_slots.items():
        cluster_posts = by_cluster.get(cid, [])
        # Sort by engagement and freshness
        sorted_cp = sorted(cluster_posts, key=lambda x: (x.engagement_score, x.published_at), reverse=True)
        topic_mix_pool.extend(sorted_cp[:max_slots])

    # B. Following pool (target 40, last 72 h)
    following_pool = [
        p for p in valid_posts
        if p.author_id in followed_author_ids and p.published_at >= seventy_two_hours_ago
    ]
    following_pool = sorted(following_pool, key=lambda x: x.published_at, reverse=True)[: params.FOLLOWING_SLOTS]

    # C. Circles pool (target 30, most engaged, last 72 h)
    circles_pool = [
        p for p in valid_posts
        if p.circle_id in member_circle_ids and p.published_at >= seventy_two_hours_ago
    ]
    circles_pool = sorted(circles_pool, key=lambda x: (x.engagement_score, x.published_at), reverse=True)[: params.CIRCLES_SLOTS]

    # D. Curated pool (target 15)
    curated_pool = [p for p in valid_posts if p.curated]
    curated_pool = sorted(curated_pool, key=lambda x: x.published_at, reverse=True)[: params.CURATED_SLOTS]

    # E. Exploration pool (target 15, clusters where user share is 0%)
    zero_share_clusters = {cid for cid in by_cluster.keys() if user_topic_shares.get(cid, 0.0) <= 0.0}
    exploration_pool = [
        p for p in valid_posts
        if p.cluster_id in zero_share_clusters and p.published_at >= seven_days_ago
    ]
    exploration_pool = sorted(exploration_pool, key=lambda x: (x.engagement_score, x.published_at), reverse=True)[: params.EXPLORATION_SLOTS]

    # Merge candidates
    candidate_map = {
        "topic_mix": topic_mix_pool,
        "following": following_pool,
        "circles": circles_pool,
        "curated": curated_pool,
    }
    merged_candidates = merge_candidate_pools(candidate_map)

    # 3. Scoring
    for cand in merged_candidates:
        score_candidate(
            cand,
            user_topic_shares,
            followed_author_ids,
            member_circle_ids,
            current_time,
            params,
        )

    for cand in exploration_pool:
        cand.sources.add("exploration")
        score_candidate(
            cand,
            user_topic_shares,
            followed_author_ids,
            member_circle_ids,
            current_time,
            params,
        )

    # 4. Variety Arrangement
    arranged = arrange_feed(
        scored_candidates=merged_candidates,
        exploration_candidates=exploration_pool,
        target_count=params.BUILD_SIZE,
        params=params,
    )

    # 5. Cache the built feed (60 items)
    feed_cache.set(user_id, arranged)

    # 6. Slice page and log impressions
    page_slice = arranged[offset : offset + page_size]
    next_cursor = str(offset + page_size) if (offset + page_size) < len(arranged) else None

    for idx, post in enumerate(page_slice):
        src = ",".join(post.sources) if post.sources else "recsys"
        impression_tracker.log_impression(
            user_id=user_id,
            post_id=post.id,
            position=offset + idx + 1,
            source=src,
            score=post.score,
            timestamp=current_time,
        )

    return {
        "items": page_slice,
        "cursor": next_cursor,
        "hasMore": next_cursor is not None,
        "cached": False,
        "totalBuilt": len(arranged),
    }
