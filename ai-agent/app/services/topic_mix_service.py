"""
User Topic-Mix Engine (Ticket #105).

Core concepts:
- Each user is a percentage mix over topic clusters; every action shifts it.
- Action points table:
    Read (>= 10 s): +1
    Like: +2
    Follow author: +3
    Save: +4
    Comment / share: +5
    Hide / not interested: -5
    Report: -8
- Floor rule: Negative actions never take a cluster below 0.
- Daily cap: A cluster earns at most 15 points/day.
- Lazy decay: points * 0.5^(active days since update / 14); only days the user opens the app count.
- Normalisation: Recompute percentages to 100% and drop clusters under 3%.
- Negative list: Keep the last 50 hidden posts.
- Onboarding seed: Embed each chosen domain, find nearest cluster, give it 10 points.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional, Union

logger = logging.getLogger(__name__)

# Point values for behavioral actions
ACTION_POINTS: dict[str, int] = {
    "read": 1,
    "like": 2,
    "follow": 3,
    "follow_author": 3,
    "save": 4,
    "bookmark": 4,
    "comment": 5,
    "share": 5,
    "hide": -5,
    "not_interested": -5,
    "report": -8,
}

DAILY_CLUSTER_CAP = 15.0
DECAY_HALF_LIFE_ACTIVE_DAYS = 14.0
MIN_SHARE_THRESHOLD_PCT = 3.0
MAX_HIDDEN_POSTS = 50
ONBOARDING_DOMAIN_POINTS = 10.0


def get_action_delta(action: str) -> int:
    """Normalize action name and return its points delta."""
    normalized = action.strip().lower().replace("-", "_").replace(" ", "_")
    if normalized not in ACTION_POINTS:
        raise ValueError(f"Unknown action '{action}'. Valid actions: {list(ACTION_POINTS.keys())}")
    return ACTION_POINTS[normalized]


def apply_action_points(
    current_points: float,
    action: str,
    points_earned_today: float = 0.0,
    daily_cap: float = DAILY_CLUSTER_CAP,
) -> tuple[float, float]:
    """
    Apply an action to a cluster's raw points.

    Rules:
    - Floor rule: Negative actions never take a cluster below 0.
    - Daily cap: A cluster earns at most `daily_cap` points/day (default 15).
      Negative actions do not affect the daily positive credit tally.

    Args:
        current_points: Current cluster point balance.
        action: Action name (e.g. 'read', 'like', 'save', 'hide', 'report').
        points_earned_today: Total positive points already earned by this cluster today.
        daily_cap: Maximum positive points earnable per cluster per day.

    Returns:
        (new_points, new_points_earned_today)
    """
    delta = float(get_action_delta(action))

    if delta > 0:
        # Check against daily cap
        remaining_cap = max(0.0, daily_cap - points_earned_today)
        allowed_gain = min(delta, remaining_cap)
        new_points = current_points + allowed_gain
        new_earned_today = points_earned_today + allowed_gain
        return new_points, new_earned_today
    else:
        # Negative action: floor at 0.0, does not alter positive earned tally
        new_points = max(0.0, current_points + delta)
        return new_points, points_earned_today


def apply_lazy_decay(
    points: float,
    active_days_elapsed: int,
    half_life_days: float = DECAY_HALF_LIFE_ACTIVE_DAYS,
) -> float:
    """
    Lazy decay: points * 0.5^(active_days / 14).
    Only days the user actually opens the app count.

    Args:
        points: Current raw points.
        active_days_elapsed: Number of active app-open days elapsed.
        half_life_days: Half-life in active days (default 14).

    Returns:
        Decayed points.
    """
    if points <= 0.0 or active_days_elapsed <= 0:
        return max(0.0, points)

    decay_factor = 0.5 ** (float(active_days_elapsed) / half_life_days)
    return max(0.0, points * decay_factor)


def normalize_mix(
    raw_points: dict[Union[int, str], float],
    min_share_pct: float = MIN_SHARE_THRESHOLD_PCT,
) -> dict[int, float]:
    """
    Recompute percentages to 100% and drop clusters under `min_share_pct` (default 3%).

    Algorithm:
    1. Filter out non-positive points.
    2. Compute raw shares: share_i = (points_i / total_points) * 100.
    3. Drop any cluster where share_i < min_share_pct.
    4. If any clusters remain, recompute shares of kept clusters so they sum to 100.0%.
    5. If all dropped or no points, return empty dict.

    Returns:
        dict[cluster_id, percentage_0_to_100]
    """
    # Clean and filter non-positive
    positive_points: dict[int, float] = {}
    for cid, pts in raw_points.items():
        if pts > 0.0:
            positive_points[int(cid)] = float(pts)

    if not positive_points:
        return {}

    total_points = sum(positive_points.values())
    if total_points <= 0.0:
        return {}

    # Initial share check: drop clusters under min_share_pct
    kept: dict[int, float] = {}
    for cid, pts in positive_points.items():
        raw_share = (pts / total_points) * 100.0
        if raw_share >= min_share_pct:
            kept[cid] = pts

    if not kept:
        return {}

    # Re-normalize kept clusters to strictly 100.0%
    kept_total = sum(kept.values())
    normalized_mix: dict[int, float] = {}
    for cid, pts in kept.items():
        percentage = (pts / kept_total) * 100.0
        normalized_mix[cid] = round(percentage, 2)

    # Ensure clean sum of 100.0 by adjusting rounding residual on largest cluster
    if normalized_mix:
        residual = 100.0 - sum(normalized_mix.values())
        if abs(residual) > 1e-4:
            largest_cid = max(normalized_mix, key=lambda c: normalized_mix[c])
            normalized_mix[largest_cid] = round(normalized_mix[largest_cid] + residual, 2)

    return normalized_mix


def update_hidden_posts(
    current_hidden_ids: list[str],
    new_hidden_post_id: str,
    max_history: int = MAX_HIDDEN_POSTS,
) -> list[str]:
    """
    Keep the last 50 hidden posts (FIFO).
    """
    updated = [pid for pid in current_hidden_ids if pid != new_hidden_post_id]
    updated.append(new_hidden_post_id)
    if len(updated) > max_history:
        updated = updated[-max_history:]
    return updated


def seed_onboarding_mix(
    chosen_domain_clusters: list[int],
    points_per_domain: float = ONBOARDING_DOMAIN_POINTS,
) -> tuple[dict[int, float], dict[int, float]]:
    """
    Onboarding seed: Give 10 points to each chosen domain's cluster.

    Args:
        chosen_domain_clusters: List of cluster IDs corresponding to chosen domains.
        points_per_domain: Default 10.0 points per domain.

    Returns:
        (raw_points, normalized_mix)
    """
    raw_points: dict[int, float] = {}
    for cid in chosen_domain_clusters:
        raw_points[int(cid)] = raw_points.get(int(cid), 0.0) + points_per_domain

    normalized = normalize_mix(raw_points)
    return raw_points, normalized


def process_user_event_batch(
    current_raw_points: dict[Union[int, str], float],
    events: list[dict[str, Any]],
    current_daily_earned: Optional[dict[Union[int, str], float]] = None,
    active_days_elapsed: int = 0,
    current_hidden_posts: Optional[list[str]] = None,
) -> dict[str, Any]:
    """
    Process a batch of user behavioral events.

    Workflow:
    1. Apply lazy decay if active_days_elapsed > 0.
    2. For each event:
       - If action is 'hide' or 'not_interested', update hidden post IDs list.
       - Apply action points to the event's cluster, respecting floor (>= 0) and daily cap (<= 15 pts/day).
    3. Recompute normalized mix: drops clusters under 3%, re-normalizes to 100%.

    Returns:
        {
            "raw_points": dict[int, float],
            "normalized_mix": dict[int, float],
            "daily_earned": dict[int, float],
            "hidden_post_ids": list[str],
        }
    """
    raw = {int(k): float(v) for k, v in current_raw_points.items()}
    daily = {int(k): float(v) for k, v in (current_daily_earned or {}).items()}
    hidden = list(current_hidden_posts or [])

    # 1. Apply lazy decay across all existing clusters
    if active_days_elapsed > 0:
        for cid in list(raw.keys()):
            raw[cid] = apply_lazy_decay(raw[cid], active_days_elapsed)
        # Reset daily cap counters on active day advance
        daily = {}

    # 2. Process events
    for ev in events:
        action = ev.get("action", "").strip()
        cluster_id_val = ev.get("cluster_id", ev.get("clusterId"))
        post_id = ev.get("post_id", ev.get("postId"))

        if not action:
            continue

        # Track hidden posts
        if action.lower() in ("hide", "not_interested") and post_id:
            hidden = update_hidden_posts(hidden, str(post_id))

        if cluster_id_val is None:
            continue

        cid = int(cluster_id_val)
        curr_pts = raw.get(cid, 0.0)
        curr_earned = daily.get(cid, 0.0)

        new_pts, new_earned = apply_action_points(
            current_points=curr_pts,
            action=action,
            points_earned_today=curr_earned,
        )

        raw[cid] = new_pts
        daily[cid] = new_earned

    # 3. Clean up zero points from raw
    clean_raw = {cid: pts for cid, pts in raw.items() if pts > 0.0}

    # 4. Recompute percentages to 100% and drop < 3%
    normalized = normalize_mix(clean_raw)

    return {
        "raw_points": clean_raw,
        "normalized_mix": normalized,
        "daily_earned": daily,
        "hidden_post_ids": hidden,
    }

