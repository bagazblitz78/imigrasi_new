"""Database-backed login rate limiting.

Unlike the legacy in-process counter, attempts are stored in the shared
database so the limit is enforced consistently across all worker processes and
containers (requirement 24). Limits are tracked per client IP and per account
identifier, mitigating brute force, credential stuffing and password spraying
without creating a username-enumeration oracle.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Tuple

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.login_attempt import LoginAttempt


async def _count_recent(db: AsyncSession, column, value: str, since: datetime) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(LoginAttempt)
        .where(column == value, LoginAttempt.created_at >= since)
    )
    return int(result.scalar_one())


async def check_locked_out(
    db: AsyncSession, ip: str, username: str
) -> Tuple[bool, int]:
    """Return (locked_out, retry_after_seconds)."""
    username = (username or "").strip().lower()
    window_start = datetime.now(timezone.utc) - timedelta(
        seconds=settings.LOGIN_WINDOW_SECONDS
    )
    ip_count = await _count_recent(db, LoginAttempt.ip_address, ip, window_start)
    user_count = await _count_recent(
        db, LoginAttempt.username, username, window_start
    )
    if ip_count >= settings.LOGIN_MAX_ATTEMPTS:
        return True, settings.LOGIN_LOCKOUT_SECONDS
    if user_count >= settings.LOGIN_MAX_ATTEMPTS:
        return True, settings.LOGIN_LOCKOUT_SECONDS
    return False, 0


async def record_failure(db: AsyncSession, ip: str, username: str) -> None:
    db.add(
        LoginAttempt(
            ip_address=ip,
            username=(username or "").strip().lower(),
        )
    )
    await db.flush()


async def record_success(db: AsyncSession, ip: str, username: str) -> None:
    username = (username or "").strip().lower()
    await db.execute(
        delete(LoginAttempt).where(
            (LoginAttempt.ip_address == ip) | (LoginAttempt.username == username)
        )
    )


async def prune_old_attempts(db: AsyncSession) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(
        seconds=settings.LOGIN_WINDOW_SECONDS * 2
    )
    await db.execute(delete(LoginAttempt).where(LoginAttempt.created_at < cutoff))
