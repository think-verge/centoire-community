"""Real Gemini discovers the local paid fixture site. Run with GOOGLE_API_KEY set: pytest -m live tests/test_live_gemini.py -s"""

import os

import pytest
import yaml

from fixture_site import PASSWORD, USER, Site
from helpers import FakeBackend, make_job
from scraper_agent.graphs.discover import run_discovery
from scraper_agent.jobs.runner import run_job
from scraper_agent.spec import load_spec

pytestmark = [pytest.mark.browser, pytest.mark.live, pytest.mark.skipif(not os.environ.get("GOOGLE_API_KEY"), reason="needs GOOGLE_API_KEY")]


async def test_gemini_discovers_the_paid_fixture_site_and_the_yaml_replays(settings):
    site = Site().start()
    try:
        settings.google_api_key = os.environ["GOOGLE_API_KEY"]
        settings.secrets_file.write_text(yaml.safe_dump({"daily": {"username": USER, "password": PASSWORD}}))
        settings.secrets_file.chmod(0o600)
        job = make_job("discover", store="full", name="Daily Thread", feed_url=None, requires_login=True)
        job.source["siteUrl"] = site.url
        job.source["credentialRef"] = "daily"

        result = await run_discovery(job, FakeBackend(), settings)
        assert result.ok, result.error_message
        spec = load_spec(settings.sources_dir / "daily-thread.yaml")
        print(yaml.safe_dump(spec.model_dump(mode="json"), sort_keys=False))

        scrape = await run_job(make_job("scrape", store="full", name="Daily Thread"), FakeBackend(), settings)
        assert scrape.ok and scrape.stats["imported"] == 4, scrape.error_message
    finally:
        site.stop()
