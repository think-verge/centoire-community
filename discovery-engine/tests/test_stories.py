import json
import re
from datetime import datetime, timedelta, timezone

from app.models import Source
from app.stories import StoryBuilder, Websites, item_time

T0 = datetime(2026, 11, 6, 0, 0, tzinfo=timezone.utc)

SOURCES = [
    Source(id="sneakernews", name="Sneaker News", type="rss", region="US", role="publisher",
           url="https://sneakernews.com/feed/"),
    Source(id="hypebeast-kr", name="Hypebeast Korea", type="rss", region="KR", role="publisher",
           url="https://hypebeast.kr/feed"),
    Source(id="hypebeast", name="Hypebeast", type="rss", region="US", role="publisher",
           url="https://hypebeast.com/feed"),
    Source(id="gn-in", name="Google News India: sneakers", type="rss", region="IN", role="aggregator",
           url="https://news.google.com/rss/search?q=sneakers"),
    Source(id="reddit", name="Reddit", type="reddit", region="US", role="community",
           url="https://www.reddit.com/r/Sneakers/new/.rss"),
]


def doc(key, source_id, title, minutes, publisher=None, **extra):
    return {"key": key, "source_id": source_id, "title": title, "url": f"https://x/{key}",
            "publisher": publisher, "published_at": T0 + timedelta(minutes=minutes),
            "first_seen_at": T0 + timedelta(minutes=minutes + 5), "regions": ["US"], "baseline": False,
            "extra": extra}


def test_website_identity():
    w = Websites(SOURCES)
    assert w.of(doc("a", "hypebeast-kr", "x", 0)) == ("hypebeast", "Hypebeast Korea")
    assert w.of(doc("b", "gn-in", "x", 0, publisher="Sneaker News")) == ("sneakernews", "Sneaker News")
    assert w.of(doc("c", "gn-in", "x", 0, publisher="Men's Journal"))[0] == "mensjournal"
    assert w.of(doc("d", "gn-in", "x", 0, publisher="GQ", publisher_url="https://www.gq-magazine.co.uk"))[0] == \
        "gq-magazine"
    assert w.of(doc("e", "gn-in", "x", 0, publisher="www.auroradesio.it")) == ("auroradesio", "auroradesio.it")
    assert w.of(doc("g", "gn-in", "x", 0, publisher="https://latination.com/")) == ("latination", "latination.com")
    assert w.of(doc("f", "reddit", "x", 0)) == ("reddit", "Reddit")


def test_item_time_never_later_than_first_seen():
    d = doc("a", "sneakernews", "x", 0)
    d["published_at"] = d["first_seen_at"] + timedelta(hours=3)  # a feed claiming a future time
    assert item_time(d) == d["first_seen_at"]


class FakeStore:
    def __init__(self, items):
        self.items = {d["key"]: d for d in items}
        self.stories = {}

    async def untriaged_items(self, limit):
        return [d for d in self.items.values() if "triage" not in d][:limit]

    async def set_item_story(self, key, triage, story_id):
        self.items[key].update(triage=triage, story_id=story_id)

    async def get_story(self, sid):
        return self.stories.get(sid)

    async def save_story(self, story):
        self.stories[story["_id"]] = story

    async def stories_since(self, since):
        return list(self.stories.values())


class FakeGemini:
    """Triage: titles containing 'deal' are irrelevant; headline = title. Embedding: one axis per
    topic word. Match: articles sharing a topic word with a candidate join it, else group by topic."""
    TOPICS = ["gta", "marni", "rose"]

    async def generate_json(self, prompt, schema, model=None):
        lines = [json.loads(line) for line in prompt.splitlines() if line.startswith("{")]
        if "triage" in prompt:
            return [{"id": r["id"], "relevant": "deal" not in r["title"].lower(), "category": "collab",
                     "headline": r["title"], "entities": []} for r in lines]
        stories = dict(re.findall(r"^(S\d+): (.*)$", prompt, re.M))
        out = []
        for r in lines:
            topic = self._topic(r["headline"])
            match = next((s for s in r["closest"] if self._topic(stories[s]) == topic), None)
            out.append({"id": r["id"], "story": match or f"N{self.TOPICS.index(topic) + 1}"})
        return out

    async def embed(self, texts):
        return [[1.0 if t == self._topic(x) else 0.01 for t in self.TOPICS] for x in texts]

    def _topic(self, text):
        return next(t for t in self.TOPICS if t in text.lower())


async def test_articles_group_into_stories_with_their_spread():
    store = FakeStore([
        doc("1", "hypebeast", "First look: Travis Scott GTA AF1", 0),
        doc("2", "hypebeast-kr", "트래비스 스캇 GTA 에어포스 1", 30),
        doc("3", "sneakernews", "Travis Scott reveals GTA Air Force 1", 60),
        doc("4", "gn-in", "Hoka x Marni Clifton 11", 70, publisher="WWD"),
        doc("5", "gn-in", "Best sneaker deal of the week: GTA", 80, publisher="Shop Blog"),
    ])
    builder = StoryBuilder(store, FakeGemini(), SOURCES)
    assert await builder.run_pass() == 5
    assert await builder.run_pass() == 0  # nothing left untriaged

    assert store.items["5"]["story_id"] is None and store.items["5"]["triage"]["relevant"] is False
    gta = store.stories[store.items["1"]["story_id"]]
    assert store.items["2"]["story_id"] == store.items["3"]["story_id"] == gta["_id"]
    assert gta["article_count"] == 3
    assert gta["website_count"] == 2  # Hypebeast's English and Korean editions are one website
    assert gta["first"]["name"] == "Hypebeast" and gta["first"]["at"] == T0
    assert gta["websites"]["sneakernews"]["first_at"] == T0 + timedelta(minutes=60)
    assert len(store.stories) == 2


async def test_later_article_joins_existing_story_in_a_new_pass():
    store = FakeStore([doc("1", "hypebeast", "Martine Rose to Balenciaga", 0)])
    builder = StoryBuilder(store, FakeGemini(), SOURCES)
    await builder.run_pass()
    store.items["2"] = doc("2", "sneakernews", "Martine Rose named Balenciaga creative director", 600)
    await builder.run_pass()
    [story] = store.stories.values()
    assert story["article_count"] == 2 and story["website_count"] == 2
