import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.internal_api import router
from app.models import Source
from app.registration import Registration

T0 = datetime(2026, 11, 7, 1, 0, tzinfo=timezone.utc)
H = {"x-internal-secret": "dev-internal-secret"}


class FakeStore:
    def __init__(self, stories):
        self.stories = stories

    async def queued_stories(self, since, limit):
        rows = [s for s in self.stories if s["review"]["queued_at"] > since
                and s["review"]["status"] == "pending_review"]
        rows.sort(key=lambda s: s["review"]["queued_at"])
        return rows[:limit]


def row(sid, minutes, status="pending_review"):
    return {"_id": sid, "review": {"status": status, "queued_at": T0 + timedelta(minutes=minutes),
                                   "payload": {"storyId": sid, "title": sid}}}


class FakeBridge:
    async def prepare_stories(self):
        return 2


class FakePoller:
    def __init__(self):
        self.sources = [Source(id="app-abc", name="X", type="rss", url="https://x/rss", region="US", role="publisher")]
        self.all_sources = self.sources
        self.stories = None
        self.review = FakeBridge()
        self.polled = []

    def http_client(self):
        return object()

    async def poll_once(self, client, s):
        self.polled.append(s.id)
        return 3


def client(stories=()):
    app = FastAPI()
    app.include_router(router)
    app.state.store = FakeStore(list(stories))
    app.state.poller = FakePoller()
    return TestClient(app)


def test_secret_is_required_on_every_route():
    c = client()
    for method, path in (("get", "/queue"), ("post", "/fetch"), ("get", "/health")):
        assert getattr(c, method)("/internal/discovery-engine" + path).status_code == 401
        assert getattr(c, method)("/internal/discovery-engine" + path, headers={"x-internal-secret": "no"}).status_code == 401
    assert c.get("/internal/discovery-engine/health", headers=H).json() == {"ok": True}


def test_secret_comes_from_the_environment(monkeypatch):
    monkeypatch.setenv("ENGINE_INTERNAL_SECRET", "s3")
    c = client()
    assert c.get("/internal/discovery-engine/health", headers=H).status_code == 401
    assert c.get("/internal/discovery-engine/health", headers={"x-internal-secret": "s3"}).status_code == 200


def test_queue_orders_oldest_first_and_pages_with_since_and_limit():
    c = client([row("c", 30), row("a", 10), row("b", 20), row("gone", 15, status="published")])
    body = c.get("/internal/discovery-engine/queue", headers=H).json()
    assert [i["storyId"] for i in body["items"]] == ["a", "b", "c"]  # decided "gone" excluded
    assert body["items"][0]["payload"] == {"storyId": "a", "title": "a"}
    assert body["nextSince"] == body["items"][-1]["queuedAt"]
    page = c.get("/internal/discovery-engine/queue", params={"limit": 2}, headers=H).json()
    assert [i["storyId"] for i in page["items"]] == ["a", "b"]
    rest = c.get("/internal/discovery-engine/queue", params={"since": page["nextSince"]}, headers=H).json()
    assert [i["storyId"] for i in rest["items"]] == ["c"]
    empty = c.get("/internal/discovery-engine/queue", params={"since": rest["nextSince"]}, headers=H).json()
    assert empty == {"items": [], "nextSince": rest["nextSince"]}
    assert c.get("/internal/discovery-engine/queue", params={"limit": 500}, headers=H).status_code == 422


def test_fetch_unknown_source_is_404_and_known_one_polls():
    c = client()
    r = c.post("/internal/discovery-engine/fetch", json={"sourceId": "nope"}, headers=H)
    assert r.status_code == 404 and r.json() == {"detail": "unknown source"}
    r = c.post("/internal/discovery-engine/fetch", json={"sourceId": "abc"}, headers=H)
    assert r.json() == {"polled": 1, "newItems": 3, "queued": 2}
    assert c.post("/internal/discovery-engine/fetch", headers=H).json()["polled"] == 1  # all sources


class FakeNats:
    def __init__(self):
        self.sent = []

    async def publish(self, subject, data):
        self.sent.append((subject, json.loads(data)))

    async def flush(self, timeout=None):
        pass

    async def close(self):
        pass


async def test_registration_hello_and_goodbye_shape():
    nc = FakeNats()

    async def connect(url, **kw):
        return nc

    reg = Registration("nats://x", address="http://engine:8090", connect=connect)
    await reg._publish("hello")
    await reg.stop()
    (subj, hello), (_, bye) = nc.sent
    assert subj == "gateway.services" and hello["type"] == "hello" and bye["type"] == "goodbye"
    assert hello["name"] == "discovery" and hello["address"] == "http://engine:8090"
    assert hello["routes"] == [{"path": "/internal/discovery-engine", "private": True}]
    assert hello["load"] == 0 and isinstance(hello["sentAt"], int) and hello["instanceId"] == bye["instanceId"]


async def test_registration_survives_an_unreachable_nats():
    import asyncio

    async def connect(url, **kw):
        raise OSError("down")

    reg = Registration("nats://x", connect=connect)
    await reg.start()
    await asyncio.sleep(0.05)
    await reg.stop()  # no exception
