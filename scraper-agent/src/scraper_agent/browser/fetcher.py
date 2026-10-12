"""A Fetcher that renders pages in a logged-in browser, so paid content is visible to the extractor."""

from __future__ import annotations

from typing import Any

from ..extract.fetcher import FetchError, Page
from ..spec.models import AuthSpec
from .auth import ensure_logged_in


class BrowserFetcher:
    def __init__(self, context: Any, site_url: str, auth: AuthSpec, credential, *, timeout_ms: int = 20_000):
        self._context = context
        self._site_url = site_url
        self.auth = auth  # discovery replaces this as it learns the login steps
        self._credential = credential
        self._timeout_ms = timeout_ms
        self._page: Any | None = None
        self._logged_in = False

    async def _ensure_ready(self) -> Any:
        if self._page is None:
            self._page = await self._context.new_page()
        if not self._logged_in and self.auth.required:
            await ensure_logged_in(self._page, self._site_url, self.auth, self._credential)
            self._logged_in = True
        return self._page

    async def ensure_login(self) -> bool:
        """Logs in now (raising ReplayError on failure). Returns True if a fresh login was needed."""
        if self._page is None:
            self._page = await self._context.new_page()
        self._logged_in = False
        did = await ensure_logged_in(self._page, self._site_url, self.auth, self._credential)
        self._logged_in = True
        return did

    async def get(self, url: str) -> Page:
        page = await self._ensure_ready()
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=self._timeout_ms)
        except Exception as exc:  # playwright raises its own Error/TimeoutError types
            raise FetchError(f"{type(exc).__name__}: {exc}") from exc
        status = response.status if response else 0
        if status in (401, 403, 429):
            raise FetchError(f"HTTP {status} from {url}", code="blocked")
        if status >= 400:
            raise FetchError(f"HTTP {status} from {url}")
        # Give client-rendered pages a moment to settle, but never wait forever on chatty sites.
        try:
            await page.wait_for_load_state("networkidle", timeout=3_000)
        except Exception:
            pass
        return Page(url=url, final_url=page.url, status=status, html=await page.content())

    async def aclose(self) -> None:
        if self._page is not None:
            await self._page.close()
            self._page = None
