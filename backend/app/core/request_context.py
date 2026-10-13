"""Request-scoped correlation ID (requirement 54/103)."""
from __future__ import annotations

import contextvars
import uuid

_request_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)


def set_request_id(value: str | None = None) -> str:
    rid = value or uuid.uuid4().hex
    _request_id.set(rid)
    return rid


def get_request_id() -> str:
    return _request_id.get()
