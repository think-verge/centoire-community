"""Load and validate the watchlist, and the filters that drop junk items."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

from app.config import Settings
from app.models import FetchedItem, Source


def _read(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def load_sources(path: Path) -> list[Source]:
    sources = [Source(**raw) for raw in _read(path).get("sources", [])]
    _check_unique(sources, path)
    return sources


def load_instagram(path: Path) -> list[Source]:
    """instagram.yaml entries ({handle, role, region, tier, ...}) as Sources."""
    if not path.exists():
        return []
    sources = []
    for raw in _read(path).get("accounts", []):
        handle = str(raw["handle"]).lstrip("@").lower()
        sources.append(
            Source(
                id=f"ig-{handle}",
                name=raw.get("name") or f"@{handle}",
                type="instagram",
                url=f"https://www.instagram.com/{handle}/",
                region=raw.get("region", "GLOBAL"),
                role=raw["role"],
                tier=raw.get("tier", "normal"),
            )
        )
    _check_unique(sources, path)
    return sources


def load_watchlist(settings: Settings) -> list[Source]:
    sources = load_sources(settings.sources_file) + load_instagram(settings.instagram_file)
    if settings.brand_sites_file.exists():
        sources += load_sources(settings.brand_sites_file)
    _check_unique(sources, settings.sources_file)
    return sources


def planned_instagram_calls_per_hour(settings: Settings, sources: list[Source]) -> float:
    return sum(
        3600 / settings.interval_for("instagram", s.tier) for s in sources if s.type == "instagram"
    )


def _check_unique(sources: list[Source], path: Path) -> None:
    ids = [s.id for s in sources]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise ValueError(f"duplicate source ids in {path.name}: {sorted(dupes)}")


def load_blocked_publishers(path: Path) -> set[str]:
    return {p.strip().lower() for p in _read(path).get("blocked_publishers", [])}


class ItemFilter:
    """Drops items from blocked publishers and titles matching a source's exclude rules."""

    def __init__(self, blocked_publishers: set[str]) -> None:
        self.blocked = blocked_publishers
        self._patterns: dict[str, list[re.Pattern]] = {}

    def keep(self, source: Source, item: FetchedItem) -> bool:
        if item.publisher and item.publisher.strip().lower() in self.blocked:
            return False
        if source.id not in self._patterns:
            self._patterns[source.id] = [re.compile(p, re.I) for p in source.exclude_title]
        return not any(p.search(item.title) for p in self._patterns[source.id])
