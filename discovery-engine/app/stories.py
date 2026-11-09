"""Stories: group the articles that report the same event, and drop what isn't news.

Every collected article goes through three steps, in batches:

1. Triage (Gemini). Is this fashion / streetwear / sneaker / art news worth showing?
   If so: a category, one neutral English headline, and the names involved. Writing
   the headline in English is what lets a Japanese, a Korean and an English article
   about one collab land in the same story.
2. Candidates (embeddings). The headline is embedded; recent stories whose
   headlines are close become candidates.
3. Match (Gemini). Given the batch and the candidates, decide which story each
   article belongs to, or which new story it starts. Similarity alone can't do this:
   two colourways of one shoe score as close as two write-ups of the same colourway.

A story records every website that carried it and when each did first. That is the
basis for everything after: how fast a story spreads, which sites are early.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

import numpy as np

from app.gemini import Gemini, GeminiError
from app.models import Source
from app.urls import site_key

if TYPE_CHECKING:
    from app.store import Store

log = logging.getLogger("discovery.stories")

CATEGORIES = ["release", "collab", "leak", "business", "runway", "campaign", "retail", "art", "culture"]
BATCH = 40
# Recent stories an article is compared with, and how close a headline must be to be offered as a match.
WINDOW_DAYS = 14
CANDIDATES_PER_ITEM = 5
MIN_CANDIDATE_SIM = 0.78
VECTORS_PER_STORY = 6

TRIAGE_PROMPT = """You triage news for Centoire, a community for fashion, streetwear, sneakers and art.
For each item return:
- id: as given
- relevant: true only if a fashion / streetwear / sneaker / art enthusiast would want it as news:
  releases, collaborations, leaks and first looks, brand and designer moves, shows and runway,
  campaigns, store openings, notable industry business, art and design culture.
  false for: shopping deals and discounts, generic product listings and "best X" lists,
  job ads, horoscopes, personal Reddit posts (fits, pickups, questions, ID requests),
  and sport, gaming, film, music or tech news with no fashion, sneaker or art angle.
- category: one of {categories} (use "culture" when nothing else fits)
- headline: one neutral English sentence naming the specific event: who, which product or
  collection, what happened. The same event reported in any language or by any outlet must
  get nearly the same headline. For irrelevant items, a few words are enough.
- entities: up to 6 canonical English names of the brands, people and products involved.
Items (one JSON object per line):
"""

TRIAGE_SCHEMA = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "id": {"type": "STRING"}, "relevant": {"type": "BOOLEAN"}, "category": {"type": "STRING"},
    "headline": {"type": "STRING"}, "entities": {"type": "ARRAY", "items": {"type": "STRING"}}},
    "required": ["id", "relevant", "category", "headline", "entities"]}}

MATCH_PROMPT = """You group news articles into stories. A story is ONE specific event:
one product or colourway release, one collaboration, one appointment, one show, one deal.
- Follow-ups about the same product or event belong to the same story: leak, then official
  reveal, then release date, price, retailer list, on-foot photos.
- Different colourways or different products of the same brand are different stories.
- Different collaborations of the same brand or person are different stories.
- An overview or round-up mentioning many products is its own story.

Existing stories:
{stories}

New articles (with the existing stories that look closest):
{articles}

For every article return its story: an existing story id ("S1", ...) or a new-story label
("N1", "N2", ...). New articles about the same new event must share the same N label."""

MATCH_SCHEMA = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "id": {"type": "STRING"}, "story": {"type": "STRING"}}, "required": ["id", "story"]}}


def item_time(doc: dict) -> datetime:
    """When the article came out: its publish time, unless that is later than when we saw it."""
    seen, published = doc.get("first_seen_at"), doc.get("published_at")
    if published and seen:
        return min(_utc(published), _utc(seen))
    return _utc(published or seen)


def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _norm(name: str) -> str:
    """Lowercase letters and digits only. Non-Latin names (スニーカーウォーズ) keep their letters:
    stripping them would leave every Japanese or Korean outlet with the same empty key."""
    return re.sub(r"[^\w]|_", "", name.lower()) or name.strip().lower()


def _is_google_news(url: str) -> bool:
    return "news.google.com" in url


class Websites:
    """Works out which website an article is from. Google News items carry the outlet's
    name (and, for newer items, its URL); direct feeds are their source's website."""

    def __init__(self, sources: list[Source]) -> None:
        self.sources = {s.id: s for s in sources}
        self._by_name: dict[str, str] = {}
        for s in sources:
            if s.type in ("rss", "sitemap", "page", "shopify") and not _is_google_news(s.url):
                key = site_key(s.url)
                self._by_name.setdefault(_norm(s.name), key)
                self._by_name.setdefault(_norm(key), key)

    def of(self, doc: dict) -> tuple[str, str]:
        """(key, display name)."""
        source = self.sources.get(doc.get("source_id", ""))
        if source is None:
            return doc.get("source_id", "unknown"), doc.get("source_id", "unknown")
        if source.type == "instagram":
            return f"instagram:{source.handle}", f"@{source.handle}"
        if source.type == "reddit":
            return "reddit", "Reddit"
        if _is_google_news(source.url) and (publisher := doc.get("publisher")):
            if url := (doc.get("extra") or {}).get("publisher_url"):
                return site_key(url), publisher
            if "." in publisher and " " not in publisher:  # Google News sometimes names the outlet by domain or URL
                host = urlsplit(publisher).netloc if "//" in publisher else publisher.split("/")[0]
                return site_key(host), host.removeprefix("www.")
            return self._by_name.get(_norm(publisher), _norm(publisher)), publisher
        return site_key(source.url), source.name


class StoryIndex:
    """Recent stories' headline vectors, in memory, for finding match candidates."""

    def __init__(self) -> None:
        self.headlines: dict[str, str] = {}
        self.last_at: dict[str, datetime] = {}
        self._ids: list[str] = []
        self._mat = np.zeros((0, 0), dtype=np.float32)

    def put(self, story: dict) -> None:
        sid = story["_id"]
        self.headlines[sid] = story["headline"]
        self.last_at[sid] = _utc(story["last_at"])
        keep = [i for i, x in enumerate(self._ids) if x != sid]
        vecs = np.asarray(story["vectors"], dtype=np.float32)
        vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)
        mat = self._mat[keep] if self._mat.size else np.zeros((0, vecs.shape[1]), dtype=np.float32)
        self._ids = [self._ids[i] for i in keep] + [sid] * len(vecs)
        self._mat = np.vstack([mat, vecs])

    def search(self, vec: list[float], at: datetime) -> list[tuple[str, float]]:
        if not self._ids:
            return []
        v = np.asarray(vec, dtype=np.float32)
        sims = self._mat @ (v / np.linalg.norm(v))
        best: dict[str, float] = {}
        oldest = at - timedelta(days=WINDOW_DAYS)
        for i in np.argsort(-sims):
            if sims[i] < MIN_CANDIDATE_SIM or len(best) >= CANDIDATES_PER_ITEM:
                break
            sid = self._ids[i]
            if sid not in best and self.last_at[sid] >= oldest:
                best[sid] = float(sims[i])
        return list(best.items())


class StoryBuilder:
    def __init__(self, store: Store, llm: Gemini, sources: list[Source], *,
                 triage_model: str | None = None, match_model: str | None = None) -> None:
        self.store = store
        self.llm = llm
        self.websites = Websites(sources)
        self.triage_model = triage_model
        self.match_model = match_model
        self.index = StoryIndex()
        self._loaded = False

    def add_source(self, source: Source) -> None:
        self.websites = Websites([*self.websites.sources.values(), source])

    async def load(self, since: datetime | None = None) -> None:
        since = since or datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
        for story in await self.store.stories_since(since):
            self.index.put(story)
        self._loaded = True

    async def run_pass(self, limit: int = 400) -> int:
        """Triage and group up to `limit` unprocessed articles, oldest first. Returns how many."""
        if not self._loaded:
            await self.load()
        docs = await self.store.untriaged_items(limit)
        docs.sort(key=item_time)
        done = 0
        for i in range(0, len(docs), BATCH):
            try:
                await self.process(docs[i:i + BATCH])
            except GeminiError as exc:
                log.warning("story pass stopped, will retry: %s", exc)
                break
            done += len(docs[i:i + BATCH])
        return done

    async def recount(self, story: dict) -> dict:
        """Rebuild a story's websites, first article and counts from its articles."""
        docs = sorted(await self.store.story_articles(story["_id"]), key=item_time)
        fresh = None
        for d in docs:
            fresh = self._add(fresh, story["_id"], {**d, "key": d.get("key") or d["url"]},
                              d.get("triage") or {"headline": story["headline"], "category": story["category"],
                                                  "entities": []}, [])
        if fresh is None:
            return story
        for keep in ("headline", "category", "entities", "created_at", "vectors", "review"):
            if keep in story:
                fresh[keep] = story[keep]
        await self.store.save_story(fresh)
        return fresh

    async def triage_many(self, docs: list[dict], concurrency: int = 6) -> dict[str, dict]:
        """Triage a large backlog in parallel (each article is judged on its own)."""
        sem = asyncio.Semaphore(concurrency)

        async def one(batch: list[dict]) -> dict[str, dict]:
            async with sem:
                return await self._triage(batch)

        results = await asyncio.gather(*(one(docs[i:i + BATCH]) for i in range(0, len(docs), BATCH)))
        return {k: v for r in results for k, v in r.items()}

    async def process(self, docs: list[dict], triage: dict[str, dict] | None = None) -> None:
        triage = triage or await self._triage(docs)
        relevant = [d for d in docs if triage[d["key"]]["relevant"]]
        for d in docs:
            if not triage[d["key"]]["relevant"]:
                await self.store.set_item_story(d["key"], triage[d["key"]], None)
        if not relevant:
            return
        texts = [f'{triage[d["key"]]["headline"]} | {", ".join(triage[d["key"]]["entities"])}' for d in relevant]
        vectors = dict(zip((d["key"] for d in relevant), await self.llm.embed(texts)))
        assignment = await self._match(relevant, triage, vectors)

        new_ids: dict[str, str] = {}
        for d in relevant:  # already in time order
            target = assignment.get(d["key"], "")
            if target.startswith("N") or target not in self.index.headlines:
                target = new_ids.setdefault(target or d["key"], uuid.uuid4().hex[:12])
            story = await self.store.get_story(target)
            story = self._add(story, target, d, triage[d["key"]], vectors[d["key"]])
            await self.store.save_story(story)
            await self.store.set_item_story(d["key"], triage[d["key"]], story["_id"])
            self.index.put(story)

    async def _triage(self, docs: list[dict]) -> dict[str, dict]:
        ids = {str(n): d["key"] for n, d in enumerate(docs)}
        lines = [
            _json_line({"id": n, "title": d["title"], "summary": (d.get("summary") or "")[:200],
                        "from": d.get("publisher") or self.websites.of(d)[1]})
            for n, d in zip(ids, docs)
        ]
        prompt = TRIAGE_PROMPT.format(categories=", ".join(CATEGORIES)) + "\n".join(lines)
        rows = await self.llm.generate_json(prompt, TRIAGE_SCHEMA, model=self.triage_model)
        out = {}
        for r in rows:
            if (key := ids.get(str(r.get("id")))) is None:
                continue
            category = r.get("category") if r.get("category") in CATEGORIES else "culture"
            out[key] = {"relevant": bool(r.get("relevant")), "category": category,
                        "headline": (r.get("headline") or "").strip()[:300],
                        "entities": [e.strip() for e in r.get("entities") or [] if e.strip()][:6]}
        missing = [d["key"] for d in docs if d["key"] not in out]
        if missing:  # a dropped row would leave the article untriaged forever; retry the batch
            raise GeminiError(f"triage returned no row for {len(missing)} of {len(docs)} items")
        return out

    async def _match(self, docs: list[dict], triage: dict, vectors: dict) -> dict[str, str]:
        story_labels: dict[str, str] = {}  # story id -> S label
        per_item: dict[str, list[str]] = {}
        for d in docs:
            cands = self.index.search(vectors[d["key"]], item_time(d))
            per_item[d["key"]] = [story_labels.setdefault(sid, f"S{len(story_labels) + 1}") for sid, _ in cands]
        stories = "\n".join(f"{label}: {self.index.headlines[sid]}" for sid, label in story_labels.items()) or "(none)"
        ids = {str(n): d["key"] for n, d in enumerate(docs)}
        articles = "\n".join(
            _json_line({"id": n, "headline": triage[d["key"]]["headline"], "closest": per_item[d["key"]]})
            for n, d in zip(ids, docs))
        rows = await self.llm.generate_json(MATCH_PROMPT.format(stories=stories, articles=articles),
                                            MATCH_SCHEMA, model=self.match_model)
        by_label = {label: sid for sid, label in story_labels.items()}
        out = {}
        for r in rows:
            key, label = ids.get(str(r.get("id"))), str(r.get("story", "")).strip()
            if key:
                out[key] = by_label.get(label, label if label.startswith("N") else "")
        return out

    def _add(self, story: dict | None, sid: str, doc: dict, tri: dict, vec: list[float]) -> dict:
        at = item_time(doc)
        site, name = self.websites.of(doc)
        if story is None:
            story = {"_id": sid, "headline": tri["headline"], "category": tri["category"],
                     "entities": [], "created_at": datetime.now(timezone.utc), "first_at": at, "last_at": at,
                     "first": None, "websites": {}, "article_count": 0, "markets": [],
                     "seen_live_at": None, "item_keys": [], "vectors": []}
        if doc["key"] in story["item_keys"]:
            return story
        story["item_keys"].append(doc["key"])
        story["article_count"] += 1
        story["first_at"] = min(_utc(story["first_at"]), at)
        story["last_at"] = max(_utc(story["last_at"]), at)
        article = {"website": site, "name": name, "title": doc["title"], "url": doc["url"], "at": at,
                   "source_id": doc["source_id"]}
        if story["first"] is None or at < _utc(story["first"]["at"]):
            story["first"] = article
            story["headline"], story["category"] = tri["headline"], tri["category"]
        site_doc = story["websites"].get(_field(site))
        if site_doc is None or at < _utc(site_doc["first_at"]):
            story["websites"][_field(site)] = {"name": name, "first_at": at, "title": doc["title"],
                                               "url": doc["url"], "articles": (site_doc or {}).get("articles", 0)}
        story["websites"][_field(site)]["articles"] += 1
        story["website_count"] = len(story["websites"])
        story["markets"] = sorted(set(story["markets"]) | set(doc.get("regions") or []))
        for e in tri["entities"]:
            if e.lower() not in {x.lower() for x in story["entities"]} and len(story["entities"]) < 10:
                story["entities"].append(e)
        if not doc.get("baseline"):  # when the engine itself first saw it happen, not a backfilled article
            live = _utc(doc["first_seen_at"])
            if story["seen_live_at"] is None or live < _utc(story["seen_live_at"]):
                story["seen_live_at"] = live
        if len(story["vectors"]) < VECTORS_PER_STORY:
            story["vectors"].append([round(x, 5) for x in vec])
        story["updated_at"] = datetime.now(timezone.utc)
        return story


def _field(site: str) -> str:
    """Mongo field names can't contain dots."""
    return site.replace(".", "_")


def _json_line(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False)
