"""Typed client for the backend's internal scrape API (x-scraper-secret). Outbound HTTPS only."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import httpx

from .config import Settings


class BackendError(RuntimeError):
    def __init__(self, status: int, detail: str):
        super().__init__(f"backend returned {status}: {detail}")
        self.status = status
        self.detail = detail


@dataclass
class LeasedJob:
    id: str
    type: str  # "discover" | "scrape"
    attempts: int
    source: dict[str, Any] = field(default_factory=dict)

    @property
    def source_id(self) -> str:
        return self.source["id"]


@dataclass
class UpsertResult:
    outcome: str  # created | updated | duplicate
    post_id: str
    status: str


class BackendClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self._settings = settings
        self._client = client or httpx.AsyncClient(
            base_url=f"{settings.backend_url.rstrip('/')}/api/v1/internal/scrape",
            headers={"x-scraper-secret": settings.scraper_secret},
            timeout=settings.request_timeout_s,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, path: str, *, retries: int = 3, **kwargs: Any) -> httpx.Response:
        last: Exception | None = None
        for attempt in range(retries):
            try:
                res = await self._client.request(method, path, **kwargs)
            except httpx.TransportError as exc:  # network blip: retry with backoff
                last = exc
                await asyncio.sleep(0.5 * 2**attempt)
                continue
            if res.status_code >= 500 and attempt < retries - 1:
                await asyncio.sleep(0.5 * 2**attempt)
                continue
            if res.status_code >= 400:
                detail = res.text[:300]
                try:
                    detail = res.json().get("detail", detail)
                except ValueError:
                    pass
                raise BackendError(res.status_code, str(detail))
            return res
        raise BackendError(0, f"unreachable: {last}")

    async def lease(self, types: list[str] | None = None) -> LeasedJob | None:
        body: dict[str, Any] = {"workerId": self._settings.worker_id}
        if types:
            body["types"] = types
        res = await self._request("POST", "/jobs/lease", json=body)
        if res.status_code == 204:
            return None
        data = res.json()
        return LeasedJob(id=data["job"]["id"], type=data["job"]["type"], attempts=data["job"]["attempts"], source=data["source"])

    async def heartbeat(self, job_id: str) -> None:
        await self._request("POST", f"/jobs/{job_id}/heartbeat", json={"workerId": self._settings.worker_id})

    async def complete(
        self,
        job_id: str,
        *,
        ok: bool,
        stats: dict[str, int] | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        body: dict[str, Any] = {"workerId": self._settings.worker_id, "ok": ok}
        if stats:
            body["stats"] = stats
        if error_code:
            body["errorCode"] = error_code
        if error_message:
            body["errorMessage"] = error_message[:2000]
        await self._request("POST", f"/jobs/{job_id}/complete", json=body)

    async def existing_urls(self, urls: list[str]) -> set[str]:
        found: set[str] = set()
        for i in range(0, len(urls), 200):
            res = await self._request("POST", "/posts/exists", json={"urls": urls[i : i + 200]})
            found.update(res.json()["existing"])
        return found

    async def upsert_post(self, source_id: str, payload: dict[str, Any]) -> UpsertResult:
        res = await self._request("PUT", "/posts", json={"sourceId": source_id, **payload})
        data = res.json()
        return UpsertResult(outcome=data["outcome"], post_id=data["postId"], status=data["status"])

    async def report_spec(self, source_id: str, *, status: str, spec_hash: str | None = None, store: str | None = None) -> None:
        body: dict[str, Any] = {"status": status}
        if spec_hash:
            body["hash"] = spec_hash
        if store:
            body["store"] = store
        await self._request("PATCH", f"/sources/{source_id}/spec", json=body)
