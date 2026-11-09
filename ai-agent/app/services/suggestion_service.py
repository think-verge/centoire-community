"""
Circle and Creator Suggestion Engine (Ticket #107 / Flow 6).

Key Capabilities:
1. Circle & Creator Mixes: Points per cluster from 60 days of posts with 14-day half-life decay.
   Cold start from bio/description + chosen domains.
2. Topic Match: Histogram intersection sum over clusters of min(member %, target %).
3. Signals (0-1):
   - Friends: (0, .33, .67, 1)
   - Already engaged (creators)
   - Activity (circles)
   - Active creator (posted in 30 days)
   - Engagement per post
4. Formulas:
   - Circle:  3 * match + 2 * friends + 1.5 * activity + 1 * engagement
              (Worked examples: 5.78 vs 3.30)
   - Creator: 3 * match + 3 * engaged + 2 * friends + 1 * active + 1 * engagement
              (Worked examples: 7.37 vs 3.53)
5. Strict Negative Filters:
   - Already joined/followed, blocked/muted, dismissed in 30 days,
   - Inactive in 30 days, private circles user cannot join.
6. Variety Rules:
   - At least 1 in 4 creator suggestions for smaller/newer creators.
   - Max 2 in a row from one cluster.
7. Reason Lines & Feedback:
   - Join/Follow: +3 points to target's top clusters.
   - Dismiss: hide 30 days.
   - Ignore 3 times: hide 14 days.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from app.services.suggestion_parameters import (
    DEFAULT_SUGGESTION_PARAMS,
    SuggestionParameters,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class CircleCandidate:
    id: str
    name: str
    description: str = ""
    cluster_id: Optional[int] = None
    topic_mix: Dict[int, float] = field(default_factory=dict)
    is_private: bool = False
    can_join: bool = True
    member_count: int = 0
    posts_30d: int = 1
    last_post_at: Optional[datetime] = None
    avg_engagement: float = 0.5  # 0 to 1 scale
    mutual_friend_count: int = 0
    score: float = 0.0
    score_breakdown: Dict[str, float] = field(default_factory=dict)
    reason: str = ""


@dataclass
class CreatorCandidate:
    id: str
    handle: str
    name: str = ""
    bio: str = ""
    cluster_id: Optional[int] = None
    topic_mix: Dict[int, float] = field(default_factory=dict)
    follower_count: int = 50
    posts_30d: int = 1
    last_post_at: Optional[datetime] = None
    avg_engagement: float = 0.5   # 0 to 1 scale
    mutual_friend_count: int = 0
    already_engaged_score: float = 0.0  # 0 to 1 scale
    is_emerging: bool = False
    score: float = 0.0
    score_breakdown: Dict[str, float] = field(default_factory=dict)
    reason: str = ""


@dataclass
class SuggestionFeedbackRecord:
    dismissed_until: Optional[datetime] = None
    ignore_count: int = 0
    last_action: Optional[str] = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Mix Computation & Cold Start Seeding
# ---------------------------------------------------------------------------

def compute_mix_from_posts(
    posts: List[Dict[str, Any]],
    now: datetime,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> Dict[int, float]:
    """
    Compute circle_mix or creator_mix from the last 60 days of posts.
    Engagement weighted with 14-day half-life decay:
      decay = 0.5 ** (age_in_days / 14.0)
      points = (upvotes * 2 + comments * 3 + 1.0) * decay
    """
    cutoff = now - timedelta(days=params.POST_HISTORY_DAYS)
    points_by_cluster: Dict[int, float] = {}

    for post in posts:
        pub_at = post.get("published_at")
        if not pub_at:
            continue
        if isinstance(pub_at, str):
            pub_at = datetime.fromisoformat(pub_at)
        if pub_at < cutoff:
            continue

        cid = post.get("cluster_id")
        if cid is None:
            continue

        cid_int = int(cid)
        age_days = max(0.0, (now - pub_at).total_seconds() / 86400.0)
        decay = 0.5 ** (age_days / params.MIX_DECAY_HALF_LIFE_DAYS)

        upvotes = int(post.get("upvotes", 0))
        comments = int(post.get("comments", 0))
        weight = (upvotes * 2.0 + comments * 3.0 + 1.0) * decay

        points_by_cluster[cid_int] = points_by_cluster.get(cid_int, 0.0) + weight

    # Normalize to shares summing to 1.0
    total = sum(points_by_cluster.values())
    if total <= 0:
        return {}

    return {cid: round(pts / total, 4) for cid, pts in points_by_cluster.items()}


def seed_cold_start_mix(
    chosen_domains: List[int],
    points_per_domain: float = 10.0,
) -> Dict[int, float]:
    """
    Cold start mix from circle description or creator bio + chosen domains.
    Assigns points_per_domain per chosen cluster, normalized to sum to 1.0.
    """
    if not chosen_domains:
        return {}
    share = round(1.0 / len(chosen_domains), 4)
    return {int(cid): share for cid in chosen_domains}


# ---------------------------------------------------------------------------
# Scoring Signals & Formulas
# ---------------------------------------------------------------------------

def compute_topic_match(
    user_mix: Dict[int, float],
    target_mix: Dict[int, float],
) -> float:
    """
    Topic match = sum over clusters of min(member %, target %).
    Result is strictly in [0.0, 1.0].
    """
    if not user_mix or not target_mix:
        return 0.0

    match_val = 0.0
    all_clusters = set(user_mix.keys()) | set(target_mix.keys())
    for cid in all_clusters:
        u_share = user_mix.get(cid, 0.0)
        t_share = target_mix.get(cid, 0.0)
        match_val += min(u_share, t_share)

    return min(1.0, max(0.0, match_val))


def quantize_friends_signal(
    mutual_friends: int,
    levels: Tuple[float, float, float, float] = DEFAULT_SUGGESTION_PARAMS.FRIENDS_LEVELS,
) -> float:
    """
    Friends signal in [0, 1], quantized to (0, .33, .67, 1):
    - 0 friends -> 0.0
    - 1 friend  -> 0.33
    - 2 friends -> 0.67
    - 3+ friends -> 1.0
    """
    if mutual_friends <= 0:
        return levels[0]
    elif mutual_friends == 1:
        return levels[1]
    elif mutual_friends == 2:
        return levels[2]
    else:
        return levels[3]


def score_circle(
    match: float,
    friends: float,
    activity: float,
    engagement: float,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> Tuple[float, Dict[str, float]]:
    """
    Circle Formula:
      Score = 3 * match + 2 * friends + 1.5 * activity + 1 * engagement

    Worked Examples:
      - Circle A: match=0.78, friends=0.67, activity=1.0, engagement=0.60 -> 5.78
      - Circle B: match=0.40, friends=0.00, activity=1.0, engagement=0.60 -> 3.30
    """
    s_match = params.CIRCLE_WEIGHT_MATCH * match
    s_friends = params.CIRCLE_WEIGHT_FRIENDS * friends
    s_activity = params.CIRCLE_WEIGHT_ACTIVITY * activity
    s_engagement = params.CIRCLE_WEIGHT_ENGAGEMENT * engagement

    total = round(s_match + s_friends + s_activity + s_engagement, 2)
    breakdown = {
        "match": round(s_match, 2),
        "friends": round(s_friends, 2),
        "activity": round(s_activity, 2),
        "engagement": round(s_engagement, 2),
    }
    return total, breakdown


def score_creator(
    match: float,
    engaged: float,
    friends: float,
    active: float,
    engagement: float,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> Tuple[float, Dict[str, float]]:
    """
    Creator Formula:
      Score = 3 * match + 3 * engaged + 2 * friends + 1 * active + 1 * engagement

    Worked Examples:
      - Creator A: match=0.71, engaged=0.80, friends=0.67, active=1.0, engagement=0.50 -> 7.37
      - Creator B: match=0.71, engaged=0.00, friends=0.00, active=1.0, engagement=0.40 -> 3.53
    """
    s_match = params.CREATOR_WEIGHT_MATCH * match
    s_engaged = params.CREATOR_WEIGHT_ENGAGED * engaged
    s_friends = params.CREATOR_WEIGHT_FRIENDS * friends
    s_active = params.CREATOR_WEIGHT_ACTIVE * active
    s_engagement = params.CREATOR_WEIGHT_ENGAGEMENT * engagement

    total = round(s_match + s_engaged + s_friends + s_active + s_engagement, 2)
    breakdown = {
        "match": round(s_match, 2),
        "engaged": round(s_engaged, 2),
        "friends": round(s_friends, 2),
        "active": round(s_active, 2),
        "engagement": round(s_engagement, 2),
    }
    return total, breakdown


# ---------------------------------------------------------------------------
# Reason Line Generator
# ---------------------------------------------------------------------------

def generate_circle_reason(
    circle: CircleCandidate,
    friends_signal: float,
    match_signal: float,
    cluster_names: Optional[Dict[int, str]] = None,
) -> str:
    """Generate a concise, human-readable reason for suggesting this circle."""
    cluster_label = None
    if cluster_names and circle.cluster_id is not None:
        cluster_label = cluster_names.get(circle.cluster_id)

    if circle.mutual_friend_count >= 2:
        return f"{circle.mutual_friend_count} friends are members"
    elif circle.mutual_friend_count == 1:
        return "1 friend is a member"
    elif match_signal >= 0.5:
        if cluster_label:
            return f"Matches your interest in {cluster_label}"
        return "Matches your topic interests"
    elif circle.posts_30d >= 10:
        return "Highly active circle with regular posts"
    return "Popular community in fashion & culture"


def generate_creator_reason(
    creator: CreatorCandidate,
    friends_signal: float,
    match_signal: float,
    cluster_names: Optional[Dict[int, str]] = None,
) -> str:
    """Generate a concise, human-readable reason for suggesting this creator."""
    cluster_label = None
    if cluster_names and creator.cluster_id is not None:
        cluster_label = cluster_names.get(creator.cluster_id)

    if creator.already_engaged_score >= 0.5:
        return "You've engaged with their posts recently"
    elif creator.mutual_friend_count >= 2:
        return f"Followed by {creator.mutual_friend_count} people you follow"
    elif creator.mutual_friend_count == 1:
        return "Followed by 1 person you follow"
    elif match_signal >= 0.5:
        if cluster_label:
            return f"Top creator in {cluster_label}"
        return "Publishes on topics you read"
    elif creator.is_emerging:
        if cluster_label:
            return f"Rising creator in {cluster_label}"
        return "Rising creator you might like"
    return "Active fashion contributor"


# ---------------------------------------------------------------------------
# Feedback Store
# ---------------------------------------------------------------------------

class SuggestionFeedbackStore:
    """
    In-memory feedback manager (backed by DB in production):
    - join/follow: +3 points to target's top clusters in user mix.
    - dismiss: hide 30 days.
    - ignore (3 times): hide 14 days.
    """

    def __init__(self, params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS) -> None:
        self.params = params
        # user_id -> target_id -> SuggestionFeedbackRecord
        self._store: Dict[str, Dict[str, SuggestionFeedbackRecord]] = {}

    def get_record(self, user_id: str, target_id: str) -> SuggestionFeedbackRecord:
        user_records = self._store.setdefault(user_id, {})
        if target_id not in user_records:
            user_records[target_id] = SuggestionFeedbackRecord()
        return user_records[target_id]

    def is_hidden(self, user_id: str, target_id: str, now: datetime) -> bool:
        user_records = self._store.get(user_id)
        if not user_records:
            return False
        record = user_records.get(target_id)
        if not record or not record.dismissed_until:
            return False
        return now < record.dismissed_until

    def record_dismiss(self, user_id: str, target_id: str, now: datetime) -> datetime:
        rec = self.get_record(user_id, target_id)
        rec.dismissed_until = now + timedelta(days=self.params.DISMISS_HIDE_DAYS)
        rec.last_action = "dismiss"
        rec.updated_at = now
        return rec.dismissed_until

    def record_ignore(self, user_id: str, target_id: str, now: datetime) -> Tuple[int, Optional[datetime]]:
        rec = self.get_record(user_id, target_id)
        rec.ignore_count += 1
        rec.last_action = "ignore"
        rec.updated_at = now

        if rec.ignore_count >= self.params.IGNORE_THRESHOLD_COUNT:
            rec.dismissed_until = now + timedelta(days=self.params.IGNORE_HIDE_DAYS)
        return rec.ignore_count, rec.dismissed_until

    def record_follow_or_join(
        self,
        user_id: str,
        target_top_clusters: List[int],
    ) -> Dict[int, float]:
        """
        Feedback effect on join/follow:
        +3 points to target's top clusters.
        """
        if not target_top_clusters:
            return {}
        points_per_cluster = self.params.FEEDBACK_JOIN_TOPIC_POINTS / len(target_top_clusters)
        return {int(cid): points_per_cluster for cid in target_top_clusters}

    def clear(self) -> None:
        self._store.clear()


feedback_store = SuggestionFeedbackStore()


# ---------------------------------------------------------------------------
# Filtering & Variety Arrangement
# ---------------------------------------------------------------------------

def filter_circles(
    circles: List[CircleCandidate],
    user_id: str,
    member_circle_ids: Set[str],
    blocked_or_muted_ids: Set[str],
    now: datetime,
    feedback: SuggestionFeedbackStore = feedback_store,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> List[CircleCandidate]:
    """
    Negative Filters for Circles:
    - Already joined.
    - Blocked or muted circle.
    - Dismissed in last 30 days (or ignored 3x within 14 days).
    - Inactive (no posts in last 30 days).
    - Private circles user cannot join.
    """
    cutoff_30d = now - timedelta(days=params.INACTIVE_CUTOFF_DAYS)
    filtered: List[CircleCandidate] = []

    for c in circles:
        # 1. Already a member
        if c.id in member_circle_ids:
            continue
        # 2. Blocked or muted
        if c.id in blocked_or_muted_ids:
            continue
        # 3. Dismissed or ignored feedback
        if feedback.is_hidden(user_id, c.id, now):
            continue
        # 4. Inactive in last 30 days (no posts)
        if c.posts_30d <= 0:
            continue
        if c.last_post_at and c.last_post_at < cutoff_30d:
            continue
        # 5. Private circle user cannot join
        if c.is_private and not c.can_join:
            continue

        filtered.append(c)

    return filtered


def filter_creators(
    creators: List[CreatorCandidate],
    user_id: str,
    followed_ids: Set[str],
    blocked_or_muted_ids: Set[str],
    now: datetime,
    feedback: SuggestionFeedbackStore = feedback_store,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> List[CreatorCandidate]:
    """
    Negative Filters for Creators:
    - Already followed or self.
    - Blocked or muted author.
    - Dismissed in last 30 days (or ignored 3x within 14 days).
    - Inactive in last 30 days (no posts).
    """
    cutoff_30d = now - timedelta(days=params.INACTIVE_CUTOFF_DAYS)
    filtered: List[CreatorCandidate] = []

    for cr in creators:
        # 1. Self or already followed
        if cr.id == user_id or cr.id in followed_ids:
            continue
        # 2. Blocked or muted
        if cr.id in blocked_or_muted_ids:
            continue
        # 3. Dismissed or ignored feedback
        if feedback.is_hidden(user_id, cr.id, now):
            continue
        # 4. Inactive in last 30 days
        if cr.posts_30d <= 0:
            continue
        if cr.last_post_at and cr.last_post_at < cutoff_30d:
            continue

        filtered.append(cr)

    return filtered


def arrange_circles(
    candidates: List[CircleCandidate],
    limit: int = 10,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> List[CircleCandidate]:
    """
    Variety rules for Circles:
    - Max 2 in a row from one cluster.
    - Sorted primarily by score descending.
    """
    pool = sorted(candidates, key=lambda x: x.score, reverse=True)
    arranged: List[CircleCandidate] = []
    remaining = list(pool)

    while remaining and len(arranged) < limit:
        placed = False
        for idx, cand in enumerate(remaining):
            # Check cluster rule: max 2 in a row
            if cand.cluster_id is not None and len(arranged) >= params.MAX_CONSECUTIVE_CLUSTER:
                last_two = arranged[-params.MAX_CONSECUTIVE_CLUSTER:]
                if all(c.cluster_id is not None and c.cluster_id == cand.cluster_id for c in last_two):
                    continue  # Violates cluster variety, skip for now

            arranged.append(cand)
            remaining.pop(idx)
            placed = True
            break

        if not placed:
            # Constraints exhausted, take top remaining
            arranged.append(remaining.pop(0))

    return arranged


def arrange_creators(
    candidates: List[CreatorCandidate],
    limit: int = 10,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> List[CreatorCandidate]:
    """
    Variety rules for Creators:
    - At least 1 in 4 suggestions for smaller/newer creators.
    - Max 2 in a row from one cluster.
    """
    # Mark emerging if follower_count < emerging threshold
    for c in candidates:
        if c.follower_count <= params.EMERGING_CREATOR_MAX_FOLLOWERS:
            c.is_emerging = True

    std_pool = sorted([c for c in candidates if not c.is_emerging], key=lambda x: x.score, reverse=True)
    emerging_pool = sorted([c for c in candidates if c.is_emerging], key=lambda x: x.score, reverse=True)

    arranged: List[CreatorCandidate] = []
    chosen_ids: Set[str] = set()

    for pos in range(1, limit + 1):
        wants_emerging = (pos % params.EMERGING_CREATOR_INTERVAL == 0) and bool(emerging_pool)
        placed = None

        if wants_emerging:
            for idx, cand in enumerate(emerging_pool):
                if cand.id in chosen_ids:
                    continue
                # Cluster rule
                if cand.cluster_id is not None and len(arranged) >= params.MAX_CONSECUTIVE_CLUSTER:
                    last_two = arranged[-params.MAX_CONSECUTIVE_CLUSTER:]
                    if all(c.cluster_id is not None and c.cluster_id == cand.cluster_id for c in last_two):
                        continue
                placed = emerging_pool.pop(idx)
                break

        if not placed and std_pool:
            for idx, cand in enumerate(std_pool):
                if cand.id in chosen_ids:
                    continue
                if cand.cluster_id is not None and len(arranged) >= params.MAX_CONSECUTIVE_CLUSTER:
                    last_two = arranged[-params.MAX_CONSECUTIVE_CLUSTER:]
                    if all(c.cluster_id is not None and c.cluster_id == cand.cluster_id for c in last_two):
                        continue
                placed = std_pool.pop(idx)
                break

        # Fallback if constraint couldn't be strictly satisfied
        if not placed:
            avail = [c for c in (emerging_pool + std_pool) if c.id not in chosen_ids]
            if avail:
                avail.sort(key=lambda x: x.score, reverse=True)
                placed = avail[0]
                if placed in emerging_pool:
                    emerging_pool.remove(placed)
                elif placed in std_pool:
                    std_pool.remove(placed)

        if placed:
            chosen_ids.add(placed.id)
            arranged.append(placed)

    return arranged


# ---------------------------------------------------------------------------
# High-Level Suggestion Pipeline
# ---------------------------------------------------------------------------

def generate_circle_suggestions(
    user_id: str,
    user_topic_mix: Dict[int, float],
    all_circles: List[CircleCandidate],
    member_circle_ids: Set[str],
    blocked_or_muted_ids: Set[str],
    now: datetime,
    limit: int = 10,
    cluster_names: Optional[Dict[int, str]] = None,
    feedback: SuggestionFeedbackStore = feedback_store,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> List[CircleCandidate]:
    """
    End-to-end Circle Suggestions Pipeline:
    1. Filter out joined, blocked, dismissed, inactive, or forbidden private circles.
    2. Score remaining candidates via:
       3 * match + 2 * friends + 1.5 * activity + 1 * engagement
    3. Generate dynamic reason line.
    4. Arrange with cluster variety rules (max 2 consecutive).
    """
    valid = filter_circles(
        circles=all_circles,
        user_id=user_id,
        member_circle_ids=member_circle_ids,
        blocked_or_muted_ids=blocked_or_muted_ids,
        now=now,
        feedback=feedback,
        params=params,
    )

    for c in valid:
        match_sig = compute_topic_match(user_topic_mix, c.topic_mix)
        friends_sig = quantize_friends_signal(c.mutual_friend_count, params.FRIENDS_LEVELS)
        # Activity normalized [0, 1] based on recent 30d posts
        act_sig = min(1.0, max(0.1, c.posts_30d / 10.0))
        eng_sig = min(1.0, max(0.0, c.avg_engagement))

        score_val, breakdown = score_circle(
            match=match_sig,
            friends=friends_sig,
            activity=act_sig,
            engagement=eng_sig,
            params=params,
        )
        c.score = score_val
        c.score_breakdown = breakdown
        c.reason = generate_circle_reason(c, friends_sig, match_sig, cluster_names)

    return arrange_circles(valid, limit=limit, params=params)


def generate_creator_suggestions(
    user_id: str,
    user_topic_mix: Dict[int, float],
    all_creators: List[CreatorCandidate],
    followed_ids: Set[str],
    blocked_or_muted_ids: Set[str],
    now: datetime,
    limit: int = 10,
    cluster_names: Optional[Dict[int, str]] = None,
    feedback: SuggestionFeedbackStore = feedback_store,
    params: SuggestionParameters = DEFAULT_SUGGESTION_PARAMS,
) -> List[CreatorCandidate]:
    """
    End-to-end Creator Suggestions Pipeline:
    1. Filter out followed, self, blocked, dismissed, or inactive creators.
    2. Score remaining candidates via:
       3 * match + 3 * engaged + 2 * friends + 1 * active + 1 * engagement
    3. Generate dynamic reason line.
    4. Arrange with variety rules (1 in 4 emerging, max 2 consecutive from same cluster).
    """
    valid = filter_creators(
        creators=all_creators,
        user_id=user_id,
        followed_ids=followed_ids,
        blocked_or_muted_ids=blocked_or_muted_ids,
        now=now,
        feedback=feedback,
        params=params,
    )

    cutoff_30d = now - timedelta(days=params.INACTIVE_CUTOFF_DAYS)

    for cr in valid:
        match_sig = compute_topic_match(user_topic_mix, cr.topic_mix)
        engaged_sig = min(1.0, max(0.0, cr.already_engaged_score))
        friends_sig = quantize_friends_signal(cr.mutual_friend_count, params.FRIENDS_LEVELS)
        active_sig = 1.0 if (cr.last_post_at and cr.last_post_at >= cutoff_30d) or cr.posts_30d > 0 else 0.0
        eng_sig = min(1.0, max(0.0, cr.avg_engagement))

        score_val, breakdown = score_creator(
            match=match_sig,
            engaged=engaged_sig,
            friends=friends_sig,
            active=active_sig,
            engagement=eng_sig,
            params=params,
        )
        cr.score = score_val
        cr.score_breakdown = breakdown
        cr.reason = generate_creator_reason(cr, friends_sig, match_sig, cluster_names)

    return arrange_creators(valid, limit=limit, params=params)

