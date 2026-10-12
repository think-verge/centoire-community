"""The discovery graph end to end: scripted LLM + real Chromium + the local fixture site."""

import json

import pytest
import yaml

from fixture_site import PASSWORD, USER, Site
from helpers import FakeBackend, make_job
from scraper_agent.graphs.proposals import (
    ArticleProposal,
    AuthProposal,
    BodyRuleP,
    FieldRuleP,
    ListingProposal,
    LoginStepP,
    SuccessCheckP,
)
from scraper_agent.jobs.runner import run_job
from scraper_agent.spec import load_spec

pytestmark = pytest.mark.browser


class FakeLLM:
    """Plays back scripted structured answers and records every prompt it was sent."""

    def __init__(self, **script):
        self.script = {k: list(v) for k, v in script.items()}
        self.prompts: list[tuple[str, dict]] = []

    def with_structured_output(self, schema):
        outer = self

        class Runner:
            async def ainvoke(self, messages):
                payload = json.loads(messages[-1].content)
                outer.prompts.append((schema.__name__, payload))
                queue = outer.script.get(schema.__name__, [])
                if not queue:
                    raise AssertionError(f"unexpected LLM call for {schema.__name__}")
                return queue.pop(0) if len(queue) > 1 else queue[0]

        return Runner()

    def calls(self, name):
        return [p for n, p in self.prompts if n == name]


def good_auth(site_url):
    return AuthProposal(
        login_url=f"{site_url}/login",
        steps=[
            LoginStepP(action="fill", selector="#email", from_secret="username"),
            LoginStepP(action="fill", selector="#password", from_secret="password"),
            LoginStepP(action="click", selector="#signin"),
        ],
        success_check=SuccessCheckP(selector="nav.account"),
    )


GOOD_LISTING = ListingProposal(urls=[], item_selector="article.card", link=FieldRuleP(selectors=["a::attr(href)"]), title=FieldRuleP(selectors=["h2::text"]))
GOOD_ARTICLE = ArticleProposal(
    title=FieldRuleP(selectors=["h1::text"]),
    author=FieldRuleP(selectors=[".byline::text"]),
    published_at=FieldRuleP(selectors=["time::attr(datetime)"]),
    body=BodyRuleP(selectors=["div.body"], remove=[".ad"]),
    cover_image=FieldRuleP(selectors=["meta[property='og:image']::attr(content)"]),
)


@pytest.fixture
def site():
    s = Site().start()
    yield s
    s.stop()


def source_for(site, *, login):
    job = make_job("discover", store="full", name="Daily Thread", feed_url=None, requires_login=login)
    job.source["siteUrl"] = site.url
    job.source["credentialRef"] = "daily" if login else None
    return job


def write_secrets(settings):
    settings.secrets_file.write_text(yaml.safe_dump({"daily": {"username": USER, "password": PASSWORD}}))
    settings.secrets_file.chmod(0o600)


def listing_for(site, **over):
    return GOOD_LISTING.model_copy(update={"urls": [f"{site.url}/latest"], **over})


async def discover(settings, job, llm):
    from scraper_agent.graphs.discover import run_discovery

    backend = FakeBackend()
    result = await run_discovery(job, backend, settings, llm=llm)
    return result, backend


async def test_discovers_a_paid_site_writes_the_yaml_and_the_yaml_then_scrapes_it(settings, site):
    write_secrets(settings)
    llm = FakeLLM(AuthProposal=[good_auth(site.url)], ListingProposal=[listing_for(site)], ArticleProposal=[GOOD_ARTICLE])
    result, backend = await discover(settings, source_for(site, login=True), llm)
    assert result.ok, result.error_message

    # the spec was written, validates, and was reported as ready
    spec = load_spec(settings.sources_dir / "daily-thread.yaml")
    assert spec.auth.required and spec.auth.credential_ref == "daily" and spec.listing.item_selector == "article.card"
    assert spec.article.body.selectors == ["div.body"] and spec.policy.store == "full"
    assert backend.specs[0]["status"] == "ready" and backend.specs[0]["hash"] == spec.discovered.spec_hash
    # the paywall marker was LEARNED by comparing the logged-out and logged-in page, not guessed by the model
    assert "Subscribe to keep reading" in spec.article.paywall_markers
    assert spec.verify.min_body_chars >= 300

    # the model never saw credentials
    everything = json.dumps(llm.prompts)
    assert PASSWORD not in everything and USER not in everything
    assert PASSWORD not in (settings.sources_dir / "daily-thread.yaml").read_text()

    # and replaying the discovered YAML (no LLM) imports full paid articles
    scrape = await run_job(make_job("scrape", store="full", name="Daily Thread"), FakeBackend(), settings)
    assert scrape.ok and scrape.stats["imported"] == 4, scrape.error_message


async def test_a_bad_proposal_is_corrected_using_the_checks_feedback(settings, site):
    write_secrets(settings)
    llm = FakeLLM(
        AuthProposal=[good_auth(site.url)],
        ListingProposal=[listing_for(site, item_selector="li.post"), listing_for(site)],
        ArticleProposal=[GOOD_ARTICLE],
    )
    result, _ = await discover(settings, source_for(site, login=True), llm)
    assert result.ok, result.error_message
    first, second = llm.calls("ListingProposal")
    assert "previous_attempt_failed_because" not in first
    assert "No items matching 'li.post'" in second["previous_attempt_failed_because"]


async def test_gives_up_with_a_clear_reason_after_repeated_bad_listings(settings, site):
    write_secrets(settings)
    llm = FakeLLM(
        AuthProposal=[good_auth(site.url)],
        ListingProposal=[listing_for(site, item_selector="li.post")],
        ArticleProposal=[GOOD_ARTICLE],
    )
    result, backend = await discover(settings, source_for(site, login=True), llm)
    assert not result.ok and result.error_code == "needs_human"
    assert "listing discovery failed after 3 attempts" in result.error_message
    assert backend.specs == [] and not (settings.sources_dir / "daily-thread.yaml").exists()


async def test_a_login_that_never_works_is_reported_and_stops_before_the_listing_stage(settings, site):
    write_secrets(settings)
    broken = good_auth(site.url).model_copy(update={"steps": [LoginStepP(action="click", selector="#nope")]})
    llm = FakeLLM(AuthProposal=[broken], ListingProposal=[GOOD_LISTING], ArticleProposal=[GOOD_ARTICLE])
    result, _ = await discover(settings, source_for(site, login=True), llm)
    assert not result.ok and result.error_code in {"login_expired", "needs_human", "layout_changed"}
    assert len(llm.calls("AuthProposal")) <= 3 and not llm.calls("ListingProposal")


async def test_a_captcha_during_login_stops_discovery_for_a_human(settings, site):
    write_secrets(settings)
    site.state.captcha_login = True
    llm = FakeLLM(AuthProposal=[good_auth(site.url)])
    result, _ = await discover(settings, source_for(site, login=True), llm)
    assert not result.ok and result.error_code == "needs_human"


async def test_wrong_article_selectors_are_retried_with_the_extraction_numbers(settings, site):
    write_secrets(settings)
    bad = GOOD_ARTICLE.model_copy(update={"body": BodyRuleP(selectors=["div.story-text"])})
    llm = FakeLLM(AuthProposal=[good_auth(site.url)], ListingProposal=[listing_for(site)], ArticleProposal=[bad, GOOD_ARTICLE])
    result, _ = await discover(settings, source_for(site, login=True), llm)
    assert result.ok, result.error_message
    assert "too short or missing" in llm.calls("ArticleProposal")[1]["previous_attempt_failed_because"]


async def test_a_free_site_skips_the_login_stage_entirely(settings, site):
    site.state.open_access = True
    llm = FakeLLM(ListingProposal=[listing_for(site)], ArticleProposal=[GOOD_ARTICLE])
    result, _ = await discover(settings, source_for(site, login=False), llm)
    assert result.ok, result.error_message
    spec = load_spec(settings.sources_dir / "daily-thread.yaml")
    assert spec.auth.required is False and not llm.calls("AuthProposal")


async def test_the_step_budget_stops_a_runaway_discovery(settings, site):
    write_secrets(settings)
    settings.max_discovery_steps = 2
    llm = FakeLLM(
        AuthProposal=[good_auth(site.url)],
        ListingProposal=[listing_for(site, item_selector="li.post")],
        ArticleProposal=[GOOD_ARTICLE],
    )
    result, _ = await discover(settings, source_for(site, login=True), llm)
    assert not result.ok and "step budget" in result.error_message


async def test_without_an_llm_key_discovery_asks_for_a_human_instead_of_crashing(settings, site):
    from scraper_agent.graphs.discover import run_discovery

    result = await run_discovery(source_for(site, login=False), FakeBackend(), settings)  # no llm, no GOOGLE_API_KEY
    assert not result.ok and result.error_code == "needs_human" and "GOOGLE_API_KEY" in result.error_message
