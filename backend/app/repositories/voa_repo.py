from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.voa import VOA, VOAStatus


async def list_voa(
    db: AsyncSession,
    *,
    status: Optional[VOAStatus] = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[Sequence[VOA], int]:
    conditions = []
    if status is not None:
        conditions.append(VOA.status == status)

    count_q = select(func.count()).select_from(VOA)
    if conditions:
        count_q = count_q.where(*conditions)
    total = int((await db.execute(count_q)).scalar_one())

    q = select(VOA)
    if conditions:
        q = q.where(*conditions)
    q = q.order_by(VOA.applied_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().unique().all()
    return rows, total


async def count_pending(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(VOA).where(VOA.status == VOAStatus.PENDING)
    )
    return int(result.scalar_one())
