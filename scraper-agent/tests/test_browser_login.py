"""End-to-end browser tests against a local fixture site. Needs Chromium (`playwright install chromium`)."""

import logging

import pytest
import yaml

from fixture_site import PASSWORD, USER, Site
from helpers import FakeBackend, make_job
from scraper_agent.jobs.runner import run_job
from scraper_agent.secrets import Credential, SecretsError, load_credential
from scraper_agent.spec import SourceSpec, dump_spec

pytestmark = pytest.mark.browser

LOGIN = {
    "required": True,
    "credential_ref": "daily",
    "login_url": None,  # filled per site
    "steps": [
        {"action": "fill", "selector": "#email", "from_secret": "username"},
        {"action": "fill", "selector": "#password", "from_secret": "password"},
        {"action": "click", "selector": "#signin"},
    ],
    "success_check": {"selector": "nav.account"},
}


@pytest.fixture
def site():
    s = Site().start()
    yield s
    s.stop()


def write_secrets(settings, username=USER, password=PASSWORD):
    settings.secrets_file.write_text(yaml.safe_dump({"daily": {"username": username, "password": password}}))
    settings.secrets_file.chmod(0o600)


def write_site_spec(settings, site, **over):
    auth = {**LOGIN, "login_url": f"{site.url}/login"}
    data = {
        "source": "news-site", "source_id": "src1", "site": site.url,
        "policy": {"store": "full", "respect_robots": True, "rate_limit_rps": 10},
        "auth": auth,
        "listing": {"strategy": "html", "urls": [f"{site.url}/latest"], "item_selector": "article.card", "link": {"selectors": ["a::attr(href)"]}, "title": {"selectors": ["h2::text"]}},
        "article": {"title": {"selectors": ["h1::text"]}, "author": {"selectors": [".byline::text"]}, "published_at": {"selectors": ["time::attr(datetime)"]},
                    "body": {"selectors": ["div.body"], "remove": [".ad"]}, "cover_image": {"selectors": ["meta[property='og:image']::attr(content)"]},
                    "paywall_markers": ["Subscribe to keep reading"]},
        "verify": {"min_body_chars": 300},
    }
    data.update(over)
    spec = SourceSpec.model_validate(data)
    dump_spec(spec, settings.sources_dir / "news-site.yaml")
    return spec


async def scrape(settings, backend=None, store="full"):
    backend = backend or FakeBackend()
    return await run_job(make_job("scrape", store=store), backend, settings), backend


async def test_logs_in_and_imports_full_paid_articles(settings, site):
    write_secrets(settings)
    write_site_spec(settings, site)
    result, backend = await scrape(settings)
    assert result.ok, result.error_message
    assert result.stats["imported"] == 4
    payload = backend.upserts[0][1]
    assert payload["title"] == "Story 1" and len(payload["contentText"]) > 600 and "BUY NOW" not in payload["contentText"]
    assert payload["coverImageUrl"].endswith("/img/1.jpg") and payload["publishedAt"].startswith("2026-10-01")
    assert site.state.login_posts == 1


async def test_the_saved_session_is_reused_and_a_dead_one_is_renewed(settings, site):
    write_secrets(settings)
    write_site_spec(settings, site)
    await scrape(settings)
    await scrape(settings)
    assert site.state.login_posts == 1  # second run reused the persistent profile's cookie
    site.state.sessions.clear()  # the site expires every session
    result, _ = await scrape(settings)
    assert result.ok and site.state.login_posts == 2


async def test_wrong_credentials_are_reported_as_login_expired(settings, site):
    write_secrets(settings, password="not-the-password")
    write_site_spec(settings, site)
    result, backend = await scrape(settings)
    assert not result.ok and result.error_code == "login_expired" and backend.upserts == []


async def test_a_captcha_stops_the_job_for_a_human(settings, site):
    site.state.captcha_login = True
    write_secrets(settings)
    write_site_spec(settings, site)
    result, _ = await scrape(settings)
    assert not result.ok and result.error_code == "needs_human" and "CAPTCHA" in result.error_message


async def test_a_silently_dead_session_is_detected_by_the_paywall_marker(settings, site):
    write_secrets(settings)
    write_site_spec(settings, site)
    site.state.force_teaser = True  # logged in as far as the page chrome goes, but articles are locked
    result, backend = await scrape(settings)
    assert not result.ok and result.error_code == "login_expired" and backend.upserts == []


async def test_a_redesign_is_reported_as_layout_changed(settings, site):
    write_secrets(settings)
    write_site_spec(settings, site)
    site.state.layout = "v2"
    result, _ = await scrape(settings)
    assert not result.ok and result.error_code == "layout_changed"


async def test_robots_txt_is_respected_in_the_browser_path(settings, site):
    write_secrets(settings)
    write_site_spec(settings, site)
    site.state.robots = "User-agent: *\nDisallow: /story/\n"
    result, backend = await scrape(settings)
    assert not result.ok and result.error_code == "blocked" and backend.upserts == []
    assert not any(h.startswith("/story/") for h in site.state.hits)


async def test_the_password_never_reaches_logs_specs_or_payloads(settings, site, caplog):
    caplog.set_level(logging.DEBUG)
    write_secrets(settings)
    write_site_spec(settings, site)
    result, backend = await scrape(settings)
    assert result.ok
    assert PASSWORD not in caplog.text and USER not in caplog.text
    assert PASSWORD not in (settings.sources_dir / "news-site.yaml").read_text()
    assert PASSWORD not in str(backend.upserts)


async def test_excerpt_only_backend_setting_still_wins_for_paid_sources(settings, site):
    write_secrets(settings)
    write_site_spec(settings, site)
    result, backend = await scrape(settings, store="excerpt")
    assert result.ok and all("contentText" not in p for _, p in backend.upserts)


def test_secrets_file_must_be_private_and_the_credential_never_prints(tmp_path):
    path = tmp_path / "secrets.yaml"
    path.write_text(yaml.safe_dump({"daily": {"username": "u", "password": "pw-123"}}))
    path.chmod(0o644)
    with pytest.raises(SecretsError, match="chmod 600"):
        load_credential(path, "daily")
    path.chmod(0o600)
    cred = load_credential(path, "daily")
    assert "pw-123" not in repr(cred) and "pw-123" not in str(cred) and cred.value("password") == "pw-123"
    with pytest.raises(SecretsError, match="no username/password"):
        load_credential(path, "missing")
    assert isinstance(cred, Credential)
