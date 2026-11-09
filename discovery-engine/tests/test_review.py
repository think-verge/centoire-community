from datetime import datetime, timedelta, timezone

from app.models import Source
from app.review import ReviewBridge, app_source_to_engine, story_payload

T0 = datetime(2026, 11, 7, 1, 29, tzinfo=timezone.utc)


def story(sid="s1", websites=3, category="collab", review=None):
    sites = {f"site{i}": {"name": f"Site {i}", "first_at": T0 + timedelta(hours=i), "url": f"https://site{i}.com/a",
                          "title": "t", "articles": 1} for i in range(websites)}
    doc = {"_id": sid, "headline": "Corteiz and Nike announce the Shox R4.", "category": category,
           "first_at": T0, "last_at": T0 + timedelta(hours=websites), "website_count": websites,
           "article_count": websites + 1, "websites": sites, "markets": ["US", "JP"],
           "first": {"name": "Site 0", "url": "https://site0.com/a", "at": T0},
           "seen_live_at": T0 + timedelta(minutes=10)}
    if review:
        doc["review"] = review
    return doc


ARTICLES = [
    {"url": "https://news.google.com/rss/articles/abc", "title": "GN copy", "summary": "",
     "published_at": T0 - timedelta(minutes=5), "first_seen_at": T0, "regions": ["IN"], "image_url": None},
    {"url": "https://sneakerbardetroit.com/corteiz", "title": "Corteiz x Nike Shox R4",
     "summary": "First look.", "published_at": T0, "first_seen_at": T0, "regions": ["US"],
     "image_url": "https://img/1.jpg"},
]


def test_payload_links_the_earliest_direct_article_with_the_evidence():
    p = story_payload(story(), ARTICLES)
    assert p["title"] == "Corteiz and Nike announce the Shox R4"
    assert p["externalUrl"] == "https://sneakerbardetroit.com/corteiz"  # not the Google News redirect
    assert p["coverImageUrl"] == "https://img/1.jpg" and p["country"] == "US"
    d = p["discovery"]
    assert d["websiteCount"] == 3 and d["firstPublished"]["name"] == "Site 0"
    assert [s["name"] for s in d["spread"]] == ["Site 0", "Site 1", "Site 2"]
    assert d["engineSawAt"].startswith("2026-11-07T01:39")


def test_app_sources_map_to_engine_sources():
    src = app_source_to_engine({"id": "abc", "name": "Fashionsnap", "feedUrl": "https://www.fashionsnap.com/rss",
                                "kind": "rss", "region": "jp", "review": "approved", "active": True})
    assert (src.id, src.type, src.region, src.role) == ("app-abc", "rss", "JP", "discovered")
    page = app_source_to_engine({"id": "p", "name": "Nike News", "feedUrl": "https://about.nike.com/en/newsroom",
                                 "kind": "page", "active": True})
    assert page.include_url == [r"about\.nike\.com/.+/.+"]
    assert app_source_to_engine({"id": "d", "name": "x", "feedUrl": "discovery://centoire", "kind": "discovery"}) is None


class FakeApp:
    def __init__(self, sources=(), decisions=()):
        self.posted, self.suggested = [], []
        self._sources, self._decisions = list(sources), list(decisions)

    async def post_story(self, payload):
        self.posted.append(payload)
        return {"postId": f"post-{payload['storyId']}", "status": "pending_review", "created": True}

    async def decisions(self, since):
        return [d for d in self._decisions if d["reviewedAt"] > since.isoformat()]

    async def sources(self):
        return self._sources

    async def suggest_source(self, payload):
        self.suggested.append(payload)
        return {}


class FakeStore:
    def __init__(self, stories):
        self.stories = {s["_id"]: s for s in stories}
        self.state = {}

    async def stories_for_review(self, *, since, min_websites):
        return [s for s in self.stories.values()
                if s["website_count"] >= min_websites or s["category"] == "leak"]

    async def story_articles(self, sid):
        return ARTICLES

    async def set_story_review(self, sid, review, merge=False):
        s = self.stories[sid]
        s["review"] = {**s.get("review", {}), **review} if merge else review

    async def get_state(self, key):
        return self.state.get(key)

    async def set_state(self, key, value):
        self.state[key] = value


class FakePoller:
    def __init__(self, store, sources=()):
        self.store = store
        self.all_sources = list(sources)
        self.added, self.removed = [], []

    def add_source(self, s):
        self.all_sources.append(s)
        self.added.append(s.id)

    def remove_source(self, sid):
        self.all_sources = [s for s in self.all_sources if s.id != sid]
        self.removed.append(sid)


async def test_push_sends_new_and_grown_stories_only():
    store = FakeStore([story("big", 3), story("small", 1), story("leak", 1, category="leak"),
                       story("done", 5, review={"status": "published", "pushed_websites": 2})])
    app = FakeApp()
    bridge = ReviewBridge(FakePoller(store), app)
    assert await bridge.push_stories() == 2
    assert sorted(p["storyId"] for p in app.posted) == ["big", "leak"]
    assert store.stories["big"]["review"]["pushed_websites"] == 3
    assert await bridge.push_stories() == 0  # nothing changed
    store.stories["big"]["website_count"] = 6  # spread further while still pending
    assert await bridge.push_stories() == 1


async def test_decisions_come_back_onto_stories():
    store = FakeStore([story("s1", review={"status": "pending_review", "pushed_websites": 3})])
    app = FakeApp(decisions=[{"storyId": "s1", "postId": "p1", "status": "rejected",
                              "reviewedAt": "2026-11-10T10:00:00+00:00", "rejectionReason": "Not news",
                              "byEditor": True}])
    bridge = ReviewBridge(FakePoller(store), app)
    assert await bridge.pull_decisions() == 1
    review = store.stories["s1"]["review"]
    assert review["status"] == "rejected" and review["reason"] == "Not news" and review["pushed_websites"] == 3
    assert await bridge.pull_decisions() == 0  # cursor moved past it


async def test_sync_watches_active_app_sources_and_drops_paused_ones():
    own = Source(id="hypebeast", name="Hypebeast", type="rss", region="US", role="publisher",
                 url="https://hypebeast.com/feed")
    poller = FakePoller(FakeStore([]), [own])
    app = FakeApp(sources=[
        {"id": "a", "name": "Fashionsnap", "feedUrl": "https://www.fashionsnap.com/rss", "kind": "rss", "active": True},
        {"id": "b", "name": "Dup", "feedUrl": "https://hypebeast.com/feed", "kind": "rss", "active": True},
        {"id": "c", "name": "Suggested", "feedUrl": "https://x.com/feed", "kind": "rss", "active": False,
         "review": "suggested"},
    ])
    bridge = ReviewBridge(poller, app)
    await bridge.sync_sources()
    assert poller.added == ["app-a"]  # the duplicate of a source we already watch is skipped
    assert "https://x.com/feed" in bridge.known_feeds  # suggested ones are never suggested again
    app._sources[0]["active"] = False
    await bridge.sync_sources()
    assert poller.removed == ["app-a"]


async def test_origin_suggestion_goes_to_the_app():
    app = FakeApp()
    bridge = ReviewBridge(FakePoller(FakeStore([])), app)
    src = Source(id="ig-acgtaiwan", name="@acgtaiwan", type="instagram", region="TW", role="discovered",
                 url="https://www.instagram.com/acgtaiwan/")
    assert await bridge.suggest_origin(src, "Credited by 2 publishers", ["SBD: Photos: acgtaiwan"])
    assert app.suggested[0]["kind"] == "instagram" and app.suggested[0]["region"] == "TW"
    assert not await bridge.suggest_origin(src, "again", [])  # once only
