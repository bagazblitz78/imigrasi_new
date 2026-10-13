"""Authentication/session orchestration: login, refresh rotation, logout.

Security properties (requirements 21/22/24):
- Access tokens are short-lived JWTs returned in the response body (kept in
  memory by the SPA, never in localStorage).
- Refresh tokens are opaque, hashed at rest, stored server-side, rotated on
  every use and revocable. Refresh token reuse invalidates the whole family.
- Refresh/CSRF cookies are HttpOnly/Secure/SameSite when configured.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    generate_csrf_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User


class AuthenticationError(AppError):
    status_code = 401
    code = "authentication_failed"


class SessionExpiredError(AppError):
    status_code = 401
    code = "session_expired"


def set_session_cookies(response: Response, refresh_token: str, csrf_token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        path="/",
        domain=settings.COOKIE_DOMAIN or None,
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        path="/",
        domain=settings.COOKIE_DOMAIN or None,
    )


def clear_session_cookies(response: Response) -> None:
    for name in (settings.REFRESH_COOKIE_NAME, settings.CSRF_COOKIE_NAME):
        response.delete_cookie(
            key=name,
            path="/",
            domain=settings.COOKIE_DOMAIN or None,
        )


async def _create_refresh_row(
    db: AsyncSession,
    user: User,
    *,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> str:
    token = generate_refresh_token()
    row = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(token),
        expires_at=refresh_token_expiry(),
        ip_address=ip_address,
        user_agent=(user_agent or "")[:256] or None,
    )
    db.add(row)
    await db.flush()
    return token


async def authenticate(
    db: AsyncSession,
    *,
    username: str,
    password: str,
    ip_address: str,
) -> User:
    locked, retry_after = await rate_limit.check_locked_out(db, ip_address, username)
    if locked:
        from app.core.errors import RateLimitedError

        raise RateLimitedError(
            "Terlalu banyak percobaan login gagal. Coba beberapa saat lagi.",
            retry_after=retry_after,
        )

    user = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()

    # Constant-ish behaviour: always run a verify to reduce timing signals.
    stored = user.hashed_password if user else "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv"
    password_ok = verify_password(password, stored)

    if not user or not password_ok:
        await rate_limit.record_failure(db, ip_address, username)
        # Persist the failed attempt before raising: the request-scoped session
        # rolls back on exception, and the lockout must survive that.
        await db.commit()
        # Generic message: no username-enumeration oracle.
        raise AuthenticationError("Username atau password salah")

    if not user.is_active:
        raise AuthenticationError("Akun tidak aktif. Hubungi Administrator.")

    await rate_limit.record_success(db, ip_address, username)

    # Opportunistically upgrade legacy bcrypt hashes to Argon2id.
    from app.core.security import needs_rehash

    if needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(password)

    return user


async def start_session(
    db: AsyncSession,
    user: User,
    *,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> Tuple[str, str, str]:
    """Return (access_token, refresh_token, csrf_token)."""
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    refresh_token = await _create_refresh_row(
        db, user, ip_address=ip_address, user_agent=user_agent
    )
    return access_token, refresh_token, generate_csrf_token()


async def rotate_session(
    db: AsyncSession,
    *,
    refresh_token: str,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> Tuple[User, str, str, str]:
    """Validate + rotate a refresh token. Returns (user, access, refresh, csrf)."""
    token_hash = hash_refresh_token(refresh_token)
    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    ).scalar_one_or_none()

    if row is None:
        raise SessionExpiredError("Sesi tidak valid. Silakan login kembali.")

    if row.revoked_at is not None:
        # Reuse of a rotated token -> assume theft, revoke the whole family.
        await revoke_all_for_user(db, row.user_id)
        raise SessionExpiredError("Sesi tidak valid. Silakan login kembali.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if row.expires_at < now:
        raise SessionExpiredError("Sesi sudah kedaluwarsa. Silakan login kembali.")

    user = await db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise SessionExpiredError("Akun tidak aktif. Hubungi Administrator.")

    new_token = generate_refresh_token()
    row.revoked_at = now
    row.replaced_by_hash = hash_refresh_token(new_token)

    new_row = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(new_token),
        expires_at=refresh_token_expiry(),
        ip_address=ip_address,
        user_agent=(user_agent or "")[:256] or None,
    )
    db.add(new_row)
    await db.flush()

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return user, access_token, new_token, generate_csrf_token()


async def revoke_refresh_token(db: AsyncSession, refresh_token: Optional[str]) -> None:
    if not refresh_token:
        return
    token_hash = hash_refresh_token(refresh_token)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc).replace(tzinfo=None))
    )


async def revoke_all_for_user(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc).replace(tzinfo=None))
    )
