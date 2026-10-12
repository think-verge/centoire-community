"""Runtime settings, read from the environment (and a local .env in development)."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_SOURCES_DIR = Path(__file__).resolve().parents[2] / "sources"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Backend (outbound only: the agent polls, nothing listens on the VM) ──────────
    backend_url: str = "http://127.0.0.1:8000"
    scraper_secret: str = "dev-scraper-secret"
    worker_id: str = Field(default="scraper-1", min_length=3, max_length=80)

    # ── LLM: Gemini by default, Anthropic optional ───────────────────────────────────
    llm_provider: Literal["gemini", "anthropic"] = "gemini"
    llm_model: str = ""  # empty -> the provider's default below
    google_api_key: str = ""
    anthropic_api_key: str = ""
    llm_temperature: float = 0.0

    # ── Browser ──────────────────────────────────────────────────────────────────────
    browser_backend: Literal["mcp", "playwright"] = "playwright"
    # "patchright" is a drop-in Playwright fork. Off by default; only for sources you have the right to access.
    browser_engine: Literal["playwright", "patchright"] = "playwright"
    headed: bool = False
    profile_dir: Path = Path("./var/profiles/scraping")
    mcp_command: str = "npx"
    mcp_package: str = "@playwright/mcp@latest"

    # ── Files ────────────────────────────────────────────────────────────────────────
    sources_dir: Path = REPO_SOURCES_DIR
    secrets_file: Path = Path("./var/secrets.yaml")
    work_dir: Path = Path("./var/work")

    # ── Politeness / limits ──────────────────────────────────────────────────────────
    user_agent: str = "CentoireBot/1.0 (+https://centoire.com/bot)"
    request_timeout_s: float = 20.0
    max_discovery_steps: int = 30
    discovery_budget_s: int = 600
    poll_interval_s: float = 10.0
    heartbeat_interval_s: float = 60.0

    # ── Git (spec PRs) ───────────────────────────────────────────────────────────────
    git_push_specs: bool = False
    git_remote: str = "origin"
    git_base_branch: str = "main"


def get_settings() -> Settings:
    return Settings()
