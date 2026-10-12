from __future__ import annotations

import pytest

from scraper_agent.config import Settings
from scraper_agent.extract.ratelimit import HostLimiter


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        backend_url="http://backend.test",
        scraper_secret="test-secret",
        worker_id="test-worker",
        sources_dir=tmp_path / "sources",
        secrets_file=tmp_path / "secrets.yaml",
        profile_dir=tmp_path / "profiles",
        work_dir=tmp_path / "work",
        heartbeat_interval_s=3600,
        _env_file=None,
    )


_REAL_WAIT = HostLimiter.wait


@pytest.fixture
def real_limiter(monkeypatch):
    """Undo the autouse stub for the one test that exercises the actual rate limiter."""
    monkeypatch.setattr(HostLimiter, "wait", _REAL_WAIT)
    return HostLimiter


@pytest.fixture(autouse=True)
def _no_real_waiting(monkeypatch):
    """Politeness limits are unit-tested in test_robots_ratelimit; elsewhere don't make tests sleep."""

    async def instant(self, url):
        return None

    monkeypatch.setattr(HostLimiter, "wait", instant)
