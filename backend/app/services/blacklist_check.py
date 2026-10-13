"""Blacklist matching on the passenger-creation critical path.

Uses normalised, indexed columns so matching is O(log n) instead of a full table
scan, and is case/format insensitive (requirement 37). No expensive fuzzy
matching is performed on the request path.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy import and_, or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blacklist import Blacklist
from app.utils.normalize import normalize_name, normalize_passport


@dataclass(slots=True)
class BlacklistHit:
    entry_id: int
    reason: str
    match_type: str  # passport | name


async def check_blacklist(
    db: AsyncSession,
    passport_number: Optional[str],
    full_name: Optional[str],
) -> Optional[BlacklistHit]:
    passport_norm = normalize_passport(passport_number)
    name_norm = normalize_name(full_name)

    conditions = []
    if passport_norm:
        conditions.append(
            or_(
                Blacklist.passport_normalized == passport_norm,
                func.upper(Blacklist.passport_number) == passport_norm,
            )
        )
    if name_norm:
        conditions.append(
            or_(
                Blacklist.name_normalized == name_norm,
                func.upper(Blacklist.full_name) == name_norm,
            )
        )
    if not conditions:
        return None

    result = await db.execute(
        select(Blacklist)
        .where(and_(Blacklist.is_active == True, or_(*conditions)))  # noqa: E712
        .order_by(Blacklist.id.asc())
        .limit(1)
    )
    hit = result.scalar_one_or_none()
    if not hit:
        return None

    if passport_norm and (
        hit.passport_normalized == passport_norm
        or (hit.passport_number or "").upper() == passport_norm
    ):
        match_type = "passport"
    else:
        match_type = "name"

    return BlacklistHit(
        entry_id=hit.id,
        reason=hit.reason or f"Masuk daftar cekal ({hit.type.value})",
        match_type=match_type,
    )
