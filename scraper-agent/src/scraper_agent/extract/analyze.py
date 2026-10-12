"""Deterministic page analysis that gives the LLM a small, useful view of a page instead of raw HTML.

Everything here is pure (HTML in, data out), so it is cheap to test and the model only has to make the judgement calls:
"which of these repeated blocks is the article list?", "which container is the article body?".
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from typing import Any
from urllib.parse import urljoin, urlsplit

from lxml import html as lxml_html

_WS = re.compile(r"\s+")
# Utility/hash-like class names make brittle selectors; skip them when building suggestions.
_UNSTABLE_CLASS = re.compile(r"(\d{3,}|^[a-z]{1,2}-?[0-9a-f]{5,}$|^css-|^_|^js-|^is-|^has-|^col-|^row$)")
_NOISE_TAGS = {"script", "style", "noscript", "svg", "iframe", "template", "head"}


def _text(el: Any) -> str:
    return _WS.sub(" ", el.text_content()).strip()


def _classes(el: Any) -> list[str]:
    return [c for c in (el.get("class") or "").split() if c and not _UNSTABLE_CLASS.search(c)]


def css_hint(el: Any) -> str:
    """A reasonably stable CSS selector for `el` (id, else tag + up to two stable classes)."""
    if el.get("id") and not _UNSTABLE_CLASS.search(el.get("id")):
        return f"{el.tag}#{el.get('id')}"
    classes = _classes(el)[:2]
    return el.tag + "".join(f".{c}" for c in classes)


def _signature(el: Any) -> str:
    """Structural fingerprint of an element: its own selector plus those of its ancestors up to <body>."""
    parts = []
    node = el
    while node is not None and node.tag not in {"body", "html"} and len(parts) < 4:
        parts.append(css_hint(node))
        node = node.getparent()
    return " < ".join(parts)


def _clean_doc(html: str) -> Any:
    doc = lxml_html.fromstring(html or "<html></html>")
    for bad in doc.xpath("//script|//style|//noscript|//svg|//template"):
        bad.drop_tree()
    return doc


@dataclass
class RepeatedBlock:
    selector: str
    count: int
    samples: list[dict[str, str]] = field(default_factory=list)


def repeated_link_blocks(html: str, base_url: str, *, limit: int = 5) -> list[RepeatedBlock]:
    """Groups same-site links by the structure of their enclosing block; big groups are likely article lists."""
    doc = _clean_doc(html)
    host = urlsplit(base_url).netloc
    groups: dict[str, list[tuple[Any, Any]]] = defaultdict(list)
    seen: set[str] = set()
    for a in doc.iter("a"):
        href = (a.get("href") or "").strip()
        if not href or href.startswith(("#", "mailto:", "javascript:", "tel:")):
            continue
        url = urljoin(base_url, href)
        if urlsplit(url).netloc != host or url in seen:
            continue
        seen.add(url)
        block = a.getparent()
        # climb to the nearest article-ish container so a card's link and title group together
        for _ in range(3):
            if block is None or block.tag in {"article", "li"} or block.get("class"):
                break
            block = block.getparent()
        if block is None:
            continue
        groups[_signature(block)].append((block, a))

    blocks: list[RepeatedBlock] = []
    for members in groups.values():
        if len(members) < 3:
            continue
        first_block, _ = members[0]
        blocks.append(
            RepeatedBlock(
                selector=css_hint(first_block),
                count=len(members),
                samples=[{"href": urljoin(base_url, a.get("href", "")), "text": _text(a)[:90]} for _, a in members[:3]],
            )
        )
    blocks.sort(key=lambda b: (-b.count, b.selector))
    return blocks[:limit]


@dataclass
class FormInfo:
    action: str
    method: str
    inputs: list[dict[str, str]]
    buttons: list[str]


def forms_summary(html: str, *, limit: int = 4) -> list[FormInfo]:
    """Login-form hints: inputs (never their values) and button labels."""
    doc = _clean_doc(html)
    forms: list[FormInfo] = []
    for form in doc.iter("form"):
        inputs = []
        for inp in form.iter("input", "select", "textarea"):
            if inp.get("type") == "hidden":
                continue
            inputs.append({k: inp.get(k) or "" for k in ("type", "name", "id", "placeholder", "autocomplete")} | {"selector": css_hint(inp)})
        buttons = [_text(b)[:40] or (b.get("value") or "") for b in form.iter("button", "input") if b.tag == "button" or b.get("type") in {"submit", "button"}]
        if inputs:
            forms.append(FormInfo(form.get("action") or "", (form.get("method") or "get").lower(), inputs, buttons))
    return forms[:limit]


@dataclass
class BodyCandidate:
    selector: str
    chars: int
    paragraphs: int
    sample: str


def body_candidates(html: str, *, limit: int = 5) -> list[BodyCandidate]:
    """Containers ranked by how article-like their text is (long, many <p>, little link text)."""
    doc = _clean_doc(html)
    scored: list[tuple[float, BodyCandidate]] = []
    for el in doc.iter("article", "div", "section", "main"):
        paragraphs = [p for p in el.iter("p") if len(_text(p)) > 40]
        if len(paragraphs) < 2:
            continue
        text = _text(el)
        link_chars = sum(len(_text(a)) for a in el.iter("a"))
        density = 1 - min(link_chars / max(len(text), 1), 1)
        score = len(text) * density * (1 + 0.1 * len(paragraphs))
        # Prefer the tightest container: penalise parents that merely wrap a better child.
        scored.append((score, BodyCandidate(css_hint(el), len(text), len(paragraphs), text[:160])))
    scored.sort(key=lambda s: -s[0])
    seen: set[str] = set()
    out: list[BodyCandidate] = []
    for _, cand in scored:
        if cand.selector not in seen:
            seen.add(cand.selector)
            out.append(cand)
        if len(out) >= limit:
            break
    return out


def page_digest(html: str, base_url: str, *, max_links: int = 25) -> dict[str, Any]:
    """Compact JSON-able description of a page for the LLM prompt."""
    doc = _clean_doc(html)
    title = doc.findtext(".//title") or ""
    headings = [_text(h)[:100] for h in doc.iter("h1", "h2", "h3")][:12]
    nav_links = []
    for a in doc.iter("a"):
        href = (a.get("href") or "").strip()
        label = _text(a)[:50]
        if href and label and not href.startswith(("#", "javascript:")):
            nav_links.append({"text": label, "href": urljoin(base_url, href)})
        if len(nav_links) >= max_links:
            break
    jsonld_types = Counter(re.findall(r'"@type"\s*:\s*"([A-Za-z]+)"', html or ""))
    return {
        "url": base_url,
        "title": _WS.sub(" ", title).strip()[:150],
        "headings": headings,
        "links": nav_links,
        "forms": [asdict(f) for f in forms_summary(html)],
        "repeated_blocks": [asdict(b) for b in repeated_link_blocks(html, base_url)],
        "article_body_candidates": [asdict(c) for c in body_candidates(html)],
        "json_ld_types": dict(jsonld_types),
        "text_chars": len(_text(doc)),
    }


def derive_paywall_markers(logged_out_html: str, logged_in_html: str, *, limit: int = 3) -> list[str]:
    """Short phrases visible when logged OUT but absent when logged IN (e.g. "Subscribe to keep reading")."""

    def lines(html: str) -> set[str]:
        doc = _clean_doc(html)
        out = set()
        for el in doc.iter("div", "p", "span", "section", "aside", "h2", "h3", "a", "button"):
            if len(list(el.iterchildren())) > 3:
                continue
            t = _text(el)
            if 8 <= len(t) <= 90:
                out.add(t)
        return out

    candidates = lines(logged_out_html) - lines(logged_in_html)
    keywords = ("subscribe", "sign in", "log in", "member", "paywall", "premium", "unlock", "continue reading", "keep reading", "register")
    hits = sorted((c for c in candidates if any(k in c.lower() for k in keywords)), key=len)
    return hits[:limit]
