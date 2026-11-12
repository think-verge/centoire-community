"""Announce the engine to the gateway over NATS (subject `gateway.services`).

Active only when NATS_URL is set. A "hello" goes out every 5 seconds and a "goodbye" on shutdown.
A missing or unreachable NATS server never stops the engine: it logs and keeps retrying.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid

log = logging.getLogger("discovery.registration")

SUBJECT = "gateway.services"
INTERVAL_SECONDS = 5


class Registration:
    def __init__(self, nats_url: str, *, address: str | None = None, connect=None) -> None:
        self.nats_url = nats_url
        self.address = address or os.getenv("ENGINE_PUBLIC_URL", "http://127.0.0.1:8090")
        self.instance_id = str(uuid.uuid4())
        self._connect = connect  # injected in tests; defaults to nats.connect
        self._nc = None
        self._task: asyncio.Task | None = None

    def message(self, kind: str) -> dict:
        return {"type": kind, "instanceId": self.instance_id, "name": "discovery", "address": self.address,
                "routes": [{"path": "/internal/discovery-engine", "private": True}],
                "load": 0, "sentAt": int(time.time() * 1000)}

    async def _publish(self, kind: str) -> None:
        if self._nc is None:
            connect = self._connect
            if connect is None:
                import nats
                connect = nats.connect
            self._nc = await connect(self.nats_url, connect_timeout=3, max_reconnect_attempts=-1)
        await self._nc.publish(SUBJECT, json.dumps(self.message(kind)).encode())

    async def _loop(self) -> None:
        warned = False
        while True:
            try:
                await self._publish("hello")
                if warned:
                    log.info("gateway registration recovered")
                warned = False
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._nc = None
                if not warned:
                    log.warning("gateway registration failed (%s: %s); retrying every %ds",
                                type(exc).__name__, exc, INTERVAL_SECONDS)
                warned = True
            await asyncio.sleep(INTERVAL_SECONDS)

    async def start(self) -> None:
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)
            self._task = None
        try:
            if self._nc is not None:
                await self._publish("goodbye")
                await self._nc.flush(timeout=2)
        except Exception as exc:
            log.warning("gateway goodbye failed: %s", exc)
        finally:
            try:
                if self._nc is not None:
                    await self._nc.close()
            except Exception:
                pass
            self._nc = None


def from_env() -> Registration | None:
    url = os.getenv("NATS_URL")
    return Registration(url) if url else None
