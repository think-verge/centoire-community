"""`scraper` command line: run the daemon, process one job, dry-run a spec, validate specs."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from ..backend_client import BackendClient
from ..config import get_settings
from ..extract.replay import extract_article, list_items
from ..spec import load_spec, spec_path
from .daemon import process_next, run_daemon
from .runner import fetcher_for


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


async def _dry_run(slug: str, limit: int) -> int:
    settings = get_settings()
    spec = load_spec(spec_path(settings.sources_dir, slug))
    fetcher = fetcher_for(settings, spec)
    try:
        items = (await list_items(spec, fetcher))[:limit]
        print(f"{slug}: {len(items)} item(s) listed")
        for item in items:
            candidate = await extract_article(spec, fetcher, item)
            print(f"- {candidate.title[:80]!r} | body {len(candidate.content_text)} chars | {candidate.url}")
    finally:
        await fetcher.aclose()
    return 0


def _validate(slug: str | None) -> int:
    settings = get_settings()
    paths = [spec_path(settings.sources_dir, slug)] if slug else sorted(settings.sources_dir.glob("*.yaml"))
    bad = 0
    for path in paths:
        try:
            load_spec(path)
            print(f"ok   {path.name}")
        except Exception as exc:
            bad += 1
            print(f"FAIL {path.name}: {exc}")
    return 1 if bad else 0


async def _once() -> int:
    settings = get_settings()
    backend = BackendClient(settings)
    try:
        worked = await process_next(backend, settings)
        print("processed one job" if worked else "queue empty")
    finally:
        await backend.aclose()
    return 0


async def _daemon() -> int:
    settings = get_settings()
    backend = BackendClient(settings)
    try:
        await run_daemon(settings, backend)
    finally:
        await backend.aclose()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scraper")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("daemon", help="poll the backend for jobs and run them")
    sub.add_parser("once", help="lease and run a single job")
    dry = sub.add_parser("dry-run", help="replay a spec locally and print what it would import (no backend)")
    dry.add_argument("slug")
    dry.add_argument("--limit", type=int, default=5)
    val = sub.add_parser("validate", help="validate spec files")
    val.add_argument("slug", nargs="?")
    args = parser.parse_args(argv)
    _setup_logging(args.verbose)

    if args.cmd == "validate":
        return _validate(args.slug)
    if args.cmd == "dry-run":
        return asyncio.run(_dry_run(args.slug, args.limit))
    if args.cmd == "once":
        return asyncio.run(_once())
    return asyncio.run(_daemon())


if __name__ == "__main__":
    sys.exit(main())
