from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class JobResult:
    ok: bool
    stats: dict[str, int] = field(default_factory=lambda: {"itemsSeen": 0, "imported": 0, "duplicates": 0, "updated": 0})
    error_code: str | None = None
    error_message: str | None = None
