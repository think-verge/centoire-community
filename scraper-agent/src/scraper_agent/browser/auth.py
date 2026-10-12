"""Runs a spec's scripted login. Credentials are injected here and nowhere else."""

from __future__ import annotations

import logging
from typing import Any

from ..extract.replay import ReplayError
from ..secrets import Credential
from ..spec.models import AuthSpec, LoginStep, SuccessCheck

log = logging.getLogger("scraper.auth")

# Anything that needs a human: we never try to solve or bypass these.
CHALLENGE_SELECTORS = [
    "iframe[src*='recaptcha']",
    "iframe[src*='hcaptcha']",
    "iframe[src*='challenges.cloudflare.com']",
    "[name='cf-turnstile-response']",
    "input[autocomplete='one-time-code']",
    "input[name*='otp' i]",
    "input[name*='verification' i]",
]


async def _query(page: Any, selector: str) -> Any:
    try:
        return await page.query_selector(selector)
    except Exception as exc:  # an invalid selector (e.g. jQuery's :contains) is the spec's fault, not a crash
        raise ReplayError(f"Invalid success_check selector {selector!r}: use plain CSS (ids, classes, tags, attributes)", code="layout_changed") from exc


async def _is_logged_in(page: Any, check: SuccessCheck) -> bool:
    if check.url_contains and check.url_contains in page.url:
        return True
    if check.selector and await _query(page, check.selector):
        return True
    if check.cookie:
        cookies = await page.context.cookies()
        if any(c["name"] == check.cookie for c in cookies):
            return True
    if check.absent_selector and not await _query(page, check.absent_selector):
        return True
    return False


async def _challenge_present(page: Any) -> bool:
    for selector in CHALLENGE_SELECTORS:
        if await page.query_selector(selector):
            return True
    return False


async def _run_step(page: Any, step: LoginStep, credential: Credential) -> None:
    if step.action == "goto":
        await page.goto(step.url, wait_until="domcontentloaded")
    elif step.action == "fill":
        # The value is never logged; only the field name and selector are.
        log.info("login: fill %s into %s", step.from_secret, step.selector)
        await page.fill(step.selector, credential.value(step.from_secret or ""))
    elif step.action == "click":
        await page.click(step.selector)
    elif step.action == "press":
        await page.keyboard.press(step.key)
    elif step.action == "wait_for_selector":
        await page.wait_for_selector(step.selector)
    elif step.action == "wait_for_url":
        await page.wait_for_url(step.url)


async def ensure_logged_in(page: Any, site_url: str, auth: AuthSpec, credential: Credential) -> bool:
    """Makes sure the browser holds a valid session. Returns True if it had to log in, False if already logged in.

    Raises ReplayError: `needs_human` for CAPTCHA/2FA, `login_expired` when the credentials are rejected.
    """
    assert auth.success_check is not None
    await page.goto(site_url, wait_until="domcontentloaded")
    if await _is_logged_in(page, auth.success_check):
        return False

    log.info("login: session missing or expired, logging in as %s", credential.ref)
    if auth.login_url:
        await page.goto(auth.login_url, wait_until="domcontentloaded")
    for step in auth.steps:
        try:
            await _run_step(page, step, credential)
        except Exception as exc:  # playwright TimeoutError / Error: the login form isn't what the spec says
            detail = str(exc).splitlines()[0] if str(exc) else type(exc).__name__
            raise ReplayError(f"Login step {step.action} {step.selector or step.url or ''} failed: {detail}", code="layout_changed") from exc
        if await _challenge_present(page):
            raise ReplayError("A CAPTCHA or verification step is blocking the login", code="needs_human")
    await page.wait_for_load_state("domcontentloaded")

    if await _is_logged_in(page, auth.success_check):
        return True
    if await _challenge_present(page):
        raise ReplayError("A CAPTCHA or verification step is blocking the login", code="needs_human")
    raise ReplayError(f"Login as {credential.ref!r} did not succeed (wrong or expired credentials?)", code="login_expired")
