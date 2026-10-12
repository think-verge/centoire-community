from __future__ import annotations

import hashlib
import json
from pathlib import Path

import yaml

from .models import SourceSpec


def spec_path(sources_dir: Path, slug: str) -> Path:
    return sources_dir / f"{slug}.yaml"


def load_spec(path: Path) -> SourceSpec:
    """Reads and validates a spec; raises ValueError (with a readable message) on a bad file."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path.name}: expected a YAML mapping")
    return SourceSpec.model_validate(data)


def _canonical(spec: SourceSpec) -> dict:
    data = spec.model_dump(mode="json", exclude_none=True)
    data.pop("discovered", None)  # the hash covers HOW to scrape, not who discovered it or when
    return data


def spec_hash(spec: SourceSpec) -> str:
    blob = json.dumps(_canonical(spec), sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()[:16]


def dump_spec(spec: SourceSpec, path: Path) -> None:
    """Writes the spec as readable YAML (stable key order) with its hash recorded under `discovered`."""
    spec.discovered.spec_hash = spec_hash(spec)
    data = spec.model_dump(mode="json", exclude_none=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=100)
    path.write_text(f"# Discovered by scraper-agent. Review changes like code; never put credentials in here.\n{text}", encoding="utf-8")
