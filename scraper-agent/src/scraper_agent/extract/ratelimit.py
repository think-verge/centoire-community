from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from urllib.parse import urlsplit


class HostLimiter:
    """Spaces requests to the same host by at least 1/rps seconds."""

    def __init__(self, rps: float, clock=time.monotonic, sleep=asyncio.sleep):
        self._interval = 1.0 / rps
        self._last: dict[str, float] = {}
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._clock = clock
        self._sleep = sleep

    async def wait(self, url: str) -> None:
        host = urlsplit(url).netloc
        async with self._locks[host]:
            now = self._clock()
            ready_at = self._last.get(host, 0.0) + self._interval
            if ready_at > now:
                await self._sleep(ready_at - now)
            self._last[host] = self._clock()
