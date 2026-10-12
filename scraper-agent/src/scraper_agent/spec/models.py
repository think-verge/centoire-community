"""The per-source YAML spec: everything the agent learned about how to scrape one site.

A spec never contains secrets. Logins are referenced by name (`auth.credential_ref`) and resolved from the
scraper VM's secrets file at run time.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

SPEC_VERSION = 1


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Policy(_Model):
    respect_robots: bool = True
    rate_limit_rps: float = Field(default=0.5, gt=0, le=10)
    max_items: int = Field(default=25, ge=1, le=100)
    # "excerpt" keeps title/excerpt/link-out only. The backend's per-source setting can only narrow this, never widen it.
    store: Literal["full", "excerpt"] = "excerpt"


class LoginStep(_Model):
    """One scripted login action. Values come from the secrets file via `from_secret`, never inline."""

    action: Literal["goto", "fill", "click", "press", "wait_for_selector", "wait_for_url"]
    selector: str | None = None
    url: str | None = None
    key: str | None = None
    from_secret: Literal["username", "password"] | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        needs_selector = {"fill", "click", "wait_for_selector"}
        if self.action in needs_selector and not self.selector:
            raise ValueError(f"{self.action} needs a selector")
        if self.action == "fill" and not self.from_secret:
            raise ValueError("fill must take its value from_secret (credentials are never written into the spec)")
        if self.action in {"goto", "wait_for_url"} and not self.url:
            raise ValueError(f"{self.action} needs a url")
        if self.action == "press" and not self.key:
            raise ValueError("press needs a key")
        return self


class SuccessCheck(_Model):
    """How to tell the session is logged in. Any one satisfied condition is enough."""

    selector: str | None = None
    url_contains: str | None = None
    cookie: str | None = None
    # Present when the user is logged OUT (e.g. a "Subscribe" button); its absence also counts as success.
    absent_selector: str | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        if not any([self.selector, self.url_contains, self.cookie, self.absent_selector]):
            raise ValueError("success_check needs at least one condition")
        return self


class AuthSpec(_Model):
    required: bool = False
    credential_ref: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9_-]*$", max_length=60)
    login_url: str | None = None
    steps: list[LoginStep] = Field(default_factory=list)
    success_check: SuccessCheck | None = None
    session_ttl_hours: int = Field(default=72, ge=1, le=24 * 30)

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.required and not (self.credential_ref and self.steps and self.success_check):
            raise ValueError("a login-required source needs credential_ref, steps and success_check")
        return self


class FieldRule(_Model):
    """Ordered candidates; the first that yields a non-empty value wins.

    Selectors are CSS by default (parsel syntax, so `h1::text` and `meta[name=x]::attr(content)` work);
    prefix with `xpath:` for XPath, or `jsonld:` (e.g. `jsonld:headline`) to read schema.org JSON-LD.
    """

    selectors: list[str] = Field(min_length=1)
    format: str | None = None  # strptime-style format for dates; otherwise parsed leniently


class BodyRule(_Model):
    selectors: list[str] = Field(min_length=1)
    remove: list[str] = Field(default_factory=list)  # ads, related links, share bars, ...


class Pagination(_Model):
    next_selector: str
    max_pages: int = Field(default=3, ge=1, le=20)


class ListingSpec(_Model):
    strategy: Literal["rss", "html"]
    urls: list[str] = Field(min_length=1)
    # html strategy
    item_selector: str | None = None
    link: FieldRule | None = None
    title: FieldRule | None = None
    pagination: Pagination | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.strategy == "html" and not (self.item_selector and self.link):
            raise ValueError("an html listing needs item_selector and link")
        return self


class ArticleSpec(_Model):
    title: FieldRule | None = None
    author: FieldRule | None = None
    published_at: FieldRule | None = None
    body: BodyRule | None = None
    cover_image: FieldRule | None = None
    # Text that means the page is a paywall teaser rather than the article.
    paywall_markers: list[str] = Field(default_factory=list)


class Verify(_Model):
    sample_urls: list[str] = Field(default_factory=list)
    min_body_chars: int = Field(default=500, ge=0)


class Discovered(_Model):
    at: datetime | None = None
    by_model: str | None = None
    agent_version: str | None = None
    spec_hash: str | None = None


class SourceSpec(_Model):
    version: Literal[1] = SPEC_VERSION
    source: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$", max_length=80)
    source_id: str | None = None  # the backend's Source id, to catch a spec attached to the wrong source
    site: HttpUrl
    policy: Policy = Field(default_factory=Policy)
    auth: AuthSpec = Field(default_factory=AuthSpec)
    listing: ListingSpec
    article: ArticleSpec = Field(default_factory=ArticleSpec)
    verify: Verify = Field(default_factory=Verify)
    discovered: Discovered = Field(default_factory=Discovered)

    @field_validator("site", mode="before")
    @classmethod
    def _site_str(cls, v: object) -> object:
        return str(v)

    @model_validator(mode="after")
    def _rss_needs_nothing_else(self) -> Self:
        if self.listing.strategy == "html" and not (self.article.body and self.article.body.selectors):
            raise ValueError("an html source needs article.body to extract article text")
        return self

    def effective_store(self, backend_store: str | None) -> Literal["full", "excerpt"]:
        """Full text is kept only when BOTH the YAML and the admin-controlled backend setting allow it."""
        return "full" if self.policy.store == "full" and backend_store == "full" else "excerpt"
