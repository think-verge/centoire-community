"""What the LLM is asked to produce at each discovery stage.

These are separate from the spec models on purpose: they are lenient (no `extra="forbid"`, which several providers'
structured-output schemas reject) and carry a `notes` field for the model's reasoning. They are validated into the strict
spec models before anything is written.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class FieldRuleP(BaseModel):
    selectors: list[str] = Field(description="Candidate selectors, best first. CSS (parsel syntax, e.g. 'h1::text'), 'xpath:...' or 'jsonld:key'.")
    format: str | None = Field(default=None, description="strptime format for dates, if not ISO-like.")


class BodyRuleP(BaseModel):
    selectors: list[str] = Field(description="CSS selectors of the container holding the article text, best first.")
    remove: list[str] = Field(default_factory=list, description="Selectors inside the body to drop (ads, related links, share bars).")


class LoginStepP(BaseModel):
    action: str = Field(description="One of: goto, fill, click, press, wait_for_selector, wait_for_url")
    selector: str | None = None
    url: str | None = None
    key: str | None = None
    from_secret: str | None = Field(default=None, description="For fill: 'username' or 'password'. NEVER a literal value.")


class SuccessCheckP(BaseModel):
    selector: str | None = Field(default=None, description="Element only present when logged in (account menu, avatar).")
    url_contains: str | None = None
    cookie: str | None = None
    absent_selector: str | None = Field(default=None, description="Element present only when logged OUT (e.g. a Sign in link).")


class AuthProposal(BaseModel):
    login_url: str | None = Field(default=None, description="Page with the login form, if different from the site home.")
    steps: list[LoginStepP]
    success_check: SuccessCheckP
    notes: str = ""


class PaginationP(BaseModel):
    next_selector: str
    max_pages: int = 3


class ListingProposal(BaseModel):
    urls: list[str] = Field(description="Listing pages that show the newest articles (usually 1-3).")
    item_selector: str = Field(description="CSS selector matching ONE element per article card/row.")
    link: FieldRuleP = Field(description="Relative to the item: how to get the article URL, e.g. 'a::attr(href)'.")
    title: FieldRuleP | None = None
    pagination: PaginationP | None = None
    notes: str = ""


class ArticleProposal(BaseModel):
    title: FieldRuleP | None = None
    author: FieldRuleP | None = None
    published_at: FieldRuleP | None = None
    body: BodyRuleP
    cover_image: FieldRuleP | None = None
    paywall_markers: list[str] = Field(default_factory=list, description="Text shown instead of the article when access is missing.")
    notes: str = ""
