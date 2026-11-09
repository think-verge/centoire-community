"""Settings loaded from environment (.env), with defaults that run against a local MongoDB."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent


class Settings:
    def __init__(self) -> None:
        self.mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
        self.mongodb_db: str = os.getenv("MONGODB_DB", "discovery_engine")

        sources = Path(os.getenv("SOURCES_FILE", "sources.yaml"))
        self.sources_file: Path = sources if sources.is_absolute() else REPO_ROOT / sources
        brand_sites = Path(os.getenv("BRAND_SITES_FILE", "brand_sites.yaml"))
        self.brand_sites_file: Path = brand_sites if brand_sites.is_absolute() else REPO_ROOT / brand_sites

        self.intervals: dict[str, int] = {
            "fast": int(os.getenv("INTERVAL_FAST", "180")),
            "normal": int(os.getenv("INTERVAL_NORMAL", "600")),
            "slow": int(os.getenv("INTERVAL_SLOW", "1800")),
        }
        self.reddit_gap_seconds: float = float(os.getenv("REDDIT_GAP_SECONDS", "30"))
        self.request_timeout: float = float(os.getenv("REQUEST_TIMEOUT", "20"))
        self.user_agent: str = os.getenv(
            "USER_AGENT", "CentoireDiscovery/0.1 (+https://centoire.com)"
        )

        # Instagram (Graph API business discovery). Sources are skipped until both are set.
        ig_file = Path(os.getenv("INSTAGRAM_FILE", "instagram.yaml"))
        self.instagram_file: Path = ig_file if ig_file.is_absolute() else REPO_ROOT / ig_file
        self.meta_graph_version: str = os.getenv("META_GRAPH_VERSION", "v25.0")
        self.ig_user_id: str | None = os.getenv("IG_USER_ID") or None
        self.ig_access_token: str | None = os.getenv("IG_ACCESS_TOKEN") or None
        # Meta does not publish the user-token allowance; ~200/hour is the usual planning figure.
        self.ig_max_calls_per_hour: int = int(os.getenv("IG_MAX_CALLS_PER_HOUR", "180"))
        self.ig_posts_per_call: int = int(os.getenv("IG_POSTS_PER_CALL", "12"))
        self.ig_intervals: dict[str, int] = {
            "fast": int(os.getenv("IG_INTERVAL_FAST", "600")),
            "normal": int(os.getenv("IG_INTERVAL_NORMAL", "1800")),
            "slow": int(os.getenv("IG_INTERVAL_SLOW", "3600")),
        }

        # Stories (app.stories): Gemini triages every article and groups them by event.
        self.gemini_api_key: str | None = os.getenv("GEMINI_API_KEY") or None
        self.story_triage_model: str = os.getenv("STORY_TRIAGE_MODEL", "gemini-3.5-flash-lite")
        self.story_match_model: str = os.getenv("STORY_MATCH_MODEL", "gemini-3.5-flash")
        self.embed_model: str = os.getenv("EMBED_MODEL", "gemini-embedding-001")
        self.stories_enabled: bool = os.getenv("STORIES_ENABLED", "true").lower() == "true"

    def interval_for(self, source_type: str, tier: str) -> int:
        table = self.ig_intervals if source_type == "instagram" else self.intervals
        return table[tier]


@lru_cache
def get_settings() -> Settings:
    return Settings()
