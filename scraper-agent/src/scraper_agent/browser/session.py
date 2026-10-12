"""A persistent, per-source browser profile (the "scraping" profile) with a lock so two jobs never share one."""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from filelock import FileLock, Timeout

from ..config import Settings


class ProfileBusyError(RuntimeError):
    pass


def _async_playwright(engine: str):
    if engine == "patchright":
        try:
            from patchright.async_api import async_playwright
        except ImportError as exc:
            raise RuntimeError("BROWSER_ENGINE=patchright needs: pip install 'scraper-agent[patchright]'") from exc
        return async_playwright
    from playwright.async_api import async_playwright

    return async_playwright


def profile_path(settings: Settings, slug: str) -> Path:
    return Path(settings.profile_dir) / slug


def state_path(settings: Settings, slug: str) -> Path:
    return Path(settings.profile_dir) / f"{slug}.state.json"


async def _restore_session(context: Any, path: Path) -> None:
    """Re-adds saved cookies. Session cookies (no expiry) are discarded by Chromium when a profile closes, so we keep them."""
    if not path.exists():  # noqa: ASYNC240 (tiny local file)
        return
    try:
        cookies = json.loads(path.read_text()).get("cookies", [])  # noqa: ASYNC240
        if cookies:
            await context.add_cookies(cookies)
    except (ValueError, OSError):
        pass  # a corrupt state file just means we log in again


async def _save_session(context: Any, path: Path) -> None:
    state = await context.storage_state()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as handle:
        json.dump(state, handle)


@asynccontextmanager
async def open_profile(settings: Settings, slug: str, *, lock_timeout_s: float = 30) -> AsyncIterator[Any]:
    """Yields a Playwright BrowserContext backed by the persistent profile directory for `slug`.

    Cookies and local storage survive between runs, so a login is reused until it expires.
    """
    directory = profile_path(settings, slug)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = FileLock(str(directory) + ".lock")
    try:
        lock.acquire(timeout=lock_timeout_s)
    except Timeout as exc:
        raise ProfileBusyError(f"browser profile for {slug!r} is in use by another job") from exc
    try:
        async with _async_playwright(settings.browser_engine)() as pw:
            context = await pw.chromium.launch_persistent_context(
                str(directory),
                headless=not settings.headed,
                user_agent=settings.user_agent,
                viewport={"width": 1366, "height": 900},
                accept_downloads=False,
            )
            context.set_default_timeout(settings.request_timeout_s * 1000)
            await _restore_session(context, state_path(settings, slug))
            try:
                yield context
            finally:
                try:
                    await _save_session(context, state_path(settings, slug))
                finally:
                    await context.close()
    finally:
        lock.release()
