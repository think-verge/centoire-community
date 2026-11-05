"""Run the poller without the API.

    python -m scripts.poll          # poll forever
    python -m scripts.poll --once   # one round over every source, then print a summary
"""
from __future__ import annotations

import argparse
import asyncio
import logging

from app.config import get_settings
from app.poller import Poller
from app.sources import load_watchlist
from app.store import Store


async def main(once: bool) -> None:
    settings = get_settings()
    store = Store(settings.mongodb_uri, settings.mongodb_db)
    await store.init()
    poller = Poller(settings, store, load_watchlist(settings))
    if not once:
        await poller.run_forever()
        return
    await poller.run_round()
    for row in await store.health():
        flag = "ok " if not row.get("last_error") else "ERR"
        print(f"{flag} {row['_id']:<24} {row['region']:<6} fetched={row.get('last_fetched', 0):<4} "
              f"{row.get('last_error') or ''}")
    print(await store.stats())


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    asyncio.run(main(parser.parse_args().once))
