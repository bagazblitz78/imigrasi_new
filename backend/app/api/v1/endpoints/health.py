from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

router = APIRouter()


@router.get("/health/live", include_in_schema=False)
async def liveness():
    return {"status": "alive"}


@router.get("/health/ready", include_in_schema=False)
async def readiness(db: AsyncSession = Depends(get_db)):
    health = {"status": "ready", "checks": {"database": "up"}}
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        health = {
            "status": "not_ready",
            "checks": {"database": "down"},
        }
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=health)
    return health


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    database = "up"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        database = "down"
    return {
        "status": "ok" if database == "up" else "degraded",
        "service": "imigrasi-api",
        "version": settings.APP_VERSION,
        "database": database,
    }
