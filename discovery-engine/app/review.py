"""The bridge to the Centoire app: stories go to the editors' review queue, decisions come back,
and the app's source list is shared with the engine.

    engine story ──POST /internal/discovery/stories──▶ post "pending review" ──▶ /moderation
    engine ◀──GET /internal/discovery/decisions── approve / reject (+ reason)
    engine ◀──GET /internal/discovery/sources──── sources admins added or approved
    engine ──POST /internal/discovery/sources/suggestions──▶ "Suggested" on the Sources page

What gets sent: a story once 2+ websites carry it, or straight away if it's a leak, while it is
under 48 hours old. While it's still pending, the evidence is refreshed as the story spreads.

Sources are suggested, never added on their own, when (a) several publishers credit them as a
story's origin (app.origins), or (b) they keep publishing stories first, or carry stories that
editors approve. An admin approves them on the Sources page; the next sync starts watching them.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

import httpx

from app.gemini import Gemini, GeminiError
from app.gnews import resolve as resolve_google_news
from app.models import Source
from app.origins import find_feed
from app.stories import _utc
from app.urls import site_key

if TYPE_CHECKING:
    from app.poller import Poller

log = logging.getLogger("discovery.review")

SYNC_EVERY_SECONDS = 120
SUGGEST_EVERY_SECONDS = 1800
MIN_WEBSITES = 2
MAX_AGE_HOURS = 48
# A website we don't watch is suggested after being first with this many stories (3+ websites
# each), or carrying this many stories editors approved, within the last LOOKBACK_DAYS.
SUGGEST_MIN_FIRSTS = 2
SUGGEST_MIN_APPROVED = 2
LOOKBACK_DAYS = 14
MAX_SUGGESTIONS_PER_PASS = 5


# Bump to resend every pending story once (e.g. after changing what the payload contains).
PAYLOAD_VERSION = 3
# Google News links resolved per pass (each costs a ~600 KB page); the rest wait for the next pass.
MAX_RESOLVE_PER_PASS = 40
NON_LATIN = re.compile(r"[\u0400-\u04ff\u0590-\u06ff\u0900-\u0dff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")

ENGLISH_PROMPT = """For each fashion news story below, write in English:
- summary: 1-2 factual sentences for a reader: what was announced or released, by whom, and the key
  details given (date, price, where). Use only facts in the articles; no hype, no speculation.
- names: an English or romanised name for each outlet listed under "outlets" (e.g. "スニーカーウォーズ"
  -> "Sneaker Wars"). Keep a brand's own Latin spelling when it has one.
Stories (one JSON object per line):
"""

ENGLISH_SCHEMA = {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "id": {"type": "STRING"}, "summary": {"type": "STRING"},
    "names": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "original": {"type": "STRING"}, "english": {"type": "STRING"}}, "required": ["original", "english"]}}},
    "required": ["id", "summary", "names"]}}


def is_english(text: str) -> bool:
    """Good enough to pick a link: no CJK, Cyrillic, Arabic, Thai... characters."""
    return not NON_LATIN.search(text or "")


class AppError(Exception):
    pass


class CentoireApp:
    """The app's /internal/discovery API."""

    def __init__(self, base_url: str, secret: str, timeout: float = 20) -> None:
        self._client = httpx.AsyncClient(base_url=base_url.rstrip("/") + "/internal/discovery",
                                         headers={"x-internal-secret": secret}, timeout=timeout)

    async def close(self) -> None:
        await self._client.aclose()

    async def _call(self, method: str, path: str, **kw) -> dict | list:
        try:
            resp = await self._client.request(method, path, **kw)
        except httpx.TransportError as exc:
            raise AppError(f"{method} {path}: {type(exc).__name__}: {exc}") from exc
        if resp.status_code >= 400:
            raise AppError(f"{method} {path}: HTTP {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    async def post_story(self, payload: dict) -> dict:
        return await self._call("POST", "/stories", json=payload)

    async def decisions(self, since: datetime) -> list[dict]:
        return await self._call("GET", "/decisions", params={"since": since.isoformat(), "limit": 200})

    async def sources(self) -> list[dict]:
        return await self._call("GET", "/sources")

    async def suggest_source(self, payload: dict) -> dict:
        return await self._call("POST", "/sources/suggestions", json=payload)


def _iso(dt: datetime | None) -> str | None:
    return _utc(dt).isoformat() if dt else None


def is_google_news(url: str) -> bool:
    return "news.google.com" in url


def with_resolved_urls(articles: list[dict]) -> list[dict]:
    """Google News articles whose publisher URL we know, with that URL in place of the redirect."""
    out = []
    for a in articles:
        real = (a.get("extra") or {}).get("resolved_url")
        out.append({**a, "url": real, "via_google_news": a["url"]} if real and is_google_news(a["url"]) else a)
    return out


def pick_link(articles: list[dict]) -> dict:
    """The article "Read post" opens: the earliest English one on the outlet's own site, then any
    English one, then the earliest on an outlet's own site, then whatever there is. (The first
    publisher, in any language, is still shown in the evidence.)"""
    direct = [a for a in articles if not is_google_news(a["url"])]
    for group in ([a for a in direct if is_english(a["title"])],
                  [a for a in articles if is_english(a["title"])], direct, articles):
        if group:
            return group[0]
    raise ValueError("story has no articles")


def story_payload(story: dict, articles: list[dict]) -> dict:
    """The post an editor reviews: the English headline and summary, linking to an English article
    when the story has one."""
    articles = sorted(with_resolved_urls(articles), key=lambda a: _utc(a.get("published_at") or a["first_seen_at"]))
    lead = pick_link(articles)
    real_url = {a["via_google_news"]: a["url"] for a in articles if a.get("via_google_news")}

    def link(url: str | None) -> str | None:
        return real_url.get(url, url) if url else url
    names = story.get("names_en") or {}

    def name(n: str) -> str:
        return names.get(n) or n

    excerpt = story.get("summary_en") or (lead.get("summary") if is_english(lead.get("summary", "")) else "")
    image = next((a["image_url"] for a in articles if a.get("image_url")), None)
    first = story.get("first") or {}
    websites = sorted(story["websites"].values(), key=lambda w: _utc(w["first_at"]))
    region = next((r for r in lead.get("regions") or [] if len(r) == 2), None)
    payload = {
        "storyId": story["_id"],
        "title": story["headline"].rstrip(". ")[:300],
        "excerpt": (excerpt or story["headline"])[:300],
        "externalUrl": lead["url"],
        "publishedAt": _iso(story["first_at"]),
        "discovery": {
            "category": story.get("category"),
            "websiteCount": story.get("website_count", len(websites)),
            "articleCount": story.get("article_count", len(articles)),
            "spread": [{"name": name(w["name"]), "url": link(w.get("url")), "firstAt": _iso(w["first_at"])}
                       for w in websites[:25]],
            "markets": [m for m in story.get("markets", []) if m != "GLOBAL"],
        },
    }
    if first:
        payload["discovery"]["firstPublished"] = {"name": name(first["name"]), "url": link(first.get("url")),
                                                  "at": _iso(first["at"])}
    if story.get("seen_live_at"):
        payload["discovery"]["engineSawAt"] = _iso(story["seen_live_at"])
    if image and image.startswith("http"):
        payload["coverImageUrl"] = image
    if region:
        payload["country"] = region
    return payload


def app_source_to_engine(doc: dict) -> Source | None:
    """A source from the app's list, as the engine watches it."""
    kind = doc.get("kind") or "rss"
    if kind not in ("rss", "sitemap", "page", "instagram"):
        return None
    url = doc["feedUrl"]
    include = []
    if kind == "page":  # only links on the page's own site, below its path
        parts = urlsplit(url)
        include = [re.escape(parts.netloc.removeprefix("www.")) + "/.+/.+"]
    return Source(
        id=f"app-{doc['id']}", name=doc["name"], type=kind, url=url,
        region=(doc.get("region") or "GLOBAL").upper(),
        role="discovered" if doc.get("review") == "approved" else "publisher",
        tier="slow" if kind == "instagram" else "normal",
        include_url=include,
    )


class ReviewBridge:
    def __init__(self, poller: Poller, app: CentoireApp, llm: Gemini | None = None) -> None:
        self.poller = poller
        self.store = poller.store
        self.app = app
        self.llm = llm  # for English summaries and outlet names; without it the headline is the excerpt
        self.known_feeds: set[str] = set()  # every source the app knows about (watched, suggested, rejected)

    # ---------- sources ----------

    async def sync_sources(self) -> int:
        rows = await self.app.sources()
        self.known_feeds = {r["feedUrl"] for r in rows}
        own = {s.url for s in self.poller.all_sources if not s.id.startswith("app-")}
        wanted: dict[str, Source] = {}
        for row in rows:
            if row["active"] and row["feedUrl"] not in own and (src := app_source_to_engine(row)):
                wanted[src.id] = src
        for src in wanted.values():
            if not any(s.id == src.id for s in self.poller.all_sources):
                log.info("watching %s from the app's source list (%s)", src.id, src.url)
                self.poller.add_source(src)
        for s in [s for s in self.poller.all_sources if s.id.startswith("app-") and s.id not in wanted]:
            log.info("no longer watching %s: paused or removed in the app", s.id)
            self.poller.remove_source(s.id)
        return 0

    # ---------- stories ----------

    async def push_stories(self) -> int:
        since = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
        due = []
        for story in await self.store.stories_for_review(since=since, min_websites=MIN_WEBSITES):
            review = story.get("review") or {}
            if review.get("status") not in (None, "pending_review"):
                continue  # decided: the editor's version stands
            if (review and story.get("website_count", 0) <= review.get("pushed_websites", 0)
                    and review.get("payload_v") == PAYLOAD_VERSION and review.get("links_resolved", True)):
                continue  # nothing new since it was sent
            articles = await self.store.story_articles(story["_id"])
            if articles:
                due.append((story, articles))
        if not due:
            return 0
        await self._resolve_links(due)
        await self._add_english(due)
        sent = 0
        for story, articles in due:
            result = await self.app.post_story(story_payload(story, articles))
            # Only links the resolution budget skipped count (failures are remembered as "").
            pending_links = self.poller.http_client() is not None and any(
                is_google_news(a["url"]) and "resolved_url" not in (a.get("extra") or {}) for a in articles)
            await self.store.set_story_review(story["_id"], {
                "post_id": result["postId"], "status": result["status"], "payload_v": PAYLOAD_VERSION,
                # False: some Google News links weren't resolved yet; resend once they are
                "links_resolved": not pending_links,
                "pushed_websites": story.get("website_count", 0), "pushed_at": datetime.now(timezone.utc)})
            sent += 1
        return sent

    async def _resolve_links(self, due: list[tuple[dict, list[dict]]]) -> None:
        """Find the publisher URL behind each Google News article in these stories (remembered on the
        article). It also tells us the outlet's website, which source suggestions need."""
        client = self.poller.http_client()
        if client is None:
            return
        budget = MAX_RESOLVE_PER_PASS
        for _story, articles in due:
            for a in articles:
                extra = a.setdefault("extra", {})
                if not is_google_news(a["url"]) or "resolved_url" in extra or budget <= 0:
                    continue
                budget -= 1
                real = await resolve_google_news(client, a["url"])
                fields = {"extra.resolved_url": real or ""}
                extra["resolved_url"] = real or ""
                if real and not extra.get("publisher_url"):
                    parts = urlsplit(real)
                    fields["extra.publisher_url"] = extra["publisher_url"] = f"{parts.scheme}://{parts.netloc}"
                await self.store.set_item_fields(a["key"], fields)
                await asyncio.sleep(1)  # be gentle with Google

    async def _add_english(self, due: list[tuple[dict, list[dict]]]) -> None:
        """English summary (refreshed as the story grows) and English names for non-Latin outlets."""
        if not self.llm:
            return
        todo = [(s, a) for s, a in due
                if not s.get("summary_en") or s.get("summary_websites", 0) < s.get("website_count", 0)]
        for i in range(0, len(todo), 15):
            batch = todo[i:i + 15]
            lines = []
            for n, (story, articles) in enumerate(batch):
                outlets = sorted({w["name"] for w in story["websites"].values() if not is_english(w["name"])})
                lines.append(json.dumps({
                    "id": str(n), "headline": story["headline"], "outlets": outlets,
                    "articles": [f'{a["title"]} :: {(a.get("summary") or "")[:200]}' for a in articles[:6]],
                }, ensure_ascii=False))
            try:
                rows = await self.llm.generate_json(ENGLISH_PROMPT + "\n".join(lines), ENGLISH_SCHEMA)
            except GeminiError as exc:
                log.warning("review: English summaries failed, sending headlines only: %s", exc)
                return
            for r in rows:
                if not str(r.get("id", "")).isdigit() or int(r["id"]) >= len(batch):
                    continue
                story = batch[int(r["id"])][0]
                fields = {"summary_en": (r.get("summary") or "").strip()[:300],
                          "names_en": {x["original"]: x["english"] for x in r.get("names") or []
                                       if x.get("original") and x.get("english")},
                          "summary_websites": story.get("website_count", 0)}
                story.update(fields)
                await self.store.set_story_fields(story["_id"], fields)

    async def pull_decisions(self) -> int:
        since = await self.store.get_state("decisions_since") or datetime(2000, 1, 1, tzinfo=timezone.utc)
        rows = await self.app.decisions(_utc(since))
        for row in rows:
            status = "published" if row["status"] == "published" else "rejected"
            await self.store.set_story_review(row["storyId"], {
                "post_id": row["postId"], "status": status, "decided_at": row["reviewedAt"],
                "reason": row.get("rejectionReason"), "by_editor": row.get("byEditor", False)}, merge=True)
        if rows:
            await self.store.set_state("decisions_since", datetime.fromisoformat(rows[-1]["reviewedAt"].replace("Z", "+00:00")))
        return len(rows)

    # ---------- suggestions ----------

    def _watched_sites(self) -> set[str]:
        return {site_key(s.url) for s in self.poller.all_sources if s.type != "instagram"} | {
            site_key(u) for u in self.known_feeds}

    async def suggest_from_stories(self, client: httpx.AsyncClient) -> int:
        """Websites we don't watch that keep being first, or keep carrying approved stories."""
        since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
        watched = self._watched_sites()
        firsts: dict[str, list[dict]] = defaultdict(list)
        approved: dict[str, list[dict]] = defaultdict(list)
        names: dict[str, str] = {}
        for story in await self.store.stories_for_review(since=since, min_websites=1):
            sites = sorted(story["websites"].items(), key=lambda kv: _utc(kv[1]["first_at"]))
            if story.get("website_count", 0) >= 3 and sites:
                key, w = sites[0]
                firsts[key].append({"story": story, "lead_over": sites[1][1] if len(sites) > 1 else None})
                names[key] = w["name"]
            if (story.get("review") or {}).get("status") == "published":
                for key, w in sites:
                    approved[key].append({"story": story})
                    names.setdefault(key, w["name"])
        candidates = []
        for key in set(firsts) | set(approved):
            if key in watched or key == "reddit" or key.startswith("instagram:"):
                continue
            n_first, n_ok = len(firsts.get(key, [])), len(approved.get(key, []))
            if n_first >= SUGGEST_MIN_FIRSTS or n_ok >= SUGGEST_MIN_APPROVED:
                candidates.append((n_first * 2 + n_ok, key))
        sent = 0
        for score, key in sorted(candidates, reverse=True)[:MAX_SUGGESTIONS_PER_PASS]:
            host = await self._host_for(key)
            if not host:
                continue
            feed = await find_feed(client, host)
            if not feed or feed in self.known_feeds:
                continue
            evidence = [self._first_line(f) for f in firsts.get(key, [])[:4]]
            evidence += [f'Carried the approved story "{a["story"]["headline"][:90]}"' for a in approved.get(key, [])[:2]]
            n_first, n_ok = len(firsts.get(key, [])), len(approved.get(key, []))
            reason = " and ".join(p for p in (
                f"First to publish {n_first} stories that 3+ websites went on to cover" if n_first else "",
                f"carried {n_ok} stories editors approved" if n_ok else "") if p)
            await self.app.suggest_source({
                "name": names[key][:200], "siteUrl": f"https://{host}/", "feedUrl": feed, "kind": "rss",
                "region": self._region_for(firsts.get(key, []) + approved.get(key, [])),
                "reason": reason[0].upper() + reason[1:], "evidence": evidence, "score": score})
            self.known_feeds.add(feed)
            sent += 1
        return sent

    @staticmethod
    def _first_line(entry: dict) -> str:
        story, nxt = entry["story"], entry["lead_over"]
        line = f'First with "{story["headline"][:90]}" ({story["website_count"]} websites)'
        if nxt:
            first_at = min(_utc(w["first_at"]) for w in story["websites"].values())
            hours = (_utc(nxt["first_at"]) - first_at).total_seconds() / 3600
            if hours >= 1:
                line += f", {hours:.0f}h before {nxt['name']}"
        return line

    @staticmethod
    def _region_for(entries: list[dict]) -> str | None:
        regions = [r for e in entries for r in e["story"].get("markets", []) if len(r) == 2]
        return max(set(regions), key=regions.count) if regions else None

    async def _host_for(self, key: str) -> str | None:
        """A website key is a host for direct feeds; Google News outlets need an article's outlet URL."""
        url = await self.store.website_url(key)
        if url:
            return urlsplit(url).netloc.lower().removeprefix("www.") or None
        return None

    async def suggest_origin(self, source: Source, reason: str, evidence: list[str]) -> bool:
        """Called by origin tracing instead of adding the source directly."""
        if source.url in self.known_feeds:
            return False
        parts = urlsplit(source.url)
        site = f"{parts.scheme}://{parts.netloc}/" if source.type != "instagram" else source.url
        await self.app.suggest_source({
            "name": source.name, "siteUrl": site, "feedUrl": source.url, "kind": source.type,
            "region": None if source.region == "GLOBAL" else source.region,
            "reason": reason, "evidence": evidence[:6]})
        self.known_feeds.add(source.url)
        return True

    # ---------- loop ----------

    async def run(self, client: httpx.AsyncClient) -> None:
        last_suggest = 0.0
        loop = asyncio.get_running_loop()
        while True:
            for step in (self.sync_sources, self.pull_decisions, self.push_stories):
                try:
                    n = await step()
                    if n:
                        log.info("review: %s %d", step.__name__, n)
                except AppError as exc:
                    log.warning("review: %s failed: %s", step.__name__, exc)
                except Exception:
                    log.exception("review: %s failed", step.__name__)
            if loop.time() - last_suggest >= SUGGEST_EVERY_SECONDS:
                last_suggest = loop.time()
                try:
                    n = await self.suggest_from_stories(client)
                    if n:
                        log.info("review: suggested %d sources from story history", n)
                except AppError as exc:
                    log.warning("review: suggestions failed: %s", exc)
                except Exception:
                    log.exception("review: suggestions failed")
            await asyncio.sleep(SYNC_EVERY_SECONDS)

