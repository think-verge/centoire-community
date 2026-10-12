"""Turning scraped markup into safe, tidy content: absolute URLs, a strict tag allow-list, plain text, excerpts."""

from __future__ import annotations

import re
from urllib.parse import urljoin

import nh3
from lxml import html as lxml_html

ALLOWED_TAGS = {
    "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code",
    "strong", "b", "em", "i", "u", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "span",
}  # fmt: skip
ALLOWED_ATTRS = {"a": {"href", "title"}, "img": {"src", "alt", "title", "width", "height"}}
_WS = re.compile(r"\s+")


def absolutize(fragment_html: str, base_url: str) -> str:
    """Resolves relative href/src against the page URL and drops lazy-load placeholders where a real src exists."""
    if not fragment_html.strip():
        return ""
    root = lxml_html.fragment_fromstring(fragment_html, create_parent="div")
    for el in root.iter("a"):
        if el.get("href"):
            el.set("href", urljoin(base_url, el.get("href")))
    for el in root.iter("img"):
        real = el.get("data-src") or el.get("data-original") or el.get("src")
        if real:
            el.set("src", urljoin(base_url, real))
    return "".join(lxml_html.tostring(child, encoding="unicode") for child in root) + (root.text or "")


def sanitize_html(fragment_html: str, base_url: str) -> str:
    cleaned = nh3.clean(
        absolutize(fragment_html, base_url),
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer nofollow",
        strip_comments=True,
    )
    return cleaned.strip()


def html_to_text(fragment_html: str) -> str:
    if not fragment_html.strip():
        return ""
    root = lxml_html.fragment_fromstring(fragment_html, create_parent="div")
    # Keep paragraph breaks readable, then collapse whitespace.
    for br in root.iter("br"):
        br.tail = "\n" + (br.tail or "")
    for block in root.iter("p", "li", "h1", "h2", "h3", "h4", "blockquote"):
        block.tail = "\n" + (block.tail or "")
    lines = (_WS.sub(" ", line).strip() for line in root.text_content().splitlines())
    return "\n".join(line for line in lines if line)


def make_excerpt(text: str, limit: int = 300) -> str:
    flat = _WS.sub(" ", text).strip()
    if len(flat) <= limit:
        return flat
    cut = flat[: limit - 1].rsplit(" ", 1)[0]
    return f"{cut}…"
