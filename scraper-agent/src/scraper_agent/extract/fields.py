"""The selector mini-language used by specs.

CSS by default (parsel syntax: `h1::text`, `meta[property=og:title]::attr(content)`); `xpath:` prefix for XPath;
`jsonld:` prefix to read a key from schema.org JSON-LD (`jsonld:headline`, `jsonld:author.name`).
"""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urljoin

from dateutil import parser as dateparser
from parsel import Selector, SelectorList

from ..spec.models import BodyRule, FieldRule
from .clean import html_to_text, sanitize_html

_WS = re.compile(r"\s+")


def select(sel: Selector | SelectorList, selector: str) -> SelectorList:
    if selector.startswith("xpath:"):
        return sel.xpath(selector[len("xpath:") :])
    return sel.css(selector)


def jsonld_objects(sel: Selector) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    for raw in sel.xpath('//script[@type="application/ld+json"]/text()').getall():
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            item = stack.pop()
            if isinstance(item, dict):
                objects.append(item)
                graph = item.get("@graph")
                if isinstance(graph, list):
                    stack.extend(graph)
    return objects


def _dig(obj: Any, path: str) -> Any:
    for part in path.split("."):
        if isinstance(obj, list):
            obj = obj[0] if obj else None
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    if isinstance(obj, list):
        obj = obj[0] if obj else None
    if isinstance(obj, dict):
        obj = obj.get("url") or obj.get("name") or obj.get("@id")
    return obj


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = _WS.sub(" ", value).strip()
    return value or None


def extract_field(sel: Selector, rule: FieldRule | None, base_url: str = "") -> str | None:
    """First non-empty value across the rule's candidate selectors."""
    if rule is None:
        return None
    for candidate in rule.selectors:
        value: str | None = None
        if candidate.startswith("jsonld:"):
            key = candidate[len("jsonld:") :]
            for obj in jsonld_objects(sel):
                found = _dig(obj, key)
                if found:
                    value = str(found)
                    break
        else:
            matches = select(sel, candidate)
            if matches:
                first = matches[0]
                raw = first.get()
                # A bare element selector yields markup; use its text. ::text/::attr already yield strings.
                value = first.xpath("string(.)").get() if raw and raw.lstrip().startswith("<") else raw
        value = _clean(value)
        if value:
            return urljoin(base_url, value) if base_url and value.startswith(("/", "./", "../")) else value
    return None


def parse_date(value: str | None, fmt: str | None = None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, fmt) if fmt else dateparser.parse(value)
    except (ValueError, OverflowError):
        return None
    if parsed is None:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def extract_body(sel: Selector, rule: BodyRule | None, base_url: str) -> tuple[str, str]:
    """Returns (sanitized html, plain text) for the article body, or ("", "") if nothing matched."""
    if rule is None:
        return "", ""
    for candidate in rule.selectors:
        if candidate.startswith("jsonld:"):
            key = candidate[len("jsonld:") :]
            for obj in jsonld_objects(sel):
                found = _dig(obj, key)
                if isinstance(found, str) and len(found) > 200:
                    html = "".join(f"<p>{para}</p>" for para in found.split("\n") if para.strip())
                    return sanitize_html(html, base_url), html_to_text(html)
            continue
        matches = select(sel, candidate)
        if not matches:
            continue
        node = matches[0]
        for unwanted in rule.remove:
            for el in select(node, unwanted):
                el.drop()
        html = sanitize_html(node.get(), base_url)
        text = html_to_text(html)
        if text:
            return html, text
    return "", ""
