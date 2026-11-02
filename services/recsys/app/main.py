from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .auth import UserClaims, get_current_user, require_internal_secret
from .registration import GatewayRegistration

registration = GatewayRegistration(name="recsys")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: register with the gateway via NATS
    await registration.start()
    yield
    # Shutdown: send goodbye and clean up
    await registration.stop()


app = FastAPI(
    title="Centoire Recommendation Service",
    description="Stage 0 For You feed, candidate ranking, topic-mix, and circle/creator suggestions.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> Dict[str, str]:
    """Health check endpoint used by orchestrators and gateway."""
    return {
        "status": "ok",
        "service": "recsys",
        "version": "0.1.0",
    }


@app.get("/api/v1/feed/for-you")
async def get_for_you_feed(
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=50),
    user: Optional[UserClaims] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Personalized Stage 0 For You feed.
    Receives user identity verified by the Gateway.
    """
    return {
        "status": "ok",
        "service": "recsys",
        "authenticated": user is not None,
        "user": user.model_dump() if user else None,
        "items": [],
        "cursor": None,
        "hasMore": False,
    }


@app.get("/api/v1/suggestions")
async def get_suggestions(
    user: Optional[UserClaims] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Suggestions for circles and creators based on user's topic mix and network."""
    return {
        "status": "ok",
        "service": "recsys",
        "authenticated": user is not None,
        "user": user.model_dump() if user else None,
        "circles": [],
        "creators": [],
    }


@app.get("/internal/recsys/status")
async def internal_status(
    _auth: None = Depends(require_internal_secret),
) -> Dict[str, Any]:
    """Internal administration status route; accessible only via gateway private port."""
    return {
        "status": "healthy",
        "service": "recsys",
        "registeredRoutes": registration.routes,
        "announceAddress": config.ANNOUNCE_ADDRESS,
        "natsConnected": bool(registration.nc and registration.nc.is_connected),
    }

