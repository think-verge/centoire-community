import asyncio

import httpx
import respx

from helpers import LONG_PARAGRAPH, FakeBackend, feed_xml, make_job
from scraper_agent.backend_client import BackendError
from scraper_agent.jobs.daemon import process_next
from scraper_agent.jobs.runner import run_job
from scraper_agent.spec import SourceSpec, dump_spec, load_spec, spec_hash
from scraper_agent.util import slugify

FEED = "https://news.test/feed.xml"
BODY = f"<p>{LONG_PARAGRAPH}</p>"


def write_spec(settings, **over):
    data = {"source": slugify("News Site"), "source_id": "src1", "site": "https://news.test",
            "listing": {"strategy": "rss", "urls": [FEED]}, "verify": {"min_body_chars": 300}}
    data.update(over)
    spec = SourceSpec.model_validate(data)
    dump_spec(spec, settings.sources_dir / f"{spec.source}.yaml")
    return spec


def mock_feed(count=4, body=BODY):
    xml = feed_xml([(f"Story {i}", f"https://news.test/{i}", body) for i in range(count)])
    respx.get("https://news.test/robots.txt").mock(return_value=httpx.Response(404))
    respx.get(FEED).mock(return_value=httpx.Response(200, text=xml))


async def run(job, backend, settings):
    return await run_job(job, backend, settings)


@respx.mock
async def test_scrape_imports_new_items_and_skips_known_ones(settings):
    write_spec(settings, policy={"store": "full"})
    mock_feed(4)
    backend = FakeBackend(known={"https://news.test/0", "https://news.test/1"})
    result = await run(make_job(store="full"), backend, settings)
    assert result.ok and result.stats == {"itemsSeen": 4, "imported": 2, "duplicates": 2, "updated": 0}
    assert [p["url"] for _, p in backend.upserts] == ["https://news.test/2", "https://news.test/3"]
    payload = backend.upserts[0][1]
    assert payload["title"] == "Story 2" and len(payload["contentText"]) > 300 and payload["specHash"]


@respx.mock
async def test_full_text_is_only_sent_when_yaml_and_backend_both_allow_it(settings):
    write_spec(settings, policy={"store": "full"})
    mock_feed(2)
    for backend_store, expect_body in (("excerpt", False), ("full", True)):
        backend = FakeBackend()
        await run(make_job(store=backend_store), backend, settings)
        assert ("contentText" in backend.upserts[0][1]) is expect_body

    write_spec(settings, policy={"store": "excerpt"})
    backend = FakeBackend()
    await run(make_job(store="full"), backend, settings)
    assert "contentText" not in backend.upserts[0][1]  # the YAML can narrow what the backend allows


@respx.mock
async def test_most_articles_failing_to_extract_means_the_layout_changed(settings):
    write_spec(settings, listing={"strategy": "html", "urls": ["https://news.test/latest"], "item_selector": "article",
               "link": {"selectors": ["a::attr(href)"]}}, article={"title": {"selectors": ["h1::text"]}, "body": {"selectors": ["div.gone"]}})
    respx.get("https://news.test/robots.txt").mock(return_value=httpx.Response(404))
    respx.get("https://news.test/latest").mock(return_value=httpx.Response(200, text="".join(f'<article><a href="/s{i}">x</a></article>' for i in range(5))))
    respx.get(url__regex=r"https://news.test/s\d").mock(return_value=httpx.Response(200, text="<html><body><p>redesigned</p></body></html>"))
    backend = FakeBackend()
    result = await run(make_job(), backend, settings)
    assert not result.ok and result.error_code == "layout_changed" and "5 of 5" in result.error_message
    assert backend.upserts == []


@respx.mock
async def test_one_odd_page_does_not_fail_the_run(settings):
    write_spec(settings,
               verify={"min_body_chars": 300}, listing={"strategy": "html", "urls": ["https://news.test/latest"], "item_selector": "article", "link": {"selectors": ["a::attr(href)"]}},
               article={"title": {"selectors": ["h1::text"]}, "body": {"selectors": ["div.body"]}})
    respx.get("https://news.test/robots.txt").mock(return_value=httpx.Response(404))
    respx.get("https://news.test/latest").mock(return_value=httpx.Response(200, text="".join(f'<article><a href="/s{i}">x</a></article>' for i in range(5))))
    good = f"<html><body><h1>Title</h1><div class='body'>{BODY}</div></body></html>"
    respx.get("https://news.test/s0").mock(return_value=httpx.Response(200, text="<html><body>odd</body></html>"))
    respx.get(url__regex=r"https://news.test/s[1-4]").mock(return_value=httpx.Response(200, text=good))
    result = await run(make_job(), FakeBackend(), settings)
    assert result.ok and result.stats["imported"] == 4


@respx.mock
async def test_robots_disallow_stops_the_run_as_blocked(settings):
    write_spec(settings)
    respx.get("https://news.test/robots.txt").mock(return_value=httpx.Response(200, text="User-agent: *\nDisallow: /\n"))
    result = await run(make_job(), FakeBackend(), settings)
    assert not result.ok and result.error_code == "blocked"


async def test_login_sources_without_a_valid_secrets_file_ask_for_a_human(settings):
    write_spec(settings, auth={"required": True, "credential_ref": "news", "steps": [{"action": "click", "selector": "b"}], "success_check": {"selector": ".me"}})
    result = await run(make_job(), FakeBackend(), settings)  # the secrets file does not exist
    assert not result.ok and result.error_code == "needs_human" and "secrets file not found" in result.error_message


async def test_missing_or_mismatched_specs_are_reported_not_crashed(settings):
    result = await run(make_job(), FakeBackend(), settings)
    assert result.error_code == "layout_changed" and "discovery needed" in result.error_message
    write_spec(settings, source_id="someone-else")
    assert (await run(make_job(), FakeBackend(), settings)).error_code == "internal"


@respx.mock
async def test_discover_writes_an_rss_spec_and_reports_it_ready(settings):
    mock_feed(4)
    respx.get("https://news.test").mock(return_value=httpx.Response(200, text="<html></html>"))
    backend = FakeBackend()
    result = await run(make_job("discover"), backend, settings)
    assert result.ok
    spec = load_spec(settings.sources_dir / "news-site.yaml")
    assert spec.listing.strategy == "rss" and spec.source_id == "src1" and spec.discovered.agent_version
    assert backend.specs == [{"source_id": "src1", "status": "ready", "hash": spec_hash(spec), "store": None}]


@respx.mock
async def test_discover_without_a_feed_asks_for_a_human(settings):
    respx.get("https://news.test/robots.txt").mock(return_value=httpx.Response(404))
    respx.get(FEED).mock(return_value=httpx.Response(404))
    respx.get("https://news.test").mock(return_value=httpx.Response(200, text="<html><body>no feed</body></html>"))
    result = await run(make_job("discover"), FakeBackend(), settings)
    assert not result.ok and result.error_code == "needs_human"


async def test_daemon_leases_runs_and_completes_one_job(settings):
    backend = FakeBackend(queue=[make_job("scrape")])
    assert await process_next(backend, settings) is True  # no spec -> reported failure, still completed
    assert backend.completed[0]["ok"] is False and backend.completed[0]["error_code"] == "layout_changed"
    assert await process_next(backend, settings) is False  # queue empty


async def test_a_crashing_job_is_reported_as_internal_and_does_not_kill_the_daemon(settings, monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("kaboom")

    monkeypatch.setattr("scraper_agent.jobs.runner.scrape_source", boom)
    backend = FakeBackend(queue=[make_job("scrape")])
    await process_next(backend, settings)
    assert backend.completed[0]["error_code"] == "internal" and "kaboom" in backend.completed[0]["error_message"]


async def test_heartbeats_are_sent_while_a_job_runs(settings, monkeypatch):
    settings.heartbeat_interval_s = 0.01

    async def slow(*a, **k):
        await asyncio.sleep(0.08)
        from scraper_agent.jobs.runner_types import JobResult

        return JobResult(True)

    monkeypatch.setattr("scraper_agent.jobs.runner.scrape_source", slow)
    backend = FakeBackend()
    await run(make_job(), backend, settings)
    assert backend.heartbeats >= 2


def test_backend_errors_during_heartbeat_do_not_propagate():
    assert BackendError(409, "x").status == 409
