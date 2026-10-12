"""Page fetching. The replay engine only needs `get(url) -> Page`, so a browser can stand in for plain HTTP."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import httpx

from ..config import Settings
from ..spec.models import Policy
from .ratelimit import HostLimiter
from .robots import RobotsCache


class FetchError(Exception):
    """A page could not be fetched. `code` maps onto the backend's error codes."""

    def __init__(self, message: str, code: str = "network"):
        super().__init__(message)
        self.code = code


@dataclass
class Page:
    url: str
    final_url: str
    status: int
    html: str


class Fetcher(Protocol):
    async def get(self, url: str) -> Page: ...
    async def aclose(self) -> None: ...


class HttpFetcher:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(
            headers={"User-Agent": settings.user_agent, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"},
            timeout=settings.request_timeout_s,
            follow_redirects=True,
        )

    async def get(self, url: str) -> Page:
        try:
            res = await self._client.get(url)
        except httpx.HTTPError as exc:
            raise FetchError(f"{type(exc).__name__}: {exc}") from exc
        if res.status_code in (401, 403, 429):
            raise FetchError(f"HTTP {res.status_code} from {url}", code="blocked")
        if res.status_code >= 400:
            raise FetchError(f"HTTP {res.status_code} from {url}")
        return Page(url=url, final_url=str(res.url), status=res.status_code, html=res.text)

    async def text(self, url: str) -> tuple[int, str]:
        res = await self._client.get(url)
        return res.status_code, res.text

    async def aclose(self) -> None:
        await self._client.aclose()


class PoliteFetcher:
    """Wraps any fetcher with robots.txt enforcement and per-host rate limiting from the source's policy."""

    def __init__(self, inner: Fetcher, policy: Policy, robots: RobotsCache | None, limiter: HostLimiter | None = None):
        self._inner = inner
        self._policy = policy
        self._robots = robots
        self._limiter = limiter or HostLimiter(policy.rate_limit_rps)

    async def get(self, url: str) -> Page:
        if self._policy.respect_robots and self._robots and not await self._robots.allowed(url):
            raise FetchError(f"robots.txt disallows {url}", code="blocked")
        await self._limiter.wait(url)
        return await self._inner.get(url)

    async def aclose(self) -> None:
        await self._inner.aclose()
