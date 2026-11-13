"""Minimal Gemini REST client: structured JSON generation and text embeddings."""
from __future__ import annotations

import asyncio
import json
import logging

import httpx

log = logging.getLogger("discovery.gemini")

API = "https://generativelanguage.googleapis.com/v1beta/models"
EMBED_BATCH = 100  # batchEmbedContents accepts at most 100 texts
RETRIES = 4


class GeminiError(Exception):
    pass


class Gemini:
    def __init__(self, api_key: str, *, text_model: str, embed_model: str, dims: int = 768,
                 timeout: float = 120) -> None:
        self.text_model = text_model
        self.embed_model = embed_model
        self.dims = dims
        self._client = httpx.AsyncClient(timeout=timeout, headers={"x-goog-api-key": api_key})

    async def close(self) -> None:
        await self._client.aclose()

    async def _post(self, url: str, body: dict) -> dict:
        for attempt in range(RETRIES):
            try:
                resp = await self._client.post(url, json=body)
            except httpx.TransportError as exc:
                err = f"{type(exc).__name__}: {exc}"
            else:
                if resp.status_code == 200:
                    return resp.json()
                err = f"HTTP {resp.status_code}: {resp.text[:300]}"
                if resp.status_code not in (429, 500, 502, 503, 504):
                    raise GeminiError(err)
            wait = 5 * 2 ** attempt
            log.warning("gemini call failed (%s); retrying in %ds", err, wait)
            await asyncio.sleep(wait)
        raise GeminiError(f"gave up after {RETRIES} attempts: {err}")

    async def generate_json(self, prompt: str, schema: dict, *, model: str | None = None) -> list | dict:
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema,
                                 "temperature": 0},
        }
        data = await self._post(f"{API}/{model or self.text_model}:generateContent", body)
        try:
            return json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            raise GeminiError(f"unexpected response: {str(data)[:300]}") from exc

    async def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), EMBED_BATCH):
            body = {"requests": [
                {"model": f"models/{self.embed_model}", "content": {"parts": [{"text": t}]},
                 "taskType": "SEMANTIC_SIMILARITY", "outputDimensionality": self.dims}
                for t in texts[i:i + EMBED_BATCH]]}
            data = await self._post(f"{API}/{self.embed_model}:batchEmbedContents", body)
            out += [e["values"] for e in data["embeddings"]]
        return out
