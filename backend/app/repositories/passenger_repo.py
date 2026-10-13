from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Optional, Sequence

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import can_view_all_passengers
from app.models.passenger import Passenger, PassengerStatus, TravelDirection
from app.models.user import User

SORTABLE = {
    "created_at": Passenger.created_at,
    "full_name": Passenger.full_name,
    "passport_number": Passenger.passport_number,
    "status": Passenger.status,
    "processed_at": Passenger.processed_at,
    "nationality": Passenger.nationality,
}


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min)
    return start, start + timedelta(days=1)


async def list_passengers(
    db: AsyncSession,
    *,
    viewer: User,
    status: Optional[PassengerStatus] = None,
    direction: Optional[TravelDirection] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 25,
    sort: Optional[str] = None,
    order: str = "desc",
) -> tuple[Sequence[Passenger], int]:
    conditions = []
    if not can_view_all_passengers(viewer):
        conditions.append(Passenger.agent_id == viewer.id)
    if status is not None:
        conditions.append(Passenger.status == status)
    if direction is not None:
        conditions.append(Passenger.direction == direction)
    if search:
        like = f"%{search.strip()}%"
        conditions.append(
            or_(
                Passenger.full_name.ilike(like),
                Passenger.passport_number.ilike(like),
                Passenger.flight_number.ilike(like),
                Passenger.nationality.ilike(like),
            )
        )
    if date_from:
        conditions.append(Passenger.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        conditions.append(
            Passenger.created_at
            < datetime.combine(date_to, time.min) + timedelta(days=1)
        )

    count_q = select(func.count()).select_from(Passenger)
    if conditions:
        count_q = count_q.where(and_(*conditions))
    total = int((await db.execute(count_q)).scalar_one())

    column = SORTABLE.get(sort or "", Passenger.created_at)
    order_by = column.asc() if order == "asc" else column.desc()

    q = select(Passenger)
    if conditions:
        q = q.where(and_(*conditions))
    q = q.order_by(order_by, Passenger.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).scalars().unique().all()
    return rows, total


async def agent_today_count(db: AsyncSession, agent_id: int) -> int:
    today = date.today()
    start, end = _day_bounds(today)
    result = await db.execute(
        select(func.count())
        .select_from(Passenger)
        .where(
            and_(
                Passenger.agent_id == agent_id,
                Passenger.created_at >= start,
                Passenger.created_at < end,
            )
        )
    )
    return int(result.scalar_one())


async def agent_recent(db: AsyncSession, agent_id: int, limit: int = 10) -> Sequence[Passenger]:
    result = await db.execute(
        select(Passenger)
        .where(Passenger.agent_id == agent_id)
        .order_by(Passenger.created_at.desc())
        .limit(limit)
    )
    return result.scalars().unique().all()


async def stats_for_range(
    db: AsyncSession,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> dict:
    conditions = []
    if start:
        conditions.append(Passenger.created_at >= datetime.combine(start, time.min))
    if end:
        conditions.append(
            Passenger.created_at < datetime.combine(end, time.min) + timedelta(days=1)
        )
    if not start and not end:
        s, e = _day_bounds(date.today())
        conditions.append(Passenger.created_at >= s)
        conditions.append(Passenger.created_at < e)

    from sqlalchemy import case

    def cw(cond):
        return func.sum(case((cond, 1), else_=0))

    summary_q = select(
        func.count().label("total"),
        cw(Passenger.direction == TravelDirection.ARRIVAL).label("arrivals"),
        cw(Passenger.direction == TravelDirection.DEPARTURE).label("departures"),
        cw(Passenger.status == PassengerStatus.HOLD).label("hold"),
        cw(Passenger.status == PassengerStatus.APPROVED).label("approved"),
        cw(Passenger.status == PassengerStatus.PENDING).label("pending"),
        cw(Passenger.status == PassengerStatus.DEPORTED).label("deported"),
        cw(Passenger.status == PassengerStatus.REJECTED).label("rejected"),
    )
    if conditions:
        summary_q = summary_q.where(and_(*conditions))
    summary = (await db.execute(summary_q)).one()

    nat_q = select(Passenger.nationality, func.count().label("total"))
    if conditions:
        nat_q = nat_q.where(and_(*conditions))
    nat_q = nat_q.group_by(Passenger.nationality).order_by(func.count().desc()).limit(50)
    nat_rows = (await db.execute(nat_q)).all()

    return {
        "total_today": int(summary.total or 0),
        "arrivals_today": int(summary.arrivals or 0),
        "departures_today": int(summary.departures or 0),
        "hold_today": int(summary.hold or 0),
        "approved_today": int(summary.approved or 0),
        "pending_today": int(summary.pending or 0),
        "deported_today": int(summary.deported or 0),
        "rejected_today": int(summary.rejected or 0),
        "by_nationality": {row.nationality: int(row.total) for row in nat_rows},
    }


async def export_rows(
    db: AsyncSession,
    *,
    start: Optional[date] = None,
    end: Optional[date] = None,
    direction: Optional[str] = None,
) -> Sequence[Passenger]:
    q = select(Passenger).order_by(Passenger.created_at.desc())
    if start:
        q = q.where(Passenger.created_at >= datetime.combine(start, time.min))
    if end:
        q = q.where(
            Passenger.created_at < datetime.combine(end, time.min) + timedelta(days=1)
        )
    if direction in ("arrival", "departure"):
        q = q.where(Passenger.direction == TravelDirection(direction))
    return (await db.execute(q)).scalars().unique().all()
