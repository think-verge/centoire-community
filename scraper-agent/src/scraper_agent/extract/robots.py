"""robots.txt handling following RFC 9309: 4xx = no rules (allow), 5xx/network = assume disallowed."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

# (url) -> (status, body). Injected so tests need no network.
TextFetcher = Callable[[str], Awaitable[tuple[int, str]]]


class RobotsCache:
    def __init__(self, fetch_text: TextFetcher, user_agent: str):
        self._fetch_text = fetch_text
        self._ua = user_agent
        self._parsers: dict[str, RobotFileParser | bool] = {}  # True = allow all, False = disallow all

    async def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._parsers:
            self._parsers[origin] = await self._load(origin)
        rules = self._parsers[origin]
        if isinstance(rules, bool):
            return rules
        return rules.can_fetch(self._ua, url)

    async def _load(self, origin: str) -> RobotFileParser | bool:
        try:
            status, body = await self._fetch_text(f"{origin}/robots.txt")
        except Exception:
            return False
        if status >= 500:
            return False
        if status >= 400:
            return True
        parser = RobotFileParser()
        parser.parse(body.splitlines())
        return parser
