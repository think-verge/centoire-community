"""Momentum: is a story breaking, rising, early, steady or settled?

Rules are set from how 610 stories spread over 4 days (2026-11-06 to 11-10):
- 83% never left their first website; 17 reached 5+ websites.
- Those 17 reached 3 websites a median 5.3h after the first. Of stories with 3 websites
  within 6h, half went on to 5+ (vs about 1 in 5 for 2 websites within 6h).
- A new website joins a story every ~4h (median); the last arrives a median 25h after the first.
Recheck the thresholds once a few weeks of continuous running are in.

  breaking  under 12h old and 3+ websites within 6h of the first
  rising    2+ new websites in the last 12h, under 3 days old
  early     1-2 websites, under 12h old, and a leak or first published by a source whose
            first stories often spread: 20%+ of the stories it published first reached 3+
            websites, at least twice with a 1h+ lead (measured 2026-11-10: Kicks On Fire 60%,
            Sneaker News 43%, Sneaker Bar Detroit 28%, Up To Date 24%; WWD 6%, Hypebeast 12%)
  steady    a new website in the last 24h
  settled   no new website in 24h
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.stories import _utc

TAGS = ("breaking", "rising", "early", "steady", "settled")
# Queue order: what's moving first.
RANK = {tag: i for i, tag in enumerate(TAGS)}

BREAKING_MAX_AGE = timedelta(hours=12)
BREAKING_WINDOW = timedelta(hours=6)
BREAKING_MIN_WEBSITES = 3
RISING_WINDOW = timedelta(hours=12)
RISING_MIN_NEW = 2
RISING_MAX_AGE = timedelta(days=3)
EARLY_MAX_AGE = timedelta(hours=12)
EARLY_MAX_WEBSITES = 2
STEADY_WINDOW = timedelta(hours=24)
# A source counts as "often first" when this many of the stories it published first reached
# 3+ websites with a 1h+ lead over the next site, and that is at least this share of them.
EARLY_SOURCE_MIN_FIRSTS = 2
EARLY_SOURCE_MIN_WEBSITES = 3
EARLY_SOURCE_MIN_LEAD = timedelta(hours=1)
EARLY_SOURCE_MIN_SHARE = 0.2


def website_times(story: dict) -> list[datetime]:
    return sorted(_utc(w["first_at"]) for w in story.get("websites", {}).values())


def momentum(story: dict, now: datetime, early_sources: set[str] = frozenset()) -> dict:
    """The story's tag, with the numbers behind it."""
    times = website_times(story)
    if not times:
        return {"tag": "settled", "reason": "no websites", "new6h": 0, "new24h": 0}
    first, n = times[0], len(times)
    age = now - first
    new6h = sum(t > now - timedelta(hours=6) for t in times)
    new12h = sum(t > now - RISING_WINDOW for t in times)
    new24h = sum(t > now - STEADY_WINDOW for t in times)
    out = {"new6h": new6h, "new24h": new24h}

    if age <= BREAKING_MAX_AGE and n >= BREAKING_MIN_WEBSITES and times[BREAKING_MIN_WEBSITES - 1] - first <= BREAKING_WINDOW:
        hours = (times[BREAKING_MIN_WEBSITES - 1] - first).total_seconds() / 3600
        return {**out, "tag": "breaking", "reason": f"{n} websites; the first 3 within {hours:.1f}h"}
    if age <= RISING_MAX_AGE and new12h >= RISING_MIN_NEW:
        return {**out, "tag": "rising", "reason": f"+{new12h} websites in the last 12h"}
    first_key = _first_key(story)
    if age <= EARLY_MAX_AGE and n <= EARLY_MAX_WEBSITES:
        if story.get("category") == "leak":
            return {**out, "tag": "early", "reason": "a leak, before it spreads"}
        if first_key in early_sources:
            name = (story.get("first") or {}).get("name") or first_key
            return {**out, "tag": "early", "reason": f"first from {name}, which has broken stories before"}
    if new24h:
        return {**out, "tag": "steady", "reason": f"+{new24h} websites in the last 24h"}
    hours = (now - times[-1]).total_seconds() / 3600
    return {**out, "tag": "settled", "reason": f"no new website for {hours:.0f}h"}


def _first_key(story: dict) -> str | None:
    sites = story.get("websites", {})
    if not sites:
        return None
    return min(sites, key=lambda k: _utc(sites[k]["first_at"]))


def early_sources(stories: list[dict]) -> set[str]:
    """Website keys whose first stories often go on to spread (see EARLY_SOURCE_*). `stories`
    must include the ones that didn't spread, or every prolific outlet would qualify."""
    firsts: dict[str, int] = {}
    broke: dict[str, int] = {}
    for s in stories:
        if not (key := _first_key(s)):
            continue
        firsts[key] = firsts.get(key, 0) + 1
        times = website_times(s)
        if len(times) >= EARLY_SOURCE_MIN_WEBSITES and times[1] - times[0] >= EARLY_SOURCE_MIN_LEAD:
            broke[key] = broke.get(key, 0) + 1
    return {k for k, b in broke.items()
            if b >= EARLY_SOURCE_MIN_FIRSTS and b / firsts[k] >= EARLY_SOURCE_MIN_SHARE}
