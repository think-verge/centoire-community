"""Read the current articles of every feed for credited origins, then run one promotion pass.

The running engine does this for each new article; use this to seed a fresh database
or after changing the extraction rules.

    python -m scripts.trace_origins
"""
from __future__ import annotations

import asyncio
import logging

from app.config import get_settings
from app.fetchers import NotModified
from app.poller import Poller
from app.sources import load_watchlist
from app.store import Store


async def main() -> None:
    settings = get_settings()
    store = Store(settings.mongodb_uri, settings.mongodb_db)
    await store.init()
    sources = load_watchlist(settings) + await store.discovered_sources()
    poller = Poller(settings, store, sources)
    traced = [s for s in poller.sources
              if s.type in ("rss", "reddit") and s.role not in ("benchmark", "aggregator")]
    async with poller._client() as client:
        for source in traced:
            try:
                items = await poller._fetch(client, source)
            except NotModified:
                continue
            except Exception as exc:
                print(f"skip {source.id}: {type(exc).__name__}: {exc}"[:120])
                continue
            await poller.origins.process(client, source, items)
            print(f"{source.id:<22} {len(items):>3} articles read")
        added = await poller.origins.promote(client)
    rows = await store.origin_candidates()
    print(f"\n{len(rows)} credited names, {added} sources added this pass. Top 25 by publishers:")
    rows.sort(key=lambda r: (len(r.get("publishers", [])), r.get("stories", 0)), reverse=True)
    for r in rows[:25]:
        print(f"  {r['_id']:<34} publishers={len(r.get('publishers', [])):<2} stories={r.get('stories', 0):<3} "
              f"{r['status']:<18} {r.get('status_reason', '')[:60]}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(main())
