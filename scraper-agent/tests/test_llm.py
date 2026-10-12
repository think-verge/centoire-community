import pytest

from scraper_agent.config import Settings
from scraper_agent.llm import DEFAULT_MODELS, LLMConfigError, get_llm, resolve_model_name


def cfg(**kw):
    return Settings(_env_file=None, **kw)


def test_gemini_is_the_default_provider():
    s = cfg()
    assert s.llm_provider == "gemini"
    assert resolve_model_name(s) == DEFAULT_MODELS["gemini"]


def test_model_name_can_be_overridden_without_code_changes():
    assert resolve_model_name(cfg(llm_model="gemini-custom")) == "gemini-custom"
    assert resolve_model_name(cfg(llm_provider="anthropic")) == DEFAULT_MODELS["anthropic"]


def test_missing_keys_give_clear_errors():
    with pytest.raises(LLMConfigError, match="GOOGLE_API_KEY"):
        get_llm(cfg())
    with pytest.raises(LLMConfigError, match="ANTHROPIC_API_KEY"):
        get_llm(cfg(llm_provider="anthropic"))


def test_gemini_client_is_built_from_the_key():
    llm = get_llm(cfg(google_api_key="fake-key", llm_model="gemini-test"))
    assert type(llm).__name__ == "ChatGoogleGenerativeAI"
    assert getattr(llm, "model", "").endswith("gemini-test")
