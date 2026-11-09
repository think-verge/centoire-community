"""MongoDB storage: items (deduped, with first-seen times) and per-source poll health."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import motor.motor_asyncio
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import BulkWriteError, DuplicateKeyError

from app.models import FetchedItem, Item, Source
from app.urls import item_key


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _engagement_snapshot(item: FetchedItem, now: datetime) -> dict | None:
    likes, comments = item.extra.get("like_count"), item.extra.get("comments_count")
    if likes is None and comments is None:
        return None
    return {"t": now, "likes": likes, "comments": comments}


class Store:
    def __init__(self, uri: str, db_name: str) -> None:
        self.client = motor.motor_asyncio.AsyncIOMotorClient(uri, tz_aware=True)
        self.db = self.client[db_name]
        self.items = self.db["items"]
        self.source_status = self.db["source_status"]
        # Instagram accounts mentioned in watched posts but not (yet) on the watchlist.
        self.ig_candidates = self.db["ig_candidates"]
        # Every URL a sitemap / page source has ever listed (see app.sites).
        self.site_url_docs = self.db["site_urls"]
        # Origin tracing (see app.origins): names publishers credit, per-publisher totals,
        # and the sources that were added automatically from them.
        self.origins = self.db["origin_candidates"]
        self.citing = self.db["citing_publishers"]
        self.discovered = self.db["discovered_sources"]
        # Articles grouped by the event they report (see app.stories).
        self.stories = self.db["stories"]
        # Small key/value state (e.g. the review bridge's decisions cursor).
        self.state = self.db["engine_state"]

    async def init(self) -> None:
        await self.site_url_docs.create_index([("source_id", ASCENDING), ("url", ASCENDING)], unique=True)
        await self.items.create_index("key", unique=True)
        await self.items.create_index([("first_seen_at", DESCENDING)])
        await self.items.create_index([("regions", ASCENDING), ("first_seen_at", DESCENDING)])
        await self.items.create_index([("source_id", ASCENDING), ("first_seen_at", DESCENDING)])
        await self.items.create_index("story_id", sparse=True)
        await self.stories.create_index([("last_at", DESCENDING)])
        await self.stories.create_index([("first_at", DESCENDING)])

    async def has_polled(self, source_id: str) -> bool:
        doc = await self.source_status.find_one({"_id": source_id}, {"last_ok_at": 1})
        return bool(doc and doc.get("last_ok_at"))

    async def save_items(
        self, source: Source, fetched: list[FetchedItem], *, baseline: bool
    ) -> list[FetchedItem]:
        """Insert unseen items; return the new ones. Existing keys keep their first_seen_at."""
        new: list[FetchedItem] = []
        now = utcnow()
        for f in fetched:
            regions = source.regions_for(f.extra.get("tag"))
            snapshot = _engagement_snapshot(f, now)
            item = Item(
                **f.model_dump(),
                key=item_key(f.url, publisher=f.publisher, title=f.title),
                source_id=source.id,
                source_role=source.role,
                regions=regions,
                first_seen_at=now,
                baseline=baseline,
                engagement=[snapshot] if snapshot else [],
            )
            try:
                await self.items.insert_one(item.model_dump())
                new.append(f)
                if not baseline:
                    await self._note_mentions(source, f, now)
            except DuplicateKeyError:
                # Seen before. If via another source, record that sighting too.
                await self.items.update_one(
                    {"key": item.key, "source_id": {"$ne": source.id}},
                    {"$addToSet": {"also_seen_in": source.id, "regions": {"$each": regions}}},
                )
                if snapshot:
                    await self.items.update_one(
                        {"key": item.key},
                        {
                            "$set": {"extra.like_count": snapshot["likes"],
                                     "extra.comments_count": snapshot["comments"]},
                            "$push": {"engagement": {"$each": [snapshot], "$slice": -200}},
                        },
                    )
        return new

    async def _note_mentions(self, source: Source, item: FetchedItem, now: datetime) -> None:
        for handle in item.extra.get("mentions") or []:
            await self.ig_candidates.update_one(
                {"_id": handle},
                {
                    "$inc": {"mentions": 1},
                    "$addToSet": {"mentioned_by": source.id},
                    "$set": {"last_mentioned_at": now, "last_post": item.url},
                    "$setOnInsert": {"first_mentioned_at": now},
                },
                upsert=True,
            )

    async def site_urls(self, source_id: str) -> set[str]:
        cursor = self.site_url_docs.find({"source_id": source_id}, {"_id": 0, "url": 1})
        return {d["url"] async for d in cursor}

    async def add_site_urls(self, source_id: str, urls: list[str]) -> None:
        now = utcnow()
        try:
            await self.site_url_docs.insert_many(
                [{"source_id": source_id, "url": u, "first_listed_at": now} for u in urls], ordered=False
            )
        except BulkWriteError as exc:  # already-known URLs (e.g. after a restart) are fine
            if any(e.get("code") != 11000 for e in exc.details.get("writeErrors", [])):
                raise

    async def record_citations(self, publisher: str, source: Source, item: FetchedItem, cites: list[dict]) -> None:
        """Count each credited name once per story, and how many stories this publisher has traced."""
        key = item_key(item.url, publisher=item.publisher, title=item.title)
        now = utcnow()
        first = await self.citing.update_one(
            {"_id": publisher, "item_keys": {"$ne": key}},
            {"$inc": {"items": 1}, "$push": {"item_keys": {"$each": [key], "$slice": -2000}}},
        )
        if not first.modified_count:
            await self.citing.update_one(
                {"_id": publisher}, {"$setOnInsert": {"items": 1, "item_keys": [key]}}, upsert=True)
        regions = source.regions_for(item.extra.get("tag"))
        day = (item.published_at or now).strftime("%Y-%m-%d")
        for c in cites:
            oid = f"{c['platform']}:{c['name']}"
            citation = {"source_id": source.id, "publisher": publisher, "item_url": item.url,
                        "title": item.title[:200], "kind": c["kind"], "context": c.get("context", ""), "at": now}
            await self.origins.update_one(
                {"_id": oid},
                {"$setOnInsert": {"platform": c["platform"], "name": c["name"], "status": "new",
                                  "first_cited_at": now}},
                upsert=True,
            )
            # Only the first sighting of this story counts, so re-reading an article never double-counts.
            await self.origins.update_one(
                {"_id": oid, "item_keys": {"$ne": key}},
                {
                    "$set": {"last_cited_at": now},
                    "$inc": {"stories": 1, f"by.{publisher.replace('.', '_')}": 1},
                    "$addToSet": {"publishers": publisher, "kinds": c["kind"], "regions": {"$each": regions},
                                  "days": day, "item_keys": key},
                    "$push": {"citations": {"$each": [citation], "$slice": -30}},
                },
            )

    async def citing_totals(self) -> dict[str, int]:
        return {d["_id"]: d["items"] async for d in self.citing.find({}, {"items": 1})}

    async def origin_candidates(self, *, statuses: tuple[str, ...] | None = None, limit: int = 0) -> list[dict]:
        query = {"status": {"$in": list(statuses)}} if statuses else {}
        cursor = self.origins.find(query, {"item_keys": 0}).sort([("stories", DESCENDING)])
        if limit:
            cursor = cursor.limit(limit)
        return await cursor.to_list(length=None)

    async def set_origin_status(self, origin_id: str, status: str, *, reason: str = "") -> None:
        await self.origins.update_one(
            {"_id": origin_id}, {"$set": {"status": status, "status_reason": reason, "status_at": utcnow()}})

    async def add_discovered_source(self, source: Source, *, origin_id: str) -> None:
        await self.discovered.update_one(
            {"_id": source.id},
            {"$set": {**source.model_dump(), "origin_id": origin_id, "added_at": utcnow()}},
            upsert=True,
        )

    async def discovered_sources(self) -> list[Source]:
        fields = set(Source.model_fields)
        return [Source(**{k: v for k, v in d.items() if k in fields}) async for d in self.discovered.find()]

    async def candidates(self, watched: set[str], limit: int = 50) -> list[dict]:
        """Mentioned accounts not on the watchlist, most-mentioned by distinct accounts first."""
        rows = await self.ig_candidates.aggregate([
            {"$match": {"_id": {"$nin": sorted(watched)}}},
            {"$addFields": {"mentioned_by_count": {"$size": "$mentioned_by"}}},
            {"$sort": {"mentioned_by_count": -1, "mentions": -1}},
            {"$limit": limit},
        ]).to_list(length=limit)
        return [{"handle": r.pop("_id"), **r} for r in rows]

    # ---------- stories (app.stories) ----------

    async def untriaged_items(self, limit: int) -> list[dict]:
        cursor = self.items.find({"triage": {"$exists": False}},
                                 {"_id": 0, "engagement": 0}).sort("first_seen_at", ASCENDING).limit(limit)
        return await cursor.to_list(length=limit)

    async def set_item_story(self, key: str, triage: dict, story_id: str | None) -> None:
        await self.items.update_one({"key": key}, {"$set": {"triage": triage, "story_id": story_id}})

    async def get_story(self, story_id: str) -> dict | None:
        return await self.stories.find_one({"_id": story_id})

    async def save_story(self, story: dict) -> None:
        await self.stories.replace_one({"_id": story["_id"]}, story, upsert=True)

    async def stories_since(self, since: datetime) -> list[dict]:
        cursor = self.stories.find({"last_at": {"$gte": since}}, {"headline": 1, "last_at": 1, "vectors": 1})
        return await cursor.to_list(length=None)

    async def list_stories(self, *, since: datetime, min_websites: int = 1, category: str | None = None,
                           limit: int = 100) -> list[dict]:
        query: dict[str, Any] = {"last_at": {"$gte": since}, "website_count": {"$gte": min_websites}}
        if category:
            query["category"] = category
        cursor = self.stories.find(query, {"vectors": 0, "item_keys": 0}).sort(
            [("website_count", DESCENDING), ("first_at", DESCENDING)]).limit(limit)
        return await cursor.to_list(length=limit)

    async def stories_for_review(self, *, since: datetime, min_websites: int) -> list[dict]:
        """Recent stories carried by enough websites, or leaks (which matter before they spread)."""
        query = {"last_at": {"$gte": since},
                 "$or": [{"website_count": {"$gte": min_websites}}, {"category": "leak"}]}
        cursor = self.stories.find(query, {"vectors": 0, "item_keys": 0}).sort("first_at", ASCENDING)
        return await cursor.to_list(length=None)

    async def pending_review_stories(self) -> list[dict]:
        """Stories sent for review that no editor has decided yet (their tag keeps changing)."""
        cursor = self.stories.find({"review.status": "pending_review"}, {"vectors": 0, "item_keys": 0})
        return await cursor.to_list(length=None)

    async def set_story_review(self, story_id: str, review: dict, *, merge: bool = False) -> None:
        update = {f"review.{k}": v for k, v in review.items()} if merge else {"review": review}
        await self.stories.update_one({"_id": story_id}, {"$set": update})

    async def set_item_fields(self, key: str, fields: dict) -> None:
        await self.items.update_one({"key": key}, {"$set": fields})

    async def set_story_fields(self, story_id: str, fields: dict) -> None:
        await self.stories.update_one({"_id": story_id}, {"$set": fields})

    async def website_url(self, key: str) -> str | None:
        """Some URL on a website, to find its feed: a direct article link, or the outlet URL
        Google News gives for its results."""
        if not key or not re.fullmatch(r"[\w-]+", key):
            return None
        doc = await self.stories.find_one(
            {f"websites.{key}.url": {"$exists": True, "$not": {"$regex": "news\\.google\\.com"}}},
            {f"websites.{key}.url": 1})
        if doc:
            return doc["websites"][key]["url"]
        doc = await self.items.find_one(
            {"extra.publisher_url": {"$regex": f"[/.]{re.escape(key)}\\."}}, {"extra.publisher_url": 1})
        return doc["extra"]["publisher_url"] if doc else None

    async def get_state(self, key: str):
        doc = await self.state.find_one({"_id": key})
        return doc["value"] if doc else None

    async def set_state(self, key: str, value) -> None:
        await self.state.update_one({"_id": key}, {"$set": {"value": value}}, upsert=True)

    async def story_articles(self, story_id: str) -> list[dict]:
        cursor = self.items.find({"story_id": story_id}, {"_id": 0, "engagement": 0, "extra.citations": 0})
        # (includes "key" and "triage", which story recounts need)
        return await cursor.to_list(length=None)

    async def record_poll(
        self, source: Source, *, ok: bool, fetched: int = 0, new: int = 0, error: str | None = None
    ) -> None:
        now = utcnow()
        update: dict[str, Any] = {
            "$set": {"name": source.name, "type": source.type, "region": source.region,
                     "role": source.role, "last_polled_at": now},
            "$inc": {"polls": 1, "items_new_total": new},
        }
        if ok:
            update["$set"].update(last_ok_at=now, last_fetched=fetched, last_new=new, last_error=None)
            update["$set"]["consecutive_errors"] = 0
        else:
            update["$set"].update(last_error=error, last_error_at=now)
            update["$inc"]["consecutive_errors"] = 1
        await self.source_status.update_one({"_id": source.id}, update, upsert=True)

    async def recent_items(
        self, *, region: str | None = None, role: str | None = None,
        include_baseline: bool = False, limit: int = 100,
    ) -> list[dict]:
        query: dict[str, Any] = {}
        if region:
            query["regions"] = region.upper()
        if role:
            query["source_role"] = role
        if not include_baseline:
            query["baseline"] = False
        cursor = self.items.find(query, {"_id": 0}).sort("first_seen_at", DESCENDING).limit(limit)
        return await cursor.to_list(length=limit)

    async def health(self) -> list[dict]:
        return await self.source_status.find().sort("_id", ASCENDING).to_list(length=None)

    async def stats(self) -> dict:
        by_region = await self.items.aggregate([
            {"$match": {"baseline": False}},
            {"$unwind": "$regions"},
            {"$group": {"_id": "$regions", "items": {"$sum": 1}}},
            {"$sort": {"items": -1}},
        ]).to_list(length=None)
        return {
            "items_total": await self.items.count_documents({}),
            "items_fresh": await self.items.count_documents({"baseline": False}),
            "fresh_by_region": {r["_id"]: r["items"] for r in by_region},
        }
