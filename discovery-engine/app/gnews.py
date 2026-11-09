"""Resolve a Google News article link (news.google.com/rss/articles/CBMi…) to the publisher's URL.

Google News RSS links don't redirect with HTTP: the article page carries a signature and a
timestamp, and the browser exchanges them (with the article id) for the real URL through
Google's batchexecute endpoint. We do the same exchange. Each resolution downloads a ~600 KB
page, so it's done only where it matters (links on stories sent for review), and remembered.
"""
from __future__ import annotations

import json
import logging
import re

import httpx

log = logging.getLogger("discovery.gnews")

_ID_RE = re.compile(r"news\.google\.com/(?:rss/)?articles/([A-Za-z0-9_-]+)")
_SIG_RE = re.compile(r'data-n-a-sg="([^"]+)"')
_TS_RE = re.compile(r'data-n-a-ts="([^"]+)"')
_RES_RE = re.compile(r'\\"garturlres\\",\\"(.*?)\\"')
BATCH_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute"


def article_id(url: str) -> str | None:
    m = _ID_RE.search(url)
    return m.group(1) if m else None


def parse_signature(page: str) -> tuple[str, int] | None:
    sig, ts = _SIG_RE.search(page), _TS_RE.search(page)
    return (sig.group(1), int(ts.group(1))) if sig and ts else None


def batch_body(gid: str, sig: str, ts: int) -> dict:
    inner = json.dumps(["garturlreq", [["X", "X", ["X", "X"], None, None, 1, 1, "US:en", None, 1, None, None,
                                        None, None, None, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, None, 0, 0, None, 0],
                        gid, ts, sig])
    return {"f.req": json.dumps([[["Fbv4je", inner, None, "generic"]]])}


def parse_resolved(text: str) -> str | None:
    m = _RES_RE.search(text)
    if not m:
        return None
    url = m.group(1).encode().decode("unicode_escape")
    return url if url.startswith("http") and "news.google.com" not in url else None


async def resolve(client: httpx.AsyncClient, url: str) -> str | None:
    """The publisher's URL behind a Google News link, or None if it can't be worked out."""
    gid = article_id(url)
    if not gid:
        return None
    try:
        page = await client.get(f"https://news.google.com/rss/articles/{gid}")
        page.raise_for_status()
        signed = parse_signature(page.text)
        if not signed:
            return None
        resp = await client.post(BATCH_URL, data=batch_body(gid, *signed),
                                 headers={"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"})
        resp.raise_for_status()
        return parse_resolved(resp.text)
    except httpx.HTTPError as exc:
        log.debug("could not resolve %s: %s", url, exc)
        return None
