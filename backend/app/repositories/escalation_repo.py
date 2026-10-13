from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.escalation import Escalation, EscalationDecision


async def list_escalations(
    db: AsyncSession,
    *,
    decision: Optional[EscalationDecision] = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[Sequence[Escalation], int]:
    conditions = []
    if decision is not None:
        conditions.append(Escalation.decision == decision)

    count_q = select(func.count()).select_from(Escalation)
    if conditions:
        count_q = count_q.where(*conditions)
    total = int((await db.execute(count_q)).scalar_one())

    q = select(Escalation)
    if conditions:
        q = q.where(*conditions)
    q = q.order_by(Escalation.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().unique().all()
    return rows, total


async def count_pending(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Escalation)
        .where(Escalation.decision == EscalationDecision.PENDING)
    )
    return int(result.scalar_one())


async def oldest_pending_age_minutes(db: AsyncSession) -> Optional[int]:
    result = await db.execute(
        select(func.min(Escalation.created_at)).where(
            Escalation.decision == EscalationDecision.PENDING
        )
    )
    oldest = result.scalar_one_or_none()
    if oldest is None:
        return None
    now = datetime.now() if oldest.tzinfo is None else datetime.now(timezone.utc)
    if oldest.tzinfo is None:
        oldest = oldest.replace(tzinfo=now.tzinfo)
    return max(int((now - oldest).total_seconds() // 60), 0)
