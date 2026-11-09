"""
Unit tests for Ticket #105: User Topic-Mix Engine.

Acceptance criteria verified:
1. Pure functions with unit tests for cap, floor, decay, normalisation, min share.
2. The doc's example reproduces (runway 15% -> ~18%; luxury dropped after a hide).
3. user_mix shape matches the doc; updates driven by the event pipeline.
4. Negative list keeps the last 50 hidden posts (FIFO).
5. Onboarding seed: 10 points per chosen domain.
"""
import sys
from pathlib import Path

# Ensure ai-agent directory is on sys.path
_ai_agent_dir = Path(__file__).resolve().parent.parent.parent
if str(_ai_agent_dir) not in sys.path:
    sys.path.insert(0, str(_ai_agent_dir))

import pytest

from app.services.topic_mix_service import (
    apply_action_points,
    apply_lazy_decay,
    get_action_delta,
    normalize_mix,
    process_user_event_batch,
    seed_onboarding_mix,
    update_hidden_posts,
    DAILY_CLUSTER_CAP,
    MAX_HIDDEN_POSTS,
)


# ---------------------------------------------------------------------------
# Acceptance Criterion 1: Pure functions (Cap, Floor, Decay, Normalisation, Min Share)
# ---------------------------------------------------------------------------


def test_action_deltas():
    """Verify points table mapping."""
    assert get_action_delta("read") == 1
    assert get_action_delta("like") == 2
    assert get_action_delta("follow_author") == 3
    assert get_action_delta("save") == 4
    assert get_action_delta("comment") == 5
    assert get_action_delta("share") == 5
    assert get_action_delta("hide") == -5
    assert get_action_delta("not_interested") == -5
    assert get_action_delta("report") == -8

    with pytest.raises(ValueError, match="Unknown action"):
        get_action_delta("invalid_action")


def test_floor_rule():
    """Negative actions never take a cluster below 0."""
    pts, earned = apply_action_points(current_points=4.0, action="hide")
    assert pts == 0.0  # 4 - 5 = -1 -> floored at 0.0
    assert earned == 0.0

    # Even larger negative action floors at 0
    pts, _ = apply_action_points(current_points=2.0, action="report")
    assert pts == 0.0  # 2 - 8 = -6 -> floored at 0.0


def test_daily_cap_rule():
    """A cluster earns at most 15 points/day."""
    # 1. First comment gives +5
    pts, earned = apply_action_points(current_points=0.0, action="comment", points_earned_today=0.0)
    assert pts == 5.0
    assert earned == 5.0

    # 2. Second comment gives +5 (total 10)
    pts, earned = apply_action_points(current_points=pts, action="comment", points_earned_today=earned)
    assert pts == 10.0
    assert earned == 10.0

    # 3. Third comment gives +5 (total 15, reaches cap)
    pts, earned = apply_action_points(current_points=pts, action="comment", points_earned_today=earned)
    assert pts == 15.0
    assert earned == 15.0

    # 4. Fourth comment: daily cap reached, earns 0 points
    pts_capped, earned_capped = apply_action_points(
        current_points=pts, action="comment", points_earned_today=earned
    )
    assert pts_capped == 15.0  # No points added
    assert earned_capped == 15.0

    # 5. Partial fill: cluster already earned 13 pts today, save (+4) gives only +2
    pts_partial, earned_partial = apply_action_points(
        current_points=20.0, action="save", points_earned_today=13.0
    )
    assert pts_partial == 22.0  # 20 + min(4, 15 - 13) = 22.0
    assert earned_partial == 15.0


def test_lazy_decay_active_days():
    """
    Lazy decay: points * 0.5^(active days since update / 14).
    Only days the user opens the app count.
    """
    initial_points = 100.0

    # No active days elapsed -> no decay
    assert apply_lazy_decay(initial_points, active_days_elapsed=0) == 100.0

    # Exactly 14 active days -> points halved
    half = apply_lazy_decay(initial_points, active_days_elapsed=14)
    assert half == pytest.approx(50.0)

    # 28 active days -> points quartered
    quarter = apply_lazy_decay(initial_points, active_days_elapsed=28)
    assert quarter == pytest.approx(25.0)

    # 7 active days -> sqrt(0.5) ~ 70.71
    seven_days = apply_lazy_decay(initial_points, active_days_elapsed=7)
    assert seven_days == pytest.approx(100.0 * (0.5 ** 0.5))


def test_normalisation_and_min_share():
    """
    Recompute percentages to 100% and drop clusters under 3%.
    """
    # Cluster 1: 50 pts, Cluster 2: 48 pts, Cluster 3: 2 pts (total 100)
    # Raw shares: 50%, 48%, 2%.
    # Cluster 3 (2%) is under 3% -> must be dropped.
    raw = {1: 50.0, 2: 48.0, 3: 2.0}
    norm = normalize_mix(raw, min_share_pct=3.0)

    assert 3 not in norm
    assert 1 in norm and 2 in norm
    # Recomputed to 100%: 50/98 ~ 51.02%, 48/98 ~ 48.98%
    assert sum(norm.values()) == pytest.approx(100.0)
    assert norm[1] == pytest.approx(51.02, abs=0.05)
    assert norm[2] == pytest.approx(48.98, abs=0.05)


def test_normalisation_empty():
    """Empty or zero points dictionary returns empty mix."""
    assert normalize_mix({}) == {}
    assert normalize_mix({1: 0.0, 2: -5.0}) == {}


# ---------------------------------------------------------------------------
# Acceptance Criterion 2: Doc Example Reproduction
# ---------------------------------------------------------------------------


def test_doc_example_reproduction():
    """
    Criterion: The doc's example reproduces
    (runway 15% -> ~18%; luxury dropped after a hide).
    """
    # Setup initial state matching the doc:
    # Runway (cluster 1): 15 pts (15%)
    # Luxury (cluster 2): 4 pts (4%)
    # Other clusters (3, 4): 81 pts (81%)
    # Total = 100 pts
    initial_raw = {
        1: 15.0,  # Runway
        2: 4.0,   # Luxury
        3: 50.0,  # Other A
        4: 31.0,  # Other B
    }
    initial_mix = normalize_mix(initial_raw)
    assert initial_mix[1] == pytest.approx(15.0)
    assert initial_mix[2] == pytest.approx(4.0)
    assert 2 in initial_mix  # Luxury is present initially at 4%

    # User performs actions:
    # 1. Follow author / save on Runway (+3 points to Runway)
    # 2. Hide a Luxury post (-5 points to Luxury)
    events = [
        {"action": "follow_author", "clusterId": 1},  # +3 to Runway
        {"action": "hide", "clusterId": 2, "postId": "post_luxury_123"},  # -5 to Luxury
    ]

    result = process_user_event_batch(
        current_raw_points=initial_raw,
        events=events,
        current_daily_earned={},
        active_days_elapsed=0,
    )

    new_mix = result["normalized_mix"]

    # Invariant 1: Luxury dropped after a hide
    # (4 pts - 5 = 0 pts floored -> 0% < 3% threshold -> dropped)
    assert 2 not in new_mix, "Luxury cluster must be dropped after hide"

    # Invariant 2: Runway shifted from 15% to ~18%
    # Runway has 15 + 3 = 18 pts.
    # Total remaining points = 18 + 50 + 31 = 99 pts.
    # Runway percentage = 18 / 99 * 100 = 18.18% (~18%)
    assert new_mix[1] == pytest.approx(18.18, abs=0.2)
    assert 17.5 <= new_mix[1] <= 18.5, f"Runway expected ~18%, got {new_mix[1]}%"

    # Total percentages sum to 100%
    assert sum(new_mix.values()) == pytest.approx(100.0)


# ---------------------------------------------------------------------------
# Acceptance Criterion 3: user_mix Shape & Event Pipeline
# ---------------------------------------------------------------------------


def test_user_mix_shape_and_event_pipeline():
    """
    Criterion: user_mix shape matches the doc; updates driven by the event pipeline.
    """
    initial_raw = {10: 10.0, 20: 10.0}
    events = [
        {"action": "read", "clusterId": 10},
        {"action": "like", "clusterId": 10},
        {"action": "save", "clusterId": 20},
    ]

    res = process_user_event_batch(
        current_raw_points=initial_raw,
        events=events,
        current_daily_earned={},
        active_days_elapsed=1,
    )

    # Document shape checks
    assert "raw_points" in res
    assert "normalized_mix" in res
    assert "daily_earned" in res
    assert "hidden_post_ids" in res

    # 1 active day decayed 10.0 * 0.5^(1/14) = ~9.51 pts
    # Then cluster 10 got +1 (read) + 2 (like) = +3 pts
    # Cluster 20 got +4 (save)
    assert res["daily_earned"][10] == 3.0
    assert res["daily_earned"][20] == 4.0
    assert sum(res["normalized_mix"].values()) == pytest.approx(100.0)


def test_hidden_posts_negative_list_fifo():
    """Keep the last 50 hidden posts in FIFO order."""
    hidden = [f"post_{i}" for i in range(48)]

    # Add 4 more hidden posts (total 52)
    for i in range(48, 52):
        hidden = update_hidden_posts(hidden, f"post_{i}")

    assert len(hidden) == MAX_HIDDEN_POSTS
    assert hidden[0] == "post_2"  # post_0 and post_1 dropped
    assert hidden[-1] == "post_51"


def test_onboarding_seed():
    """Onboarding seed: 10 points to each chosen domain cluster."""
    chosen_clusters = [5, 12, 28]
    raw, norm = seed_onboarding_mix(chosen_clusters)

    assert raw == {5: 10.0, 12: 10.0, 28: 10.0}
    assert norm[5] == pytest.approx(33.33, abs=0.1)
    assert norm[12] == pytest.approx(33.33, abs=0.1)
    assert norm[28] == pytest.approx(33.33, abs=0.1)
    assert sum(norm.values()) == pytest.approx(100.0)


