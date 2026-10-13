from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole

SORTABLE = {
    "created_at": User.created_at,
    "full_name": User.full_name,
    "username": User.username,
    "role": User.role,
}


async def list_users(
    db: AsyncSession,
    *,
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
    sort: Optional[str] = None,
    order: str = "asc",
) -> tuple[Sequence[User], int]:
    conditions = []
    if search:
        like = f"%{search.strip()}%"
        conditions.append(
            or_(
                User.username.ilike(like),
                User.full_name.ilike(like),
                User.email.ilike(like),
            )
        )
    if role is not None:
        conditions.append(User.role == role)
    if is_active is not None:
        conditions.append(User.is_active == is_active)

    count_q = select(func.count()).select_from(User)
    if conditions:
        count_q = count_q.where(and_(*conditions))
    total = int((await db.execute(count_q)).scalar_one())

    column = SORTABLE.get(sort or "", User.id)
    order_by = column.asc() if order == "asc" else column.desc()
    q = select(User)
    if conditions:
        q = q.where(and_(*conditions))
    q = q.order_by(order_by).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().unique().all()
    return rows, total


async def get_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def supervisors_and_admins(db: AsyncSession) -> Sequence[User]:
    result = await db.execute(
        select(User).where(
            User.role.in_([UserRole.SUPERVISOR, UserRole.ADMIN]),
            User.is_active == True,  # noqa: E712
        )
    )
    return result.scalars().all()
