from __future__ import annotations

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.counter import Counter, CounterStatus


async def list_counters(db: AsyncSession) -> Sequence[Counter]:
    result = await db.execute(
        select(Counter).options(selectinload(Counter.agents)).order_by(Counter.name.asc())
    )
    return result.scalars().unique().all()


async def count_active(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Counter)
        .where(Counter.status == CounterStatus.ACTIVE)
    )
    return int(result.scalar_one())
