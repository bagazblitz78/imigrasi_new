from __future__ import annotations

from typing import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def list_for_user(
    db: AsyncSession, user_id: int, limit: int = 50
) -> Sequence[Notification]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def unread_count(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
    )
    return int(result.scalar_one())


async def mark_read(db: AsyncSession, user_id: int, notification_id: int) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.id == notification_id)
        .values(is_read=True)
    )


async def mark_all_read(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
