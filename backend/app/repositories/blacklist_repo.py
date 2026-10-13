from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blacklist import Blacklist

SORTABLE = {
    "created_at": Blacklist.created_at,
    "full_name": Blacklist.full_name,
    "passport_number": Blacklist.passport_number,
}


async def list_blacklist(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    is_active: Optional[bool] = True,
    page: int = 1,
    page_size: int = 25,
    sort: Optional[str] = None,
    order: str = "desc",
) -> tuple[Sequence[Blacklist], int]:
    conditions = []
    if is_active is not None:
        conditions.append(Blacklist.is_active == is_active)
    if search:
        like = f"%{search.strip()}%"
        conditions.append(
            or_(
                Blacklist.full_name.ilike(like),
                Blacklist.passport_number.ilike(like),
                Blacklist.nationality.ilike(like),
            )
        )

    count_q = select(func.count()).select_from(Blacklist)
    if conditions:
        count_q = count_q.where(and_(*conditions))
    total = int((await db.execute(count_q)).scalar_one())

    column = SORTABLE.get(sort or "", Blacklist.created_at)
    order_by = column.asc() if order == "asc" else column.desc()
    q = select(Blacklist)
    if conditions:
        q = q.where(and_(*conditions))
    q = q.order_by(order_by).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().unique().all()
    return rows, total


async def count_active(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Blacklist)
        .where(Blacklist.is_active == True)  # noqa: E712
    )
    return int(result.scalar_one())


async def count_all(db: AsyncSession) -> int:
    result = await db.execute(select(func.count()).select_from(Blacklist))
    return int(result.scalar_one())
