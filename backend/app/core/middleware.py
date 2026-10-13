"""ASGI middleware: correlation IDs, structured request logging and security
headers (requirements 30/54/103)."""
from __future__ import annotations

import json
import time

from app.core.request_context import get_request_id, set_request_id

_SENSITIVE_KEYS = {
    "password",
    "hashed_password",
    "new_password",
    "old_password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "secret_key",
    "ticket",
    "authorization",
}
_QUIET_PATHS = {"/health", "/health/live", "/health/ready"}


def _redact(value):
    if isinstance(value, dict):
        return {
            k: ("***REDACTED***" if k.lower() in _SENSITIVE_KEYS else _redact(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


class RequestLoggingMiddleware:
    """Pure ASGI middleware so the request body still reaches the endpoint."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        import logging

        logger = logging.getLogger("app.request")

        start = time.perf_counter()
        method = scope.get("method", "")
        path = scope.get("path", "")
        client = scope.get("client")
        client_host = client[0] if client else None
        quiet = path in _QUIET_PATHS

        incoming_rid = None
        content_type = ""
        for key, val in scope.get("headers", []):
            if key == b"x-request-id":
                incoming_rid = val.decode(errors="ignore")
            elif key == b"content-type":
                content_type = val.decode(errors="ignore")
        rid = set_request_id(incoming_rid)

        body_chunks: list[bytes] = []
        capture_body = "application/json" in content_type

        async def receive_wrapper():
            message = await receive()
            if capture_body and message["type"] == "http.request":
                body_chunks.append(message.get("body", b""))
            return message

        status_holder = {"status": None}
        response_chunks: list[bytes] = []

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                message.setdefault("headers", []).append(
                    (b"x-request-id", rid.encode())
                )
            elif message["type"] == "http.response.body" and not quiet:
                if (status_holder["status"] or 0) >= 400:
                    response_chunks.append(message.get("body", b""))
            await send(message)

        await self.app(scope, receive_wrapper, send_wrapper)

        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        status_code = status_holder["status"] or 0
        detail = {
            "method": method,
            "path": path,
            "status": status_code,
            "duration_ms": duration_ms,
            "client": client_host,
            "request_id": rid,
        }
        if method in ("POST", "PUT", "PATCH") and "application/json" in content_type:
            raw = b"".join(body_chunks)
            if raw:
                try:
                    detail["body"] = _redact(json.loads(raw))
                except Exception:
                    pass
        if status_code >= 400 and response_chunks:
            try:
                detail["response"] = _redact(json.loads(b"".join(response_chunks)))
            except Exception:
                pass

        summary = f"{method} {path} -> {status_code} ({duration_ms}ms)"
        extra = {"cef_extension": detail}
        if status_code >= 500:
            logger.error(summary, extra=extra)
        elif status_code >= 400:
            logger.warning(summary, extra=extra)
        else:
            logger.info(summary, extra=extra)


SECURITY_HEADERS = {
    b"x-content-type-options": b"nosniff",
    b"x-frame-options": b"DENY",
    b"referrer-policy": b"no-referrer",
    b"permissions-policy": b"camera=(self), microphone=(), geolocation=()",
    b"cross-origin-resource-policy": b"same-site",
    b"cache-control": b"no-store",
}


class SecurityHeadersMiddleware:
    """Defense-in-depth headers for API responses (Nginx adds the rest)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = message.setdefault("headers", [])
                existing = {k.lower() for k, _ in headers}
                for key, value in SECURITY_HEADERS.items():
                    if key not in existing:
                        headers.append((key, value))
            await send(message)

        await self.app(scope, receive, send_wrapper)
