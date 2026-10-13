"""Append-oriented audit logging (requirement 29).

Sensitive values must never be passed to ``detail``.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.request_context import get_request_id
from app.models.audit import AuditLog


async def log_action(
    db: AsyncSession,
    user_id: Optional[int],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    detail: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
        ip_address=ip_address,
        request_id=get_request_id(),
    )
    db.add(entry)
    await db.flush()
    return entry


# Actions that are considered security-relevant and always audited.
SECURITY_ACTIONS = {
    "LOGIN",
    "LOGIN_FAILED",
    "LOGOUT",
    "PASSWORD_CHANGED",
    "ADMIN_RESET_PASSWORD",
    "CREATE_USER",
    "UPDATE_USER",
    "DEACTIVATE_USER",
    "ADD_BLACKLIST",
    "REMOVE_BLACKLIST",
    "UPDATE_BLACKLIST",
}
