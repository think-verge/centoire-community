from typing import Optional
from fastapi import Header, HTTPException, status
from pydantic import BaseModel

from . import config

HDR_GATEWAY_SECRET = "x-gateway-secret"
HDR_INTERNAL_SECRET = "x-internal-secret"
HDR_USER_ID = "x-user-id"
HDR_USER_EMAIL = "x-user-email"
HDR_USER_ROLE = "x-user-role"


class UserClaims(BaseModel):
    userId: str
    email: str
    role: str = "user"


async def get_current_user(
    x_gateway_secret: Optional[str] = Header(None, alias=HDR_GATEWAY_SECRET),
    x_internal_secret: Optional[str] = Header(None, alias=HDR_INTERNAL_SECRET),
    x_user_id: Optional[str] = Header(None, alias=HDR_USER_ID),
    x_user_email: Optional[str] = Header(None, alias=HDR_USER_EMAIL),
    x_user_role: Optional[str] = Header(None, alias=HDR_USER_ROLE),
) -> Optional[UserClaims]:
    """
    Resolves user claims forwarded by the gateway.
    Claims are only trusted if the request carries a valid gateway secret or internal secret.
    """
    is_trusted = (
        (x_gateway_secret and x_gateway_secret == config.GATEWAY_SECRET)
        or (x_internal_secret and x_internal_secret == config.INTERNAL_SECRET)
    )

    if not is_trusted or not x_user_id:
        return None

    return UserClaims(
        userId=x_user_id,
        email=x_user_email or "",
        role=x_user_role or "user",
    )


async def require_auth(
    x_gateway_secret: Optional[str] = Header(None, alias=HDR_GATEWAY_SECRET),
    x_internal_secret: Optional[str] = Header(None, alias=HDR_INTERNAL_SECRET),
    x_user_id: Optional[str] = Header(None, alias=HDR_USER_ID),
    x_user_email: Optional[str] = Header(None, alias=HDR_USER_EMAIL),
    x_user_role: Optional[str] = Header(None, alias=HDR_USER_ROLE),
) -> UserClaims:
    """Requires authenticated user claims forwarded from the edge gateway."""
    user = await get_current_user(
        x_gateway_secret=x_gateway_secret,
        x_internal_secret=x_internal_secret,
        x_user_id=x_user_id,
        x_user_email=x_user_email,
        x_user_role=x_user_role,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


async def require_internal_secret(
    x_internal_secret: Optional[str] = Header(None, alias=HDR_INTERNAL_SECRET),
) -> None:
    """Enforces internal service-to-service secret for private routes."""
    if not x_internal_secret or x_internal_secret != config.INTERNAL_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal secret required",
        )

