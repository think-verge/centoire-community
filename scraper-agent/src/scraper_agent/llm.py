"""One place that decides which chat model the agent uses (Gemini by default)."""

from __future__ import annotations

from typing import Any

from .config import Settings

# Defaults are only a starting point; set LLM_MODEL in the environment to change them without a code change.
DEFAULT_MODELS = {"gemini": "gemini-2.5-flash", "anthropic": "claude-sonnet-5-5"}


class LLMConfigError(RuntimeError):
    pass


def resolve_model_name(settings: Settings) -> str:
    return settings.llm_model or DEFAULT_MODELS[settings.llm_provider]


def get_llm(settings: Settings) -> Any:
    """Returns a LangChain chat model for the configured provider, or raises LLMConfigError with a clear message."""
    model = resolve_model_name(settings)
    if settings.llm_provider == "gemini":
        if not settings.google_api_key:
            raise LLMConfigError("GOOGLE_API_KEY is required when LLM_PROVIDER=gemini")
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(model=model, google_api_key=settings.google_api_key, temperature=settings.llm_temperature)

    if not settings.anthropic_api_key:
        raise LLMConfigError("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")
    try:
        from langchain_anthropic import ChatAnthropic
    except ImportError as exc:  # optional extra
        raise LLMConfigError("Install the anthropic extra: pip install 'scraper-agent[anthropic]'") from exc
    return ChatAnthropic(model=model, api_key=settings.anthropic_api_key, temperature=settings.llm_temperature)
