"""Runs one leased job: `scrape` replays the source's YAML spec; `discover` produces (or repairs) it."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from ..backend_client import BackendClient, BackendError, LeasedJob
from ..browser.session import ProfileBusyError
from ..config import Settings
from ..extract.bootstrap import bootstrap_rss_spec
from ..extract.fetcher import Fetcher, FetchError, HttpFetcher, PoliteFetcher
from ..extract.replay import ReplayError, extract_article, list_items
from ..extract.robots import RobotsCache
from ..secrets import SecretsError
from ..spec import SourceSpec, dump_spec, load_spec, spec_hash, spec_path
from ..util import slugify
from .runner_types import JobResult

log = logging.getLogger("scraper.runner")

# More than this share of articles failing to extract means the layout changed, not that a few pages were odd.
LAYOUT_FAILURE_RATIO = 0.6
MIN_ITEMS_FOR_RATIO = 3


@asynccontextmanager
async def open_fetcher(settings: Settings, spec: SourceSpec | None = None):
    """Plain HTTP for open sources; a logged-in persistent browser (with the same politeness rules) for login sources."""
    if spec is None or not spec.auth.required:
        fetcher = fetcher_for(settings, spec)
        try:
            yield fetcher
        finally:
            await fetcher.aclose()
        return

    from ..browser.fetcher import BrowserFetcher
    from ..browser.session import open_profile
    from ..secrets import load_credential

    credential = load_credential(settings.secrets_file, spec.auth.credential_ref or "")
    async with open_profile(settings, spec.source) as context:
        inner = BrowserFetcher(context, str(spec.site), spec.auth, credential, timeout_ms=int(settings.request_timeout_s * 1000))
        polite = PoliteFetcher(inner, spec.policy, RobotsCache(HttpFetcher(settings).text, settings.user_agent))
        try:
            yield polite
        finally:
            await polite.aclose()


def fetcher_for(settings: Settings, spec: SourceSpec | None = None) -> Fetcher:
    """Plain HTTP (with robots + rate limits). Login sources get a browser-backed fetcher (see browser/)."""
    inner = HttpFetcher(settings)
    from ..spec.models import Policy

    policy = spec.policy if spec else Policy()
    robots = RobotsCache(inner.text, settings.user_agent)
    return PoliteFetcher(inner, policy, robots)


async def _heartbeats(backend: BackendClient, job_id: str, every: float) -> None:
    while True:
        await asyncio.sleep(every)
        try:
            await backend.heartbeat(job_id)
        except BackendError as exc:
            log.warning("heartbeat failed: %s", exc)


async def run_job(job: LeasedJob, backend: BackendClient, settings: Settings) -> JobResult:
    beat = asyncio.create_task(_heartbeats(backend, job.id, settings.heartbeat_interval_s))
    try:
        if job.type == "discover":
            return await discover_source(job, backend, settings)
        return await scrape_source(job, backend, settings)
    except ReplayError as exc:
        return JobResult(False, error_code=exc.code, error_message=str(exc))
    except FetchError as exc:
        return JobResult(False, error_code=exc.code, error_message=str(exc))
    except Exception as exc:  # never let one bad job take the daemon down
        log.exception("job %s crashed", job.id)
        return JobResult(False, error_code="internal", error_message=f"{type(exc).__name__}: {exc}")
    finally:
        beat.cancel()
        with suppress(asyncio.CancelledError):
            await beat


def _spec_file(settings: Settings, source: dict) -> Path:
    return spec_path(settings.sources_dir, slugify(source["name"]))


async def discover_source(job: LeasedJob, backend: BackendClient, settings: Settings) -> JobResult:
    source = job.source
    fetcher = fetcher_for(settings)
    try:
        spec = await bootstrap_rss_spec(source, fetcher)
    finally:
        await fetcher.aclose()
    if spec is None:
        # Needs the LLM discovery graph (browser exploration); wired in by graphs.discover.
        from ..graphs.discover import run_discovery  # local import: heavy, optional dependencies

        return await run_discovery(job, backend, settings)
    return await _publish_spec(spec, source, backend, settings)


async def _publish_spec(spec: SourceSpec, source: dict, backend: BackendClient, settings: Settings) -> JobResult:
    from datetime import UTC, datetime

    from .. import __version__

    spec.discovered.at = datetime.now(UTC)
    spec.discovered.agent_version = __version__
    path = _spec_file(settings, source)
    dump_spec(spec, path)
    log.info("wrote %s (%s)", path, spec.discovered.spec_hash)
    await backend.report_spec(source["id"], status="ready", spec_hash=spec.discovered.spec_hash, store=spec.policy.store if spec.policy.store == "excerpt" else None)
    return JobResult(True)


async def scrape_source(job: LeasedJob, backend: BackendClient, settings: Settings) -> JobResult:
    source = job.source
    path = _spec_file(settings, source)
    if not path.exists():
        return JobResult(False, error_code="layout_changed", error_message=f"No spec for {source['name']}; discovery needed")
    spec = load_spec(path)
    if spec.source_id and spec.source_id != source["id"]:
        return JobResult(False, error_code="internal", error_message=f"{path.name} belongs to source {spec.source_id}, not {source['id']}")

    stats = {"itemsSeen": 0, "imported": 0, "duplicates": 0, "updated": 0}
    try:
        async with open_fetcher(settings, spec) as fetcher:
            items = await list_items(spec, fetcher)
            stats["itemsSeen"] = len(items)
            known = await backend.existing_urls([i.url for i in items])
            fresh = [i for i in items if i.url not in known]
            stats["duplicates"] = len(items) - len(fresh)

            keep_body = spec.effective_store(source["spec"].get("store")) == "full"
            digest = spec_hash(spec)
            failures = 0
            blocked = 0
            for item in fresh:
                try:
                    candidate = await extract_article(spec, fetcher, item)
                    result = await backend.upsert_post(source["id"], candidate.to_payload(keep_body=keep_body, spec_hash=digest))
                except ReplayError as exc:
                    if exc.code in {"login_expired", "blocked", "needs_human"}:
                        raise
                    failures += 1
                    log.warning("skipping %s: %s", item.url, exc)
                    continue
                except FetchError as exc:
                    if exc.code == "blocked":
                        blocked += 1  # robots.txt or a block page: skip it, it says nothing about the layout
                    else:
                        failures += 1
                    log.warning("fetch failed for %s: %s", item.url, exc)
                    continue
                stats["imported" if result.outcome == "created" else "updated" if result.outcome == "updated" else "duplicates"] += 1

            if fresh and blocked == len(fresh):
                return JobResult(False, stats=stats, error_code="blocked", error_message=f"All {blocked} articles were blocked (robots.txt or the site)")
            if len(fresh) >= MIN_ITEMS_FOR_RATIO and failures / len(fresh) >= LAYOUT_FAILURE_RATIO:
                return JobResult(False, stats=stats, error_code="layout_changed", error_message=f"{failures} of {len(fresh)} articles could not be extracted")
            return JobResult(True, stats=stats)
    except (ReplayError, FetchError) as exc:
        return JobResult(False, stats=stats, error_code=exc.code, error_message=str(exc))
    except (SecretsError, ProfileBusyError) as exc:
        # Misconfiguration a person must fix (missing/loose secrets file, no entry for this login, profile in use).
        return JobResult(False, stats=stats, error_code="needs_human", error_message=str(exc))
