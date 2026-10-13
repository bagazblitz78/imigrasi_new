"""FastAPI application factory.

Database schema is managed exclusively by Alembic migrations (no
``Base.metadata.create_all`` at startup) so production schema evolution is
explicit and data-safe (requirements 33/70/99).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import text

from app.api.v1.endpoints import health
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestLoggingMiddleware, SecurityHeadersMiddleware

configure_logging()
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info(
            "%s v%s (%s) siap — koneksi database OK",
            settings.APP_NAME,
            settings.APP_VERSION,
            settings.APP_ENV,
        )
    except Exception as exc:  # pragma: no cover - startup diagnostics
        logger.warning(
            "%s v%s — database belum dapat dihubungi saat startup: %s",
            settings.APP_NAME,
            settings.APP_VERSION,
            exc,
        )
    yield
    logger.info("%s v%s — shutting down", settings.APP_NAME, settings.APP_VERSION)
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API Sistem Pemeriksaan Imigrasi Bandara",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if not settings.is_production else None,
)

register_exception_handlers(app)

# Innermost -> outermost. CORS added last so its headers are applied to every
# response, including errors.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
    max_age=600,
)

app.include_router(health.router)
app.include_router(api_router, prefix="/api/v1")

# Serve the self-contained UI at the root so the service is reachable at "/"
# even when hosted standalone (e.g. a single serverless deployment). In the
# normal production setup the SPA is served by Nginx and this is just a fallback.
_STATIC_DIR = Path(__file__).resolve().parent / "static"


@app.get("/", include_in_schema=False)
async def index():
    index_file = _STATIC_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file, media_type="text/html; charset=utf-8")
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
        "health": "/health",
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)
