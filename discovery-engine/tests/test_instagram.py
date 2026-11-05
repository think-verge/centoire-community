import json
import time

import httpx
import pytest

from app.config import Settings
from app.instagram import InstagramClient, InstagramError, InstagramSkipped, parse_business_discovery
from app.sources import load_instagram, planned_instagram_calls_per_hour
from app.config import REPO_ROOT

TOKEN = "SECRET-TOKEN-123"

PAYLOAD = {
    "business_discovery": {
        "username": "zsneakerheadz",
        "followers_count": 512000,
        "media_count": 9000,
        "media": {"data": [
            {
                "id": "1",
                "caption": "\nFirst look 👀 Nigel Sylvester x Air Jordan 6 \"Grey Fog\"\n"
                           "via @nigelsylvester @Jumpman23 #airjordan6 #sneakerleaks",
                "media_type": "CAROUSEL_ALBUM",
                "media_product_type": "FEED",
                "permalink": "https://www.instagram.com/p/ABC123/",
                "timestamp": "2026-11-05T09:15:00+0000",
                "like_count": 4100,
                "comments_count": 230,
                "media_url": "https://cdn.example/1.jpg",
            },
            {
                "id": "2",
                "media_type": "VIDEO",
                "permalink": "https://www.instagram.com/reel/XYZ/",
                "timestamp": "2026-11-05T08:00:00+0000",
                "thumbnail_url": "https://cdn.example/2-thumb.jpg",
            },
        ]},
    }
}


def settings(**overrides) -> Settings:
    s = Settings()
    s.ig_user_id, s.ig_access_token = "17841400000000000", TOKEN
    for k, v in overrides.items():
        setattr(s, k, v)
    return s


def mock_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_parse_business_discovery():
    first, reel = parse_business_discovery(PAYLOAD["business_discovery"])
    assert first.title == 'First look 👀 Nigel Sylvester x Air Jordan 6 "Grey Fog"'
    assert first.published_at.isoformat() == "2026-11-05T09:15:00+00:00"
    assert first.publisher == "@zsneakerheadz"
    assert first.extra["mentions"] == ["jumpman23", "nigelsylvester"]
    assert first.extra["hashtags"] == ["airjordan6", "sneakerleaks"]
    assert first.extra["like_count"] == 4100 and first.extra["followers"] == 512000
    # No caption: a readable fallback title, and the thumbnail for videos.
    assert reel.title == "@zsneakerheadz posted a new video"
    assert reel.image_url == "https://cdn.example/2-thumb.jpg"


async def test_fetch_success_records_usage_and_sends_fields():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["fields"] = request.url.params["fields"]
        return httpx.Response(200, json=PAYLOAD,
                              headers={"x-app-usage": json.dumps({"call_count": 12, "total_time": 3})})

    ig = InstagramClient(settings())
    async with mock_client(handler) as client:
        items = await ig.fetch(client, "zsneakerheadz")
    assert len(items) == 2
    assert seen["fields"].startswith("business_discovery.username(zsneakerheadz){")
    assert "media.limit(12){" in seen["fields"]
    assert ig.last_usage == {"call_count": 12, "total_time": 3}
    assert ig.calls_last_hour() == 1 and ig.paused_until == 0


async def test_throttling_error_pauses_and_never_leaks_token():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"code": 4, "message": "Application request limit reached"}})

    ig = InstagramClient(settings())
    async with mock_client(handler) as client:
        with pytest.raises(InstagramError) as exc:
            await ig.fetch(client, "nike")
        assert exc.value.throttled and TOKEN not in str(exc.value)
        assert ig.paused_until > time.time() + 1700
        with pytest.raises(InstagramSkipped):
            await ig.fetch(client, "nike")


async def test_high_usage_header_pauses():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=PAYLOAD, headers={"x-app-usage": json.dumps({"call_count": 80})})

    ig = InstagramClient(settings())
    async with mock_client(handler) as client:
        await ig.fetch(client, "nike")
    assert ig.paused_until > time.time() + 800


async def test_network_error_message_has_no_token():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"failed for {request.url}")

    ig = InstagramClient(settings())
    async with mock_client(handler) as client:
        with pytest.raises(InstagramError) as exc:
            await ig.fetch(client, "nike")
    assert TOKEN not in str(exc.value)


async def test_hourly_budget_is_enforced():
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=PAYLOAD)

    ig = InstagramClient(settings(ig_max_calls_per_hour=2))
    async with mock_client(handler) as client:
        await ig.fetch(client, "a")
        await ig.fetch(client, "b")
        with pytest.raises(InstagramSkipped):
            await ig.fetch(client, "c")
    assert calls == 2


def test_seed_watchlist_fits_budget():
    s = settings()
    accounts = load_instagram(REPO_ROOT / "instagram.yaml")
    assert len(accounts) >= 50
    assert all(a.id == f"ig-{a.handle}" for a in accounts)
    assert planned_instagram_calls_per_hour(s, accounts) <= s.ig_max_calls_per_hour
