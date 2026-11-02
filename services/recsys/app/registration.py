import asyncio
import json
import logging
import os
import time
import uuid
from typing import List, Dict, Any, Optional
import nats
from nats.aio.client import Client as NATS

from . import config

logger = logging.getLogger("recsys.registration")

GATEWAY_SERVICES_SUBJECT = "gateway.services"


class GatewayRegistration:
    def __init__(
        self,
        name: str = "recsys",
        routes: Optional[List[Dict[str, Any]]] = None,
        interval_sec: float = 5.0,
    ):
        self.name = name
        self.routes = routes or [
            {"path": "/api/v1/feed/for-you"},
            {"path": "/api/v1/suggestions"},
            {"path": "/internal/recsys", "private": True},
        ]
        self.interval_sec = interval_sec
        self.instance_id = str(uuid.uuid4())
        self.nc: Optional[NATS] = None
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def _get_load(self) -> float:
        try:
            return os.getloadavg()[0] / (os.cpu_count() or 1)
        except (AttributeError, OSError):
            return 0.1

    def _make_ping(self, ping_type: str) -> bytes:
        payload = {
            "type": ping_type,
            "instanceId": self.instance_id,
            "name": self.name,
            "address": config.ANNOUNCE_ADDRESS,
            "routes": self.routes,
            "load": self._get_load(),
            "sentAt": int(time.time() * 1000),
        }
        return json.dumps(payload).encode("utf-8")

    async def start(self) -> None:
        if not config.NATS_URL:
            logger.warning("[recsys] NATS_URL not configured; skipping gateway registration")
            return

        try:
            self.nc = await nats.connect(config.NATS_URL)
            logger.info(f"[recsys] Connected to NATS at {config.NATS_URL}")
        except Exception as e:
            logger.warning(f"[recsys] Could not connect to NATS ({e}); registration delayed")
            return

        self._running = True
        # Send initial hello
        try:
            await self.nc.publish(GATEWAY_SERVICES_SUBJECT, self._make_ping("hello"))
            logger.info(f"[recsys] Registered with gateway at {config.ANNOUNCE_ADDRESS}")
        except Exception as e:
            logger.error(f"[recsys] Failed to publish initial hello: {e}")

        # Start periodic heartbeat
        self._task = asyncio.create_task(self._heartbeat_loop())

    async def _heartbeat_loop(self) -> None:
        while self._running:
            try:
                await asyncio.sleep(self.interval_sec)
                if self.nc and self.nc.is_connected:
                    await self.nc.publish(GATEWAY_SERVICES_SUBJECT, self._make_ping("hello"))
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"[recsys] Heartbeat ping error: {e}")

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        if self.nc and self.nc.is_connected:
            try:
                await self.nc.publish(GATEWAY_SERVICES_SUBJECT, self._make_ping("goodbye"))
                await self.nc.flush()
                await self.nc.close()
                logger.info("[recsys] Unregistered from gateway and closed NATS connection")
            except Exception as e:
                logger.debug(f"[recsys] Goodbye publish error: {e}")

