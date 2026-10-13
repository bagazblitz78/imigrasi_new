"""Structured logging configuration (requirement 54/103).

Supports ``LOG_FORMAT=plain`` (human readable) or ``json`` (one JSON object per
line, suitable for log aggregation). Secrets are never logged; the audit layer
and request logger redact sensitive fields.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

from app.core.config import settings
from app.core.request_context import get_request_id


class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        record.app_version = settings.APP_VERSION
        record.app_env = settings.APP_ENV
        return True


_PLAIN_FORMAT = (
    "%(asctime)s | v%(app_version)s | %(levelname)-8s | %(name)s | "
    "req=%(request_id)s | %(message)s"
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "version": getattr(record, "app_version", settings.APP_VERSION),
            "env": getattr(record, "app_env", settings.APP_ENV),
        }
        # Optional structured extras (e.g. CEF-style request details).
        extras = getattr(record, "cef_extension", None)
        if isinstance(extras, dict):
            payload["request"] = extras
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    if settings.LOG_FORMAT.lower() == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(_PLAIN_FORMAT, "%Y-%m-%d %H:%M:%S"))
    handler.addFilter(ContextFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(settings.LOG_LEVEL.upper())

    # uvicorn access logging is replaced by our structured request middleware.
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error", "app"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True
        logger.setLevel(settings.LOG_LEVEL.upper())
