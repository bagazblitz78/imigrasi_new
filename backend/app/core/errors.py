"""Consistent API error responses.

Clients always receive::

    {"error": {"code": "...", "message": "...", "details": ..., "request_id": "..."}}

Internal details (stack traces, SQL errors, paths) are never leaked
(requirement 53).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import get_request_id

logger = logging.getLogger("app.error")


class AppError(Exception):
    """Base class for expected, client-safe application errors."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "bad_request"

    def __init__(self, message: str, *, details: Any = None):
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class ValidationError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "validation_error"


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"

    def __init__(self, message: str, retry_after: int = 60, *, details: Any = None):
        super().__init__(message, details=details)
        self.retry_after = retry_after


def _payload(code: str, message: str, details: Any = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": get_request_id(),
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        headers = {}
        if isinstance(exc, RateLimitedError):
            headers["Retry-After"] = str(exc.retry_after)
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(exc.code, exc.message, exc.details),
            headers=headers,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        code = {
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            409: "conflict",
            413: "payload_too_large",
            429: "rate_limited",
        }.get(exc.status_code, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else "Permintaan gagal"
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(code, message),
            headers=getattr(exc, "headers", None) or {},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        details = [
            {
                "field": ".".join(str(part) for part in err.get("loc", []) if part != "body"),
                "message": err.get("msg", "nilai tidak valid"),
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_payload("validation_error", "Data yang dikirim tidak valid", details),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload("internal_error", "Terjadi kesalahan pada server"),
        )
