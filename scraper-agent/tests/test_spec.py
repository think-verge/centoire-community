import pytest
import yaml
from pydantic import ValidationError

from scraper_agent.spec import SourceSpec, dump_spec, load_spec, spec_hash
from scraper_agent.spec.models import AuthSpec, LoginStep

RSS = {"source": "demo", "site": "https://example.com", "listing": {"strategy": "rss", "urls": ["https://example.com/feed"]}}


def make(**over):
    return SourceSpec.model_validate({**RSS, **over})


def test_minimal_rss_spec_is_valid_and_defaults_to_excerpt():
    spec = make()
    assert spec.policy.store == "excerpt"
    assert spec.policy.respect_robots is True
    assert spec.auth.required is False


def test_full_text_needs_both_the_yaml_and_the_backend_to_allow_it():
    full = make(policy={"store": "full"})
    assert full.effective_store("full") == "full"
    assert full.effective_store("excerpt") == "excerpt"
    assert full.effective_store(None) == "excerpt"
    assert make().effective_store("full") == "excerpt"


def test_unknown_keys_are_rejected_so_typos_do_not_silently_do_nothing():
    with pytest.raises(ValidationError):
        make(polcy={"store": "full"})


def test_credentials_can_never_be_written_into_login_steps():
    with pytest.raises(ValidationError, match="from_secret"):
        LoginStep(action="fill", selector="#pw")
    step = LoginStep(action="fill", selector="#pw", from_secret="password")
    assert step.from_secret == "password"
    with pytest.raises(ValidationError):
        LoginStep.model_validate({"action": "fill", "selector": "#pw", "from_secret": "password", "value": "hunter2"})


def test_login_required_sources_need_everything_to_log_in():
    with pytest.raises(ValidationError, match="credential_ref"):
        AuthSpec(required=True)
    ok = AuthSpec(
        required=True,
        credential_ref="bof",
        steps=[LoginStep(action="click", selector="button")],
        success_check={"selector": ".account"},
    )
    assert ok.credential_ref == "bof"
    with pytest.raises(ValidationError):
        AuthSpec(credential_ref="Has Spaces")


def test_html_sources_must_say_how_to_find_items_and_the_body():
    with pytest.raises(ValidationError, match="item_selector"):
        make(listing={"strategy": "html", "urls": ["https://example.com"]})
    with pytest.raises(ValidationError, match="article.body"):
        make(listing={"strategy": "html", "urls": ["https://example.com"], "item_selector": "article", "link": {"selectors": ["a::attr(href)"]}})
    ok = make(
        listing={"strategy": "html", "urls": ["https://example.com"], "item_selector": "article", "link": {"selectors": ["a::attr(href)"]}},
        article={"body": {"selectors": ["div.body"]}},
    )
    assert ok.listing.strategy == "html"


def test_hash_covers_how_to_scrape_not_who_discovered_it():
    a, b = make(), make()
    b.discovered.by_model = "some-model"
    assert spec_hash(a) == spec_hash(b)
    assert spec_hash(a) != spec_hash(make(policy={"max_items": 10}))


def test_yaml_roundtrip_keeps_the_spec_and_records_its_hash(tmp_path):
    spec = make(policy={"store": "full"})
    path = tmp_path / "demo.yaml"
    dump_spec(spec, path)
    text = path.read_text()
    assert text.startswith("# Discovered by scraper-agent")
    loaded = load_spec(path)
    assert loaded.discovered.spec_hash == spec_hash(spec)
    assert loaded.model_dump() == spec.model_dump()
    assert yaml.safe_load(text)["policy"]["store"] == "full"


def test_load_rejects_non_mapping_yaml(tmp_path):
    path = tmp_path / "bad.yaml"
    path.write_text("- just\n- a list\n")
    with pytest.raises(ValueError, match="mapping"):
        load_spec(path)
