"""Discovery: learn how to scrape a source and write it down as a YAML spec.

A LangGraph state machine with one LLM judgement per stage and a deterministic check after each:

    observe -> [auth -> check_auth] -> listing -> check_listing -> article -> check_article -> finish

A failed check feeds a precise message back to the proposing node (bounded retries). Credentials are injected by the
login executor and never appear in prompts; the model only ever sees page digests (inputs, never values).
"""

from __future__ import annotations

import json
import logging
import re
import statistics
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, TypedDict
from urllib.parse import urljoin

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

from ..backend_client import BackendClient, LeasedJob
from ..config import Settings
from ..extract.analyze import derive_paywall_markers, page_digest
from ..extract.fetcher import Fetcher, FetchError, HttpFetcher
from ..extract.replay import ReplayError, extract_article, list_items
from ..jobs.runner_types import JobResult
from ..spec.models import (
    ArticleSpec,
    AuthSpec,
    BodyRule,
    FieldRule,
    ListingSpec,
    LoginStep,
    Pagination,
    Policy,
    SourceSpec,
    SuccessCheck,
    Verify,
)
from ..util import slugify
from .proposals import ArticleProposal, AuthProposal, ListingProposal

log = logging.getLogger("scraper.discover")

MAX_ATTEMPTS = 3
MIN_LISTING_ITEMS = 3
SAMPLE_ARTICLES = 3
MIN_BODY_FLOOR = 300

SYSTEM = (
    "You are the discovery engine of a news-aggregation scraper. You are given condensed descriptions of web pages "
    "(titles, links, repeated blocks, form fields, article-body candidates). Answer ONLY with the requested structured "
    "object. Prefer short, stable CSS selectors (ids, semantic tags, meaningful class names) over long chains. "
    "Selectors use parsel syntax: 'h1::text' for text, 'a::attr(href)' for attributes. "
    "Use only standard CSS: never jQuery extensions such as :contains() or :first, and for login success_check prefer an element that only exists when signed in (e.g. an account menu) or a cookie name. "
    "For login steps copy the exact id/name/selector values shown in the form description; do not guess field names. "
    "Never put credentials, passwords or usernames into any answer: for login, use from_secret ('username'|'password')."
)


class DiscoveryFailure(Exception):
    def __init__(self, message: str, code: str = "needs_human"):
        super().__init__(message)
        self.code = code


class State(TypedDict, total=False):
    auth: AuthSpec
    listing: ListingSpec
    article: ArticleSpec
    items: list[Any]
    samples: list[dict[str, Any]]
    min_body_chars: int
    home_digest: dict[str, Any]
    feedback: str
    attempts: dict[str, int]
    steps: int


@dataclass
class Deps:
    source: dict[str, Any]
    settings: Settings
    llm: Any  # LangChain chat model (or a test double) exposing with_structured_output(schema)
    fetcher: Fetcher  # logged-in view (a browser for login sources)
    anonymous: Fetcher  # logged-out view, used to learn paywall markers
    login: Callable[[AuthSpec], Awaitable[bool]] | None = None  # performs a login with the given steps
    deadline: float = field(default_factory=lambda: time.monotonic() + 600)

    @property
    def site(self) -> str:
        return self.source["siteUrl"]

    @property
    def requires_login(self) -> bool:
        return bool(self.source.get("requiresLogin"))


def _draft(deps: Deps, st: State, **over: Any) -> SourceSpec:
    """A spec built without validation, so partial drafts can be replayed while discovery is still in progress."""
    return SourceSpec.model_construct(
        version=1, source=slugify(deps.source["name"]), source_id=deps.source["id"], site=deps.site,
        policy=Policy(), auth=st.get("auth") or AuthSpec(), listing=st["listing"] if "listing" in st else None,
        article=st.get("article") or ArticleSpec(), verify=Verify(min_body_chars=st.get("min_body_chars", MIN_BODY_FLOOR)), discovered=None,
        **over,
    )  # fmt: skip


async def _ask(deps: Deps, schema: type, instruction: str, payload: dict[str, Any], st: State) -> tuple[Any, State]:
    attempts = dict(st.get("attempts", {}))
    steps = st.get("steps", 0) + 1
    if steps > deps.settings.max_discovery_steps:
        raise DiscoveryFailure("Discovery used its step budget without finding a working recipe")
    if time.monotonic() > deps.deadline:
        raise DiscoveryFailure("Discovery ran out of time")
    feedback = st.get("feedback")
    prompt = {"task": instruction, "page": payload}
    if feedback:
        prompt["previous_attempt_failed_because"] = feedback
    model = deps.llm.with_structured_output(schema)
    result = await model.ainvoke([SystemMessage(content=SYSTEM), HumanMessage(content=json.dumps(prompt, ensure_ascii=False, default=str)[:60_000])])
    return result, {**st, "steps": steps, "attempts": attempts, "feedback": ""}  # type: ignore[return-value]


_LOGIN_LINK = re.compile(r"log\s*-?in|sign\s*-?in|member|subscriber|account", re.I)


async def _find_login_page(deps: Deps, digest: dict[str, Any]) -> dict[str, Any] | None:
    """Follows the home page's sign-in link (or a conventional path) to the page that holds the login form."""
    candidates = [link["href"] for link in digest.get("links", []) if _LOGIN_LINK.search(link["text"] + " " + link["href"])]
    candidates += [urljoin(deps.site, path) for path in ("/login", "/signin", "/sign-in", "/account/login")]
    for url in list(dict.fromkeys(candidates))[:5]:
        try:
            page = await deps.anonymous.get(url)
        except Exception:  # noqa: BLE001 - a dead candidate is just skipped
            continue
        found = page_digest(page.html, page.final_url)
        if found["forms"]:
            return found
    return None


def _bump(st: State, stage: str) -> int:
    attempts = st.setdefault("attempts", {})
    attempts[stage] = attempts.get(stage, 0) + 1
    return attempts[stage]


# ── nodes ─────────────────────────────────────────────────────────────────────────


def build_graph(deps: Deps):
    async def observe(st: State) -> State:
        page = await deps.anonymous.get(deps.site)
        return {"home_digest": page_digest(page.html, page.final_url), "attempts": {}, "steps": 0, "feedback": ""}

    async def propose_auth(st: State) -> State:
        payload = st["home_digest"]
        if not payload.get("forms"):  # the form is usually one click away: show the model the real login page
            login_page = await _find_login_page(deps, payload)
            if login_page is not None:
                payload = {**payload, "login_page": login_page}
        proposal, st2 = await _ask(
            deps, AuthProposal,
            "The source needs a login. From the page digest, describe how to log in as a script: where the form is, "
            "the steps (fill username, fill password, click submit) and how to tell login worked.",
            payload, st,
        )  # fmt: skip
        steps = [LoginStep(**{k: v for k, v in s.model_dump().items() if v is not None}) for s in proposal.steps]
        ref = deps.source.get("credentialRef")
        auth = AuthSpec(
            required=True, credential_ref=ref, login_url=proposal.login_url, steps=steps,
            success_check=SuccessCheck(**{k: v for k, v in proposal.success_check.model_dump().items() if v}),
        )  # fmt: skip
        return {**st2, "auth": auth}

    async def check_auth(st: State) -> State:
        assert deps.login is not None
        try:
            await deps.login(st["auth"])
        except ReplayError as exc:
            if exc.code == "needs_human":
                raise DiscoveryFailure(str(exc), "needs_human") from exc
            n = _bump(st, "auth")
            if n >= MAX_ATTEMPTS:
                raise DiscoveryFailure(f"Could not log in after {n} attempts: {exc}", "login_expired") from exc
            return {**st, "feedback": f"Login did not succeed: {exc}. Re-check the selectors, step order and success_check."}
        return {**st, "feedback": ""}

    async def propose_listing(st: State) -> State:
        page = await deps.fetcher.get(deps.site)  # the logged-in view of the home page
        digest = page_digest(page.html, page.final_url)
        proposal, st2 = await _ask(
            deps, ListingProposal,
            "Find the list of newest articles. Choose the listing page(s) and a selector that matches exactly one element per article, "
            "plus how to read the article link from it.",
            digest, st,
        )  # fmt: skip
        listing = ListingSpec(
            strategy="html", urls=proposal.urls or [deps.site], item_selector=proposal.item_selector,
            link=FieldRule(**proposal.link.model_dump()), title=FieldRule(**proposal.title.model_dump()) if proposal.title else None,
            pagination=Pagination(**proposal.pagination.model_dump()) if proposal.pagination else None,
        )  # fmt: skip
        return {**st2, "listing": listing}

    async def check_listing(st: State) -> State:
        draft = _draft(deps, st)
        try:
            items = await list_items(draft, deps.fetcher)
        except (ReplayError, FetchError) as exc:
            return _retry(st, "listing", f"Listing replay failed: {exc}")
        if len(items) < MIN_LISTING_ITEMS:
            return _retry(st, "listing", f"Only {len(items)} article links were found; expected at least {MIN_LISTING_ITEMS}. The item_selector or link rule is wrong.")
        return {**st, "items": items, "feedback": ""}

    def _retry(st: State, stage: str, message: str) -> State:
        n = _bump(st, stage)
        if n >= MAX_ATTEMPTS:
            raise DiscoveryFailure(f"{stage} discovery failed after {n} attempts: {message}")
        return {**st, "feedback": message}

    async def propose_article(st: State) -> State:
        items = st["items"][:SAMPLE_ARTICLES]
        samples = []
        for item in items:
            try:
                page = await deps.fetcher.get(item.url)
            except FetchError:
                continue
            try:
                anon = await deps.anonymous.get(item.url)
                anon_html = anon.html
            except FetchError:
                anon_html = ""
            samples.append({"item": item, "html": page.html, "anon_html": anon_html, "url": page.final_url})
        if not samples:
            raise DiscoveryFailure("None of the sample articles could be opened")
        derived = derive_paywall_markers(samples[0]["anon_html"], samples[0]["html"]) if deps.requires_login and samples[0]["anon_html"] else []
        proposal, st2 = await _ask(
            deps, ArticleProposal,
            "Describe how to extract one article page: title, author, publish date, cover image and, most importantly, the "
            "container holding the full article text. List text that appears INSTEAD of the article when access is missing.",
            {"sample": page_digest(samples[0]["html"], samples[0]["url"]), "sample_urls": [s["url"] for s in samples]}, st,
        )  # fmt: skip

        def rule(r):
            return FieldRule(**r.model_dump()) if r else None

        article = ArticleSpec(
            title=rule(proposal.title), author=rule(proposal.author), published_at=rule(proposal.published_at),
            body=BodyRule(**proposal.body.model_dump()), cover_image=rule(proposal.cover_image),
            paywall_markers=list(dict.fromkeys([*derived, *proposal.paywall_markers])),
        )  # fmt: skip
        return {**st2, "article": article, "samples": samples}

    async def check_article(st: State) -> State:
        draft = _draft(deps, st)
        lengths: list[int] = []
        problems: list[str] = []
        for sample in st["samples"]:
            try:
                candidate = await extract_article(draft, deps.fetcher, sample["item"])
            except ReplayError as exc:
                if exc.code == "login_expired":
                    raise DiscoveryFailure(f"Logged in, but articles still look locked: {exc}", "login_expired") from exc
                problems.append(str(exc))
                continue
            except FetchError as exc:
                problems.append(str(exc))
                continue
            lengths.append(len(candidate.content_text))
            if not candidate.title:
                problems.append(f"no title on {sample['url']}")
        median = int(statistics.median(lengths)) if lengths else 0
        if len(lengths) < max(1, len(st["samples"]) - 1) or median < MIN_BODY_FLOOR:
            return _retry(st, "article", f"Extracted bodies were too short or missing (median {median} chars; need >= {MIN_BODY_FLOOR}). Problems: {problems or 'body selector matched little'}")
        return {**st, "min_body_chars": max(MIN_BODY_FLOOR, int(median * 0.5)), "feedback": ""}

    def route_after(stage_ok: str, stage_retry: str):
        def router(st: State) -> str:
            return stage_retry if st.get("feedback") else stage_ok

        return router

    graph = StateGraph(State)
    graph.add_node("observe", observe)
    graph.add_node("propose_auth", propose_auth)
    graph.add_node("check_auth", check_auth)
    graph.add_node("propose_listing", propose_listing)
    graph.add_node("check_listing", check_listing)
    graph.add_node("propose_article", propose_article)
    graph.add_node("check_article", check_article)

    graph.set_entry_point("observe")
    graph.add_conditional_edges("observe", lambda st: "propose_auth" if deps.requires_login else "propose_listing", {"propose_auth": "propose_auth", "propose_listing": "propose_listing"})
    graph.add_edge("propose_auth", "check_auth")
    graph.add_conditional_edges("check_auth", route_after("propose_listing", "propose_auth"), {"propose_listing": "propose_listing", "propose_auth": "propose_auth"})
    graph.add_edge("propose_listing", "check_listing")
    graph.add_conditional_edges("check_listing", route_after("propose_article", "propose_listing"), {"propose_article": "propose_article", "propose_listing": "propose_listing"})
    graph.add_edge("propose_article", "check_article")
    graph.add_conditional_edges("check_article", route_after("done", "propose_article"), {"done": END, "propose_article": "propose_article"})
    return graph.compile()


# ── entry points ──────────────────────────────────────────────────────────────────


def assemble_spec(deps: Deps, st: State) -> SourceSpec:
    """Builds the strict, validated spec from the verified stages."""
    return SourceSpec(
        source=slugify(deps.source["name"]), source_id=deps.source["id"], site=deps.site,
        policy=Policy(store="full"),  # capability only: the backend's per-source setting still has the last word
        auth=st.get("auth") or AuthSpec(), listing=st["listing"], article=st["article"],
        verify=Verify(sample_urls=[s["url"] for s in st.get("samples", [])], min_body_chars=st.get("min_body_chars", MIN_BODY_FLOOR)),
    )  # fmt: skip


async def discover_spec(deps: Deps) -> SourceSpec:
    """Runs the graph and returns a validated spec, or raises DiscoveryFailure (with a backend error code)."""
    graph = build_graph(deps)
    final: State = await graph.ainvoke({}, {"recursion_limit": 60})
    spec = assemble_spec(deps, final)
    # last line of defence: replay the finished spec end to end
    items = await list_items(spec, deps.fetcher)
    if len(items) < MIN_LISTING_ITEMS:
        raise DiscoveryFailure("The finished spec did not reproduce the listing")
    return spec


async def run_discovery(job: LeasedJob, backend: BackendClient, settings: Settings, *, llm: Any | None = None) -> JobResult:
    """Job entry point: opens the (logged-in) browser profile, discovers, writes the YAML and reports the spec."""
    from ..browser.fetcher import BrowserFetcher
    from ..browser.session import open_profile
    from ..extract.fetcher import PoliteFetcher
    from ..extract.robots import RobotsCache
    from ..jobs.runner import _publish_spec
    from ..llm import LLMConfigError, get_llm, resolve_model_name
    from ..secrets import SecretsError, load_credential

    source = job.source
    try:
        chat = llm or get_llm(settings)
    except LLMConfigError as exc:
        return JobResult(False, error_code="needs_human", error_message=str(exc))

    slug = slugify(source["name"])
    credential = None
    try:
        if source.get("requiresLogin"):
            credential = load_credential(settings.secrets_file, source.get("credentialRef") or "")
        anonymous = HttpFetcher(settings)
        async with open_profile(settings, slug) as context:
            policy = Policy()
            browser = BrowserFetcher(context, source["siteUrl"], AuthSpec(), credential, timeout_ms=int(settings.request_timeout_s * 1000))

            async def login(auth: AuthSpec) -> bool:
                browser.auth = auth
                return await browser.ensure_login()

            fetcher = PoliteFetcher(browser, policy, RobotsCache(anonymous.text, settings.user_agent))
            deps = Deps(source=source, settings=settings, llm=chat, fetcher=fetcher, anonymous=PoliteFetcher(anonymous, policy, RobotsCache(anonymous.text, settings.user_agent)),
                        login=login, deadline=time.monotonic() + settings.discovery_budget_s)  # fmt: skip
            try:
                spec = await discover_spec(deps)
                spec.discovered.by_model = f"{settings.llm_provider}:{resolve_model_name(settings)}" if llm is None else "injected"
            finally:
                await browser.aclose()
        return await _publish_spec(spec, source, backend, settings)
    except DiscoveryFailure as exc:
        return JobResult(False, error_code=exc.code, error_message=str(exc))
    except (SecretsError, ReplayError, FetchError) as exc:
        return JobResult(False, error_code=getattr(exc, "code", "needs_human"), error_message=str(exc))
