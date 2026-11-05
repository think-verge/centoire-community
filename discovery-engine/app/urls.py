"""URL canonicalisation and dedupe keys."""
from __future__ import annotations

import hashlib
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_TRACKING_PARAMS = {"fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "ref", "ref_src", "cmpid"}


def canonical_url(url: str) -> str:
    """Lowercase scheme/host, drop fragments, tracking params and trailing slashes."""
    parts = urlsplit(url.strip())
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in _TRACKING_PARAMS
    ]
    path = parts.path.rstrip("/") or "/"
    host = parts.netloc.lower().removeprefix("www.")
    return urlunsplit((parts.scheme.lower() or "https", host, path, urlencode(query), ""))


def item_key(url: str, *, publisher: str | None = None, title: str | None = None) -> str:
    """Dedupe key. Google News links are opaque redirects, so those key on publisher + title."""
    if publisher and title and "news.google.com" in url:
        basis = f"gn|{publisher.strip().lower()}|{' '.join(title.lower().split())}"
    else:
        basis = canonical_url(url)
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:32]
