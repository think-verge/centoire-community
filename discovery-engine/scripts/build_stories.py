"""Triage and group every article not yet in a story (the backlog from before stories existed).

    .venv/bin/python -m scripts.build_stories            # everything untriaged
    .venv/bin/python -m scripts.build_stories --days 3   # only articles from the last 3 days;
                                                         # older ones are marked skipped
    .venv/bin/python -m scripts.build_stories --reset    # forget all stories and start over

Run it while the engine is stopped, or the engine's own story loop will race it.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.gemini import Gemini
from app.sources import load_watchlist
from app.stories import BATCH, StoryBuilder, item_time
from app.store import Store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("build_stories")


async def main(reset: bool, days: float | None) -> None:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not set in .env")
    store = Store(settings.mongodb_uri, settings.mongodb_db)
    await store.init()
    if reset:
        await store.stories.delete_many({})
        await store.items.update_many({}, {"$unset": {"triage": "", "story_id": ""}})
    sources = load_watchlist(settings) + await store.discovered_sources()
    llm = Gemini(settings.gemini_api_key, text_model=settings.story_triage_model, embed_model=settings.embed_model)
    builder = StoryBuilder(store, llm, sources, triage_model=settings.story_triage_model,
                           match_model=settings.story_match_model)
    await builder.load(since=datetime(2000, 1, 1, tzinfo=timezone.utc))

    docs = await store.untriaged_items(100_000)
    docs.sort(key=item_time)
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        old = [d["key"] for d in docs if item_time(d) < cutoff]
        # Marked so the engine's story loop doesn't pick them up later.
        await store.items.update_many({"key": {"$in": old}},
                                      {"$set": {"triage": {"skipped": f"older than the {days:g}-day backfill"},
                                                "story_id": None}})
        docs = [d for d in docs if item_time(d) >= cutoff]
        log.info("skipped %d articles older than %g days", len(old), days)
    log.info("%d articles to triage", len(docs))
    t = time.monotonic()
    triage = await builder.triage_many(docs)
    relevant = sum(v["relevant"] for v in triage.values())
    log.info("triaged in %.0fs: %d relevant, %d not", time.monotonic() - t, relevant, len(triage) - relevant)

    for i in range(0, len(docs), BATCH):
        batch = docs[i:i + BATCH]
        await builder.process(batch, {d["key"]: triage[d["key"]] for d in batch})
        if i // BATCH % 10 == 0:
            log.info("grouped %d / %d", i + len(batch), len(docs))
    log.info("done: %d stories", await store.stories.count_documents({}))
    await llm.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--days", type=float, help="only articles published in the last N days")
    args = ap.parse_args()
    asyncio.run(main(args.reset, args.days))
