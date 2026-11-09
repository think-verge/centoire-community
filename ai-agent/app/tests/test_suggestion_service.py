"""
Unit and algorithmic tests for Ticket #107: Circle and Creator Suggestion Engine.

Acceptance criteria verified:
1. Worked examples reproduce (5.78 vs 3.30 for circles; 7.37 vs 3.53 for creators).
2. Filters, variety rules, and feedback effects tested.
3. Mix computation from 60 days of posts with 14-day half-life decay.
4. Cold start seeding and topic matching.
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List

_ai_agent_dir = Path(__file__).resolve().parent.parent.parent
if str(_ai_agent_dir) not in sys.path:
    sys.path.insert(0, str(_ai_agent_dir))

import pytest

from app.services.suggestion_parameters import (
    DEFAULT_SUGGESTION_PARAMS,
    SuggestionParameters,
)
from app.services.suggestion_service import (
    CircleCandidate,
    CreatorCandidate,
    SuggestionFeedbackStore,
    arrange_circles,
    arrange_creators,
    compute_mix_from_posts,
    compute_topic_match,
    filter_circles,
    filter_creators,
    generate_circle_reason,
    generate_circle_suggestions,
    generate_creator_reason,
    generate_creator_suggestions,
    quantize_friends_signal,
    score_circle,
    score_creator,
    seed_cold_start_mix,
)


# ---------------------------------------------------------------------------
# 1. Worked Examples Scoring (Acceptance Criterion)
# ---------------------------------------------------------------------------

def test_circle_worked_examples():
    """
    Acceptance Criterion:
    Circle worked examples reproduce strictly:
    - Circle A (High match, mutual friends): 5.78
    - Circle B (Lower match, no friends): 3.30
    Formula: 3 * match + 2 * friends + 1.5 * activity + 1 * engagement
    """
    # Circle A
    score_a, breakdown_a = score_circle(
        match=0.78,
        friends=0.67,
        activity=1.0,
        engagement=0.60,
    )
    assert score_a == 5.78, f"Expected 5.78, got {score_a}"
    assert breakdown_a["match"] == 2.34
    assert breakdown_a["friends"] == 1.34
    assert breakdown_a["activity"] == 1.50
    assert breakdown_a["engagement"] == 0.60

    # Circle B
    score_b, breakdown_b = score_circle(
        match=0.40,
        friends=0.00,
        activity=1.0,
        engagement=0.60,
    )
    assert score_b == 3.30, f"Expected 3.30, got {score_b}"
    assert breakdown_b["match"] == 1.20
    assert breakdown_b["friends"] == 0.00
    assert breakdown_b["activity"] == 1.50
    assert breakdown_b["engagement"] == 0.60


def test_creator_worked_examples():
    """
    Acceptance Criterion:
    Creator worked examples reproduce strictly:
    - Creator A (High engagement, high match, friends): 7.37
    - Creator B (Cold creator, no friends, no prior engagement): 3.53
    Formula: 3 * match + 3 * engaged + 2 * friends + 1 * active + 1 * engagement
    """
    # Creator A
    score_a, breakdown_a = score_creator(
        match=0.71,
        engaged=0.80,
        friends=0.67,
        active=1.0,
        engagement=0.50,
    )
    assert score_a == 7.37, f"Expected 7.37, got {score_a}"
    assert breakdown_a["match"] == 2.13
    assert breakdown_a["engaged"] == 2.40
    assert breakdown_a["friends"] == 1.34
    assert breakdown_a["active"] == 1.00
    assert breakdown_a["engagement"] == 0.50

    # Creator B
    score_b, breakdown_b = score_creator(
        match=0.71,
        engaged=0.00,
        friends=0.00,
        active=1.0,
        engagement=0.40,
    )
    assert score_b == 3.53, f"Expected 3.53, got {score_b}"
    assert breakdown_b["match"] == 2.13
    assert breakdown_b["engaged"] == 0.00
    assert breakdown_b["friends"] == 0.00
    assert breakdown_b["active"] == 1.00
    assert breakdown_b["engagement"] == 0.40


# ---------------------------------------------------------------------------
# 2. Topic Matching & Histogram Intersection
# ---------------------------------------------------------------------------

def test_topic_match_calculation():
    """Verify sum over clusters of min(member %, target %)."""
    user_mix = {1: 0.6, 2: 0.4}
    target_mix = {1: 0.5, 2: 0.3, 3: 0.2}

    # min(0.6, 0.5) = 0.5; min(0.4, 0.3) = 0.3; min(0, 0.2) = 0 -> total 0.8
    match_score = compute_topic_match(user_mix, target_mix)
    assert abs(match_score - 0.8) < 1e-5

    # Completely disjoint
    disjoint_mix = {5: 1.0}
    assert compute_topic_match(user_mix, disjoint_mix) == 0.0

    # Identical
    assert abs(compute_topic_match(user_mix, user_mix) - 1.0) < 1e-5


# ---------------------------------------------------------------------------
# 3. Friends Signal Quantization
# ---------------------------------------------------------------------------

def test_friends_signal_quantization():
    assert quantize_friends_signal(0) == 0.0
    assert quantize_friends_signal(1) == 0.33
    assert quantize_friends_signal(2) == 0.67
    assert quantize_friends_signal(3) == 1.0
    assert quantize_friends_signal(10) == 1.0


# ---------------------------------------------------------------------------
# 4. Mix Computation & 14-Day Half-Life Decay
# ---------------------------------------------------------------------------

def test_compute_mix_from_posts_with_decay():
    now = datetime(2026, 11, 6, 12, 0, 0, tzinfo=timezone.utc)

    # Post 1: Fresh today (age 0), cluster 1
    p1 = {
        "cluster_id": 1,
        "published_at": now,
        "upvotes": 5,
        "comments": 2,
    }
    # Post 2: 14 days ago (1 half-life = 0.5 decay), cluster 2
    p2 = {
        "cluster_id": 2,
        "published_at": now - timedelta(days=14),
        "upvotes": 5,
        "comments": 2,
    }
    # Post 3: 65 days ago (older than 60 days window) -> ignored
    p3 = {
        "cluster_id": 1,
        "published_at": now - timedelta(days=65),
        "upvotes": 100,
        "comments": 100,
    }

    mix = compute_mix_from_posts([p1, p2, p3], now=now)
    assert 1 in mix and 2 in mix
    # Cluster 1 post weight: (5*2 + 2*3 + 1) * 1.0 = 17.0
    # Cluster 2 post weight: (5*2 + 2*3 + 1) * 0.5 = 8.5
    # Total = 25.5 -> Cluster 1 share = 17/25.5 = ~0.6667, Cluster 2 share = 8.5/25.5 = ~0.3333
    assert mix[1] > mix[2]
    assert abs(mix[1] - 0.6667) < 0.01


def test_cold_start_mix_seeding():
    mix = seed_cold_start_mix([1, 2, 3, 4])
    assert len(mix) == 4
    assert mix[1] == 0.25
    assert sum(mix.values()) == 1.0


# ---------------------------------------------------------------------------
# 5. Negative Filters
# ---------------------------------------------------------------------------

def test_filter_circles():
    now = datetime(2026, 11, 6, 12, 0, 0, tzinfo=timezone.utc)
    feedback = SuggestionFeedbackStore()

    c_valid = CircleCandidate(id="c_valid", name="Active Circle", posts_30d=5, last_post_at=now)
    c_joined = CircleCandidate(id="c_joined", name="Already Joined", posts_30d=5, last_post_at=now)
    c_blocked = CircleCandidate(id="c_blocked", name="Blocked Circle", posts_30d=5, last_post_at=now)
    c_dismissed = CircleCandidate(id="c_dismissed", name="Dismissed Circle", posts_30d=5, last_post_at=now)
    c_inactive = CircleCandidate(id="c_inactive", name="Inactive Circle", posts_30d=0, last_post_at=now - timedelta(days=40))
    c_private_locked = CircleCandidate(id="c_priv", name="Private Circle", is_private=True, can_join=False, posts_30d=5, last_post_at=now)
    c_private_joinable = CircleCandidate(id="c_priv_ok", name="Private Invited", is_private=True, can_join=True, posts_30d=5, last_post_at=now)

    feedback.record_dismiss("u1", "c_dismissed", now=now)

    filtered = filter_circles(
        circles=[c_valid, c_joined, c_blocked, c_dismissed, c_inactive, c_private_locked, c_private_joinable],
        user_id="u1",
        member_circle_ids={"c_joined"},
        blocked_or_muted_ids={"c_blocked"},
        now=now,
        feedback=feedback,
    )

    filtered_ids = {c.id for c in filtered}
    assert "c_valid" in filtered_ids
    assert "c_priv_ok" in filtered_ids
    assert "c_joined" not in filtered_ids
    assert "c_blocked" not in filtered_ids
    assert "c_dismissed" not in filtered_ids
    assert "c_inactive" not in filtered_ids
    assert "c_priv" not in filtered_ids


def test_filter_creators():
    now = datetime(2026, 11, 6, 12, 0, 0, tzinfo=timezone.utc)
    feedback = SuggestionFeedbackStore()

    cr_valid = CreatorCandidate(id="cr_1", handle="valid", posts_30d=5, last_post_at=now)
    cr_followed = CreatorCandidate(id="cr_2", handle="followed", posts_30d=5, last_post_at=now)
    cr_self = CreatorCandidate(id="u1", handle="self", posts_30d=5, last_post_at=now)
    cr_blocked = CreatorCandidate(id="cr_4", handle="blocked", posts_30d=5, last_post_at=now)
    cr_dismissed = CreatorCandidate(id="cr_5", handle="dismissed", posts_30d=5, last_post_at=now)
    cr_inactive = CreatorCandidate(id="cr_6", handle="inactive", posts_30d=0, last_post_at=now - timedelta(days=45))

    feedback.record_dismiss("u1", "cr_5", now=now)

    filtered = filter_creators(
        creators=[cr_valid, cr_followed, cr_self, cr_blocked, cr_dismissed, cr_inactive],
        user_id="u1",
        followed_ids={"cr_2"},
        blocked_or_muted_ids={"cr_4"},
        now=now,
        feedback=feedback,
    )

    filtered_ids = {c.id for c in filtered}
    assert "cr_1" in filtered_ids
    assert "cr_2" not in filtered_ids
    assert "u1" not in filtered_ids
    assert "cr_4" not in filtered_ids
    assert "cr_5" not in filtered_ids
    assert "cr_6" not in filtered_ids


# ---------------------------------------------------------------------------
# 6. Variety Rules (Max 2 Cluster Run, 1 in 4 Emerging Creators)
# ---------------------------------------------------------------------------

def test_variety_cluster_consecutive_limit():
    """Verify max 2 in a row from one cluster for circles."""
    candidates = [
        CircleCandidate(id=f"c_{i}", name=f"Circle {i}", cluster_id=1, score=10.0 - i)
        for i in range(4)
    ]
    # Add cluster 2 candidates to interleave
    candidates.append(CircleCandidate(id="c_diff1", name="Circle Different 1", cluster_id=2, score=8.5))
    candidates.append(CircleCandidate(id="c_diff2", name="Circle Different 2", cluster_id=2, score=7.5))

    arranged = arrange_circles(candidates, limit=6)
    clusters = [c.cluster_id for c in arranged]

    # Must not have 3 cluster 1s consecutively
    for i in range(len(clusters) - 2):
        assert not (clusters[i] == clusters[i+1] == clusters[i+2] == 1)



def test_variety_emerging_creator_interval():
    """Verify at least 1 in 4 suggestions is for an emerging creator."""
    std_creators = [
        CreatorCandidate(id=f"top_{i}", handle=f"top_{i}", follower_count=5000, score=20.0 - i, is_emerging=False)
        for i in range(10)
    ]
    emerging_creators = [
        CreatorCandidate(id=f"new_{i}", handle=f"new_{i}", follower_count=40, score=10.0 - i, is_emerging=True)
        for i in range(5)
    ]

    all_creators = std_creators + emerging_creators
    arranged = arrange_creators(all_creators, limit=8)

    # Position 4 and Position 8 (1-based, indices 3 and 7) should be emerging creators
    assert arranged[3].is_emerging is True
    assert arranged[7].is_emerging is True


# ---------------------------------------------------------------------------
# 7. Feedback Effects: Join/Follow (+3 pts), Dismiss (30d), Ignore 3x (14d)
# ---------------------------------------------------------------------------

def test_feedback_effects():
    feedback = SuggestionFeedbackStore()
    now = datetime(2026, 11, 6, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Join / Follow (+3 topic points)
    delta = feedback.record_follow_or_join(user_id="u1", target_top_clusters=[2, 4])
    assert delta == {2: 1.5, 4: 1.5}
    assert sum(delta.values()) == 3.0

    # 2. Dismiss (30 days)
    dismiss_until = feedback.record_dismiss("u1", "target_dismiss", now=now)
    assert dismiss_until == now + timedelta(days=30)
    assert feedback.is_hidden("u1", "target_dismiss", now + timedelta(days=10)) is True
    assert feedback.is_hidden("u1", "target_dismiss", now + timedelta(days=31)) is False

    # 3. Ignore 3 times (14 days)
    # Ignore 1st time
    cnt, until = feedback.record_ignore("u1", "target_ignore", now=now)
    assert cnt == 1 and until is None
    assert feedback.is_hidden("u1", "target_ignore", now) is False

    # Ignore 2nd time
    cnt, until = feedback.record_ignore("u1", "target_ignore", now=now)
    assert cnt == 2 and until is None
    assert feedback.is_hidden("u1", "target_ignore", now) is False

    # Ignore 3rd time -> triggered 14 days hide
    cnt, until = feedback.record_ignore("u1", "target_ignore", now=now)
    assert cnt == 3
    assert until == now + timedelta(days=14)
    assert feedback.is_hidden("u1", "target_ignore", now + timedelta(days=5)) is True
    assert feedback.is_hidden("u1", "target_ignore", now + timedelta(days=15)) is False


# ---------------------------------------------------------------------------
# 8. Reason Lines
# ---------------------------------------------------------------------------

def test_reason_generation():
    # Circle reasons
    c1 = CircleCandidate(id="c1", name="C1", mutual_friend_count=3, cluster_id=1)
    assert generate_circle_reason(c1, 1.0, 0.5) == "3 friends are members"

    c2 = CircleCandidate(id="c2", name="C2", mutual_friend_count=0, cluster_id=5)
    assert generate_circle_reason(c2, 0.0, 0.7, cluster_names={5: "Streetwear"}) == "Matches your interest in Streetwear"

    # Creator reasons
    cr1 = CreatorCandidate(id="cr1", handle="cr1", already_engaged_score=0.8)
    assert generate_creator_reason(cr1, 0.0, 0.5) == "You've engaged with their posts recently"

    cr2 = CreatorCandidate(id="cr2", handle="cr2", mutual_friend_count=2)
    assert generate_creator_reason(cr2, 0.67, 0.4) == "Followed by 2 people you follow"

    cr3 = CreatorCandidate(id="cr3", handle="cr3", is_emerging=True, cluster_id=8)
    assert generate_creator_reason(cr3, 0.0, 0.4, cluster_names={8: "Runway"}) == "Rising creator in Runway"


# ---------------------------------------------------------------------------
# 9. FastAPI Router Registration & Schemas
# ---------------------------------------------------------------------------

def test_suggestions_router_and_schemas():
    from app.api.v1.suggestions import (
        router,
        CircleSuggestionSchema,
        CreatorSuggestionSchema,
        SuggestionsFeedbackRequest,
        get_parameters,
    )

    route_paths = {route.path for route in router.routes}
    assert "/v1/suggestions/circles/{user_id}" in route_paths
    assert "/v1/suggestions/creators/{user_id}" in route_paths
    assert "/v1/suggestions/feedback" in route_paths
    assert "/v1/suggestions/parameters" in route_paths

    params = get_parameters()
    assert params["CIRCLE_WEIGHT_MATCH"] == 3.0
    assert params["CREATOR_WEIGHT_MATCH"] == 3.0
    assert params["DISMISS_HIDE_DAYS"] == 30
    assert params["IGNORE_HIDE_DAYS"] == 14

    fb_req = SuggestionsFeedbackRequest(
        userId="u1",
        targetId="c1",
        targetType="circle",
        action="dismiss",
    )
    assert fb_req.action == "dismiss"

    c_schema = CircleSuggestionSchema(
        id="c1",
        name="Circle 1",
        score=5.78,
        reason="2 friends are members",
    )
    assert c_schema.score == 5.78
