"""Authentication primitives: password hashing, JWT access tokens, refresh
token rotation and CSRF double-submit tokens.

Design (requirements 21/22/23):
- Short-lived access JWT (default 15 min) sent in the ``Authorization`` header.
- Opaque refresh token stored in an HttpOnly/Secure/SameSite cookie and hashed
  at rest; rotated on every use and revocable server-side.
- Argon2id is preferred for new passwords; legacy bcrypt hashes keep working and
  are transparently upgraded on successful login.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole

# argon2 first (new hashes), bcrypt second (existing hashes, auto-rehash on login)
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto",
    argon2__time_cost=3,
    argon2__memory_cost=65536,
    argon2__parallelism=2,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

ACCESS_TOKEN_TYPE = "access"


# ── Passwords ────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def needs_rehash(hashed: str) -> bool:
    try:
        return pwd_context.needs_update(hashed)
    except Exception:
        return False


def validate_password_strength(password: str) -> None:
    """Raise ValueError if the password does not meet the policy."""
    if len(password) < 8:
        raise ValueError("Password minimal 8 karakter")
    if len(password) > 128:
        raise ValueError("Password maksimal 128 karakter")
    classes = sum(
        [
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        ]
    )
    if classes < 3:
        raise ValueError(
            "Password harus mengandung minimal 3 dari: huruf kecil, huruf besar, angka, simbol"
        )


# ── JWT access token ─────────────────────────────────────────────────────────
def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode = data.copy()
    to_encode.update(
        {
            "exp": expire,
            "iat": now,
            "nbf": now,
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "type": ACCESS_TOKEN_TYPE,
            "jti": secrets.token_urlsafe(16),
        }
    )
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.JWT_ALGORITHM],  # algorithm confusion protection
        audience=settings.JWT_AUDIENCE,
        issuer=settings.JWT_ISSUER,
        options={"require_exp": True, "require_sub": True},
    )
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise JWTError("invalid token type")
    return payload


# ── Refresh tokens ───────────────────────────────────────────────────────────
def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


# ── CSRF double-submit ───────────────────────────────────────────────────────
def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def csrf_tokens_match(cookie_value: Optional[str], header_value: Optional[str]) -> bool:
    if not cookie_value or not header_value:
        return False
    return hmac.compare_digest(cookie_value, header_value)


# ── Current user dependency ──────────────────────────────────────────────────
def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau sudah kedaluwarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise _credentials_exception()
        user_id = int(subject)
    except (JWTError, ValueError, TypeError):
        raise _credentials_exception()

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise _credentials_exception()
    return user


def require_roles(*roles: UserRole):
    """Dependency factory enforcing role-based access control."""

    async def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak untuk role Anda",
            )
        return current_user

    return _checker


require_agent = require_roles(UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN)
require_supervisor = require_roles(UserRole.SUPERVISOR, UserRole.ADMIN)
require_admin = require_roles(UserRole.ADMIN)
