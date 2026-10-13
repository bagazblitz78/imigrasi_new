"""Shared API dependencies."""
from __future__ import annotations

from fastapi import Request

from app.core.config import settings
from app.core.errors import ForbiddenError
from app.core.security import csrf_tokens_match


def get_client_ip(request: Request) -> str:
    """Best-effort client IP.

    The backend is not exposed publicly in production; Nginx (the only ingress)
    sets ``X-Forwarded-For``. We still take only the first hop.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def get_user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "")[:256]


def enforce_csrf(request: Request) -> None:
    """Double-submit CSRF check for cookie-authenticated state changes."""
    cookie_value = request.cookies.get(settings.CSRF_COOKIE_NAME)
    header_value = request.headers.get(settings.CSRF_HEADER)
    if not csrf_tokens_match(cookie_value, header_value):
        raise ForbiddenError("Token CSRF tidak valid atau tidak ada")
