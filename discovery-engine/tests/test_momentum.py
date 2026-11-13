from datetime import datetime, timedelta, timezone

from app.momentum import early_sources, momentum

NOW = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)


def story(hours_ago: list[float], category="collab", first_key=None):
    sites = {}
    for i, h in enumerate(hours_ago):
        key = first_key if (i == 0 and first_key) else f"site{i}"
        sites[key] = {"name": key.title(), "first_at": NOW - timedelta(hours=h)}
    return {"websites": sites, "website_count": len(sites), "category": category, "first": {"name": "First"}}


def tag(s, sources=frozenset()):
    return momentum(s, NOW, set(sources))["tag"]


def test_breaking_needs_three_websites_fast_and_a_young_story():
    assert tag(story([5, 4, 2])) == "breaking"  # 3 websites within 3h, 5h old
    assert tag(story([11, 10, 3])) == "rising"  # 3rd website came 8h after the first: not breaking
    assert tag(story([30, 29, 28])) != "breaking"  # too old


def test_rising_steady_settled():
    assert tag(story([40, 10, 5])) == "rising"  # 2 new websites in the last 12h
    assert tag(story([40, 20])) == "steady"  # one new website in the last 24h
    assert tag(story([72, 50])) == "settled"
    assert momentum(story([72, 50]), NOW)["reason"] == "no new website for 50h"


def test_early_for_leaks_and_sources_that_broke_stories_before():
    assert tag(story([3], category="leak")) == "early"
    assert tag(story([3], first_key="uptodate"), {"uptodate"}) == "early"
    assert tag(story([3], first_key="someblog"), {"uptodate"}) == "steady"
    assert tag(story([20], category="leak")) == "steady"  # no longer early after 12h


def test_sources_count_as_early_when_their_first_stories_often_spread():
    spread = lambda key: story([30, 20, 10], first_key=key)  # 10h lead, 3 websites
    alone = lambda key: story([30], first_key=key)
    stories = [spread("uptodate"), spread("uptodate"), alone("uptodate"),        # 2 of 3 spread
               spread("wwd"), spread("wwd")] + [alone("wwd") for _ in range(20)]  # 2 of 22: prolific, rarely first
    stories += [story([30, 29.9, 10], first_key="tie"), story([30, 29.9, 10], first_key="tie")]  # no 1h lead
    assert early_sources(stories) == {"uptodate"}
