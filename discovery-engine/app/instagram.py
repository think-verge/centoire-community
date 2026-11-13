"""Instagram via the Graph API's business discovery (Instagram API with Facebook Login).

One request reads one public Business/Creator account's latest posts, including
fresh like/comment counts for each of them. Meta does not publish the hourly
allowance for user tokens, so we plan around a configured budget and back off
when the X-App-Usage header or a throttling error says we are close.

The access token travels only as a request parameter and never appears in
log lines or error messages (httpx errors would otherwise include the URL).
"""
from __future__ import annotations

import json
import re
import time
from collections import deque

import httpx

from app.config import Settings
from app.fetchers import _clean, _parse_iso
from app.models import FetchedItem

MEDIA_FIELDS = (
    "id,caption,media_type,media_product_type,permalink,timestamp,"
    "like_count,comments_count,thumbnail_url,media_url"
)
# Meta's throttling error codes: app limit, user limit, Pages limit, custom limit.
THROTTLE_CODES = {4, 17, 32, 613}
MENTION_RE = re.compile(r"(?<![\w.@])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?)")
HASHTAG_RE = re.compile(r"#(\w{2,50})")


class InstagramError(Exception):
    def __init__(self, message: str, code: int | None = None, throttled: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.throttled = throttled


class InstagramSkipped(Exception):
    """Not polled this round: budget used up or backing off. Not an error."""


def parse_business_discovery(bd: dict) -> list[FetchedItem]:
    """One business_discovery payload -> one item per post."""
    username = bd.get("username") or ""
    followers = bd.get("followers_count")
    items: list[FetchedItem] = []
    for m in (bd.get("media") or {}).get("data", []):
        permalink = m.get("permalink")
        if not permalink:
            continue
        caption = m.get("caption") or ""
        media_type = (m.get("media_type") or "post").lower()
        first_line = next((line for line in caption.splitlines() if line.strip()), "")
        mentions = sorted(
            {h.lower() for h in MENTION_RE.findall(caption)} - {username.lower()}
        )
        items.append(
            FetchedItem(
                url=permalink,
                title=_clean(first_line, 200) or f"@{username} posted a new {media_type.replace('_', ' ')}",
                summary=_clean(caption, 1000),
                image_url=m.get("thumbnail_url") or m.get("media_url"),
                published_at=_parse_iso(m.get("timestamp")),
                publisher=f"@{username}",
                extra={
                    "handle": username.lower(),
                    "media_id": m.get("id"),
                    "media_type": m.get("media_type"),
                    "product_type": m.get("media_product_type"),
                    "like_count": m.get("like_count"),
                    "comments_count": m.get("comments_count"),
                    "followers": followers,
                    "mentions": mentions,
                    "hashtags": sorted({h.lower() for h in HASHTAG_RE.findall(caption)})[:20],
                },
            )
        )
    return items


class InstagramClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.base = f"https://graph.facebook.com/{settings.meta_graph_version}"
        self.paused_until = 0.0
        self.last_usage: dict = {}
        self._calls: deque[float] = deque()

    @property
    def configured(self) -> bool:
        return bool(self.settings.ig_user_id and self.settings.ig_access_token)

    def calls_last_hour(self) -> int:
        cutoff = time.time() - 3600
        while self._calls and self._calls[0] < cutoff:
            self._calls.popleft()
        return len(self._calls)

    def _pause(self, seconds: float) -> None:
        self.paused_until = max(self.paused_until, time.time() + seconds)

    def _note_usage(self, header: str | None) -> None:
        if not header:
            return
        try:
            usage = json.loads(header)
        except ValueError:
            return
        self.last_usage = usage
        peak = max((v for v in usage.values() if isinstance(v, (int, float))), default=0)
        if peak >= 90:
            self._pause(1800)
        elif peak >= 75:
            self._pause(900)

    async def fetch(self, client: httpx.AsyncClient, handle: str) -> list[FetchedItem]:
        if time.time() < self.paused_until:
            raise InstagramSkipped("backing off after rate-limit signal")
        if self.calls_last_hour() >= self.settings.ig_max_calls_per_hour:
            raise InstagramSkipped("hourly call budget used")

        fields = (
            f"business_discovery.username({handle})"
            f"{{username,name,followers_count,media_count,"
            f"media.limit({self.settings.ig_posts_per_call}){{{MEDIA_FIELDS}}}}}"
        )
        params = {"fields": fields, "access_token": self.settings.ig_access_token}
        self._calls.append(time.time())
        try:
            resp = await client.get(f"{self.base}/{self.settings.ig_user_id}", params=params)
        except httpx.HTTPError as exc:
            raise InstagramError(f"network error: {type(exc).__name__}") from None

        self._note_usage(resp.headers.get("x-app-usage"))
        try:
            data = resp.json()
        except ValueError:
            raise InstagramError(f"HTTP {resp.status_code}: non-JSON response") from None

        if "error" in data or resp.status_code >= 400:
            err = data.get("error") or {}
            code = err.get("code")
            message = str(err.get("message") or f"HTTP {resp.status_code}")[:200]
            throttled = code in THROTTLE_CODES
            if throttled:
                self._pause(1800)
            raise InstagramError(f"[{code}] {message}", code=code, throttled=throttled)

        return parse_business_discovery(data.get("business_discovery") or {})
