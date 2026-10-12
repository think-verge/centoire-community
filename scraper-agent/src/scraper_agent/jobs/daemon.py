from __future__ import annotations

import asyncio
import logging
import signal

from ..backend_client import BackendClient, BackendError
from ..config import Settings
from .runner import run_job

log = logging.getLogger("scraper.daemon")


async def process_next(backend: BackendClient, settings: Settings, types: list[str] | None = None) -> bool:
    """Leases and runs one job. Returns False when the queue was empty."""
    job = await backend.lease(types)
    if job is None:
        return False
    log.info("leased %s job %s for %s", job.type, job.id, job.source.get("name"))
    result = await run_job(job, backend, settings)
    await backend.complete(
        job.id,
        ok=result.ok,
        stats=result.stats if result.ok or result.stats.get("itemsSeen") else None,
        error_code=result.error_code,
        error_message=result.error_message,
    )
    log.info("job %s %s %s", job.id, "ok" if result.ok else "failed", result.error_code or result.stats)
    return True


async def run_daemon(settings: Settings, backend: BackendClient) -> None:
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    log.info("daemon started as %s -> %s", settings.worker_id, settings.backend_url)
    while not stop.is_set():
        try:
            worked = await process_next(backend, settings)
        except BackendError as exc:
            log.error("backend error: %s", exc)
            worked = False
        if not worked:
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.poll_interval_s)
            except TimeoutError:
                pass
    log.info("daemon stopped")
