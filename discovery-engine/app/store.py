"""MongoDB storage: items (deduped, with first-seen times) and per-source poll health."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import motor.motor_asyncio
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

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

    async def init(self) -> None:
        await self.items.create_index("key", unique=True)
        await self.items.create_index([("first_seen_at", DESCENDING)])
        await self.items.create_index([("regions", ASCENDING), ("first_seen_at", DESCENDING)])
        await self.items.create_index([("source_id", ASCENDING), ("first_seen_at", DESCENDING)])

    async def has_polled(self, source_id: str) -> bool:
        doc = await self.source_status.find_one({"_id": source_id}, {"last_ok_at": 1})
        return bool(doc and doc.get("last_ok_at"))

    async def save_items(self, source: Source, fetched: list[FetchedItem], *, baseline: bool) -> int:
        """Insert unseen items; return how many were new. Existing keys keep their first_seen_at."""
        new = 0
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
                new += 1
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

    async def candidates(self, watched: set[str], limit: int = 50) -> list[dict]:
        """Mentioned accounts not on the watchlist, most-mentioned by distinct accounts first."""
        rows = await self.ig_candidates.aggregate([
            {"$match": {"_id": {"$nin": sorted(watched)}}},
            {"$addFields": {"mentioned_by_count": {"$size": "$mentioned_by"}}},
            {"$sort": {"mentioned_by_count": -1, "mentions": -1}},
            {"$limit": limit},
        ]).to_list(length=limit)
        return [{"handle": r.pop("_id"), **r} for r in rows]

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
