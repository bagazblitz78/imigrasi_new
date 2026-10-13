from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Optional, Sequence

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.audit import AuditLog


async def list_audit_logs(
    db: AsyncSession,
    *,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[Sequence[AuditLog], int]:
    conditions = []
    if user_id:
        conditions.append(AuditLog.user_id == user_id)
    if action:
        conditions.append(AuditLog.action == action)
    if date_from:
        conditions.append(AuditLog.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        conditions.append(
            AuditLog.created_at
            < datetime.combine(date_to, time.min) + timedelta(days=1)
        )

    count_q = select(func.count()).select_from(AuditLog)
    if conditions:
        count_q = count_q.where(and_(*conditions))
    total = int((await db.execute(count_q)).scalar_one())

    q = select(AuditLog).options(joinedload(AuditLog.user))
    if conditions:
        q = q.where(and_(*conditions))
    q = q.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().unique().all()
    return rows, total


async def count_today(db: AsyncSession) -> int:
    start = datetime.combine(date.today(), time.min)
    result = await db.execute(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.created_at >= start)
    )
    return int(result.scalar_one())
