"""Citation extraction: who a news article credits as the origin of its story.

Pure text functions, used by the feed parser and by app.origins.
"""
from __future__ import annotations

import html
import re
from urllib.parse import urljoin, urlsplit

_BLOCK_TAGS = re.compile(r"</?(?:p|br|li|ul|ol|div|h\d|figcaption|figure|blockquote|tr|section)\b[^>]*>", re.I)
_TAGS = re.compile(r"<[^>]+>")
_CODE = re.compile(r"<(style|script|noscript|svg)\b.*?</\1>", re.S | re.I)
_HANDLE = r"@?[A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?"

# "Photos: a, b and c" / "Images and video via Nike" / "Credit: @x" / "h/t @x"
_CREDIT_RE = re.compile(
    r"\b(?:photos?|images?|imagery|pics?|video|credits?|sources?|h/t|hat tip)"
    r"(?:\s*(?:and|&)\s*(?:video|photos?|images?))?"
    r"\s*(?::|\bvia\b|\bby\b|\bcourtesy of\b|\bfrom\b)\s*(?P<names>[^\n.;!]{1,120})",
    re.I,
)
# "surfaced via Nike", "first look courtesy of @x", "leaked by zsneakerheadz"
_SURFACED_RE = re.compile(
    r"\b(?:surfaced|emerged|emerging|appeared|leaked|leaks?|first look|teased|spotted|shared|revealed|previewed)"
    r"\s+(?:\w+\s+){0,2}?(?:via|by|courtesy of|thanks to)\s+(?P<names>" + _HANDLE + r")",
    re.I,
)
_IG_EMBED_RE = re.compile(r"A post shared by [^()\n]{0,80}\(@(?P<h>[A-Za-z0-9_.]{1,30})\)")
_LINK_RE = re.compile(r"""href=["'](https?://[^"']+)["']""", re.I)
_IG_RESERVED = {"p", "reel", "reels", "tv", "explore", "stories", "accounts", "about", "developer",
                "legal", "embed.js", "direct", "web"}
_X_RESERVED = {"intent", "share", "home", "search", "hashtag", "i", "login"}
_NAME_STOP = re.compile(r"\b(?:the|a|an|of|in|on|at|for|with|our|their|its|below|above|here)\b", re.I)
# Domains linked in articles that are never origins (social, shops-of-everything, affiliates).
_DOMAIN_IGNORE = re.compile(
    r"(?:^|\.)(?:google|goo\.gl|facebook|fb|instagram|x|twitter|tiktok|youtube|youtu\.be|pinterest|"
    r"threads|linkedin|reddit|wikipedia|amazon|ebay|stockx|goat|flightclub|apple|spotify|"
    r"kqzyfj|awin1|anrdoezrs|jdoqocy|tkqlhce|dpbolvw|shareasale|skimresources|go\.skimresources|"
    r"rstyle|shopstyle|linksynergy|narrativ|howl|sovrn|viglink|bit\.ly|wp\.me|gravatar|wordpress|"
    r"doubleclick|cloudfront|amazonaws|shopify|klaviyo|mailchimp|disqus|redd\.it|imgur|tumblr|"
    r"del\.icio\.us|delicious|digg|stumbleupon|flipboard|feedburner|whatsapp|telegram|t\.me|"
    r"pinimg|giphy|vimeo|soundcloud|apple\.co)\.?\w*(?:\.\w+)?$"
    r"|^(?:mail|email|preferences|subscribe|newsletter|cdn|static|media|images?|img)\.",
    re.I,
)


def _text(fragment: str) -> str:
    return html.unescape(_TAGS.sub(" ", _BLOCK_TAGS.sub("\n", _CODE.sub(" ", fragment))))


def _split_names(raw: str) -> list[str]:
    names = []
    for part in re.split(r",|\s+and\s+|\s*&\s*|\s*/\s*|\s+x\s+", raw):
        name = part.strip().strip("()[]\"'“”‘’:").rstrip("?!").strip()
        if not name:
            continue
        words = name.split()
        # A credit is a handle or a short proper name; longer runs are sentence text.
        if (len(words) > 4 or (len(words) > 1 and _NAME_STOP.search(name)) or not re.search(r"[A-Za-z]", name)
                or re.search(r"[{}();=<>]", name)):
            break
        names.append(name)
    return names


def _candidate(name: str) -> tuple[str, str] | None:
    """(platform, name) for a credited name. Single tokens are Instagram handles: that's how
    sneaker and streetwear publishers credit leakers and brands."""
    name = name.strip()
    if re.fullmatch(_HANDLE, name):
        return "instagram", name.lstrip("@").lower()
    if len(name) >= 3:
        return "name", " ".join(name.split())
    return None


def _link_candidate(url: str) -> tuple[str, str] | None:
    parts = urlsplit(url)
    host = parts.netloc.lower().removeprefix("www.").removeprefix("m.")
    segs = [s for s in parts.path.split("/") if s]
    if host == "instagram.com":
        if segs and segs[0].lower() not in _IG_RESERVED and re.fullmatch(r"[A-Za-z0-9_.]{1,30}", segs[0]):
            return "instagram", segs[0].lower()
        return None
    if host in ("x.com", "twitter.com"):
        if segs and segs[0].lower() not in _X_RESERVED:
            return "x", segs[0].lower()
        return None
    if host == "tiktok.com":
        return ("tiktok", segs[0][1:].lower()) if segs and segs[0].startswith("@") else None
    if host == "youtube.com":
        return ("youtube", segs[0][1:].lower()) if segs and segs[0].startswith("@") else None
    if host == "weibo.com":
        return ("weibo", segs[0].lower()) if segs and segs[0] not in ("tv", "ttarticle") else None
    if host == "reddit.com":
        return ("reddit", segs[1].lower()) if len(segs) > 1 and segs[0] == "r" else None
    if host and "." in host and not _DOMAIN_IGNORE.search(host):
        return "website", host
    return None


def extract_citations(fragment: str, base_url: str = "", own_host: str = "") -> list[dict]:
    """Credited origins in an article's HTML: [{platform, name, kind, context}]."""
    text = _text(fragment)
    found: dict[tuple[str, str], dict] = {}

    def add(cand: tuple[str, str] | None, kind: str, context: str) -> None:
        if cand and cand not in found:
            found[cand] = {"platform": cand[0], "name": cand[1], "kind": kind,
                           "context": " ".join(context.split())[:160]}

    for m in _IG_EMBED_RE.finditer(text):
        add(("instagram", m.group("h").lower()), "embed", m.group(0))
    # The embed line's display name ("shared by flame (@…)") is not a credit of its own.
    text = _IG_EMBED_RE.sub(" ", text)
    for m in _CREDIT_RE.finditer(text):
        for name in _split_names(m.group("names")):
            add(_candidate(name), "credit", m.group(0))
    for m in _SURFACED_RE.finditer(text):
        add(_candidate(m.group("names")), "credit", m.group(0))
    own = own_host.lower().removeprefix("www.")
    for m in _LINK_RE.finditer(fragment):
        url = urljoin(base_url, html.unescape(m.group(1)))
        cand = _link_candidate(url)
        if cand and not (cand[0] == "website" and own and (cand[1] == own or cand[1].endswith("." + own))):
            add(cand, "link", url)
    return list(found.values())


_ARTICLE_RE = [
    re.compile(r"<article\b[^>]*>(.*?)</article>", re.S | re.I),
    re.compile(r"""<div[^>]+class=["'][^"']*(?:entry-content|post-content|td-post-content|article-body|article__body|story-body)[^"']*["'][^>]*>(.*)""", re.S | re.I),
]


def article_body(page: str) -> str:
    """The article part of a page, so sidebars and footers don't add their links."""
    for pattern in _ARTICLE_RE:
        bodies = pattern.findall(page)
        if bodies:
            return max(bodies, key=len)[:200_000]
    return page
