from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip
from app.core.database import get_db
from app.core.errors import ConflictError, NotFoundError
from app.core.pagination import PageParams, pagination_params
from app.core.permissions import assert_can_modify_passenger, assert_can_view_passenger
from app.core.security import require_agent, require_supervisor
from app.models.passenger import Passenger
from app.models.user import User
from app.models.voa import VOA, VOAStatus
from app.repositories import voa_repo
from app.schemas import (
    Page,
    VOACreate,
    VOADecide,
    VOAResponse,
    build_page,
)
from app.services.audit import log_action
from app.services.notifications import notification_manager

router = APIRouter()


@router.get("/", response_model=Page[VOAResponse])
async def list_voa(
    status: Optional[VOAStatus] = None,
    params: PageParams = Depends(pagination_params),
    current_user: User = Depends(require_supervisor),
    db: AsyncSession = Depends(get_db),
):
    rows, total = await voa_repo.list_voa(
        db, status=status, page=params.page, page_size=params.page_size
    )
    return build_page(
        [VOAResponse.model_validate(r) for r in rows],
        total,
        params.page,
        params.page_size,
    )


@router.post("/", response_model=VOAResponse, status_code=201)
async def apply_voa(
    payload: VOACreate,
    request: Request,
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    passenger = await db.get(Passenger, payload.passenger_id)
    if not passenger:
        raise NotFoundError("Penumpang tidak ditemukan")
    assert_can_modify_passenger(current_user, passenger)

    existing = await db.execute(
        select(VOA).where(VOA.passenger_id == payload.passenger_id)
    )
    if existing.scalar_one_or_none():
        raise ConflictError("Penumpang sudah memiliki pengajuan VOA")

    voa = VOA(
        passenger_id=payload.passenger_id,
        duration_days=payload.duration_days,
        fee_paid=payload.fee_paid,
    )
    db.add(voa)
    await db.flush()
    await log_action(
        db,
        current_user.id,
        "APPLY_VOA",
        "voa",
        voa.id,
        detail=f"Durasi {payload.duration_days} hari",
        ip_address=get_client_ip(request),
    )
    await db.refresh(voa)
    return VOAResponse.model_validate(voa)


@router.get("/{voa_id}", response_model=VOAResponse)
async def get_voa(
    voa_id: int,
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    voa = await db.get(VOA, voa_id)
    if not voa:
        raise NotFoundError("Data VOA tidak ditemukan")
    if voa.passenger is not None:
        assert_can_view_passenger(current_user, voa.passenger)
    return VOAResponse.model_validate(voa)


@router.patch("/{voa_id}/decide", response_model=VOAResponse)
async def decide_voa(
    voa_id: int,
    payload: VOADecide,
    request: Request,
    current_user: User = Depends(require_supervisor),
    db: AsyncSession = Depends(get_db),
):
    voa = await db.get(VOA, voa_id)
    if not voa:
        raise NotFoundError("Data VOA tidak ditemukan")
    if voa.status != VOAStatus.PENDING:
        raise ConflictError("VOA sudah diproses")
    if payload.status == VOAStatus.PENDING:
        raise ConflictError("Status keputusan tidak valid")
    if payload.status == VOAStatus.REJECTED and not payload.rejection_reason:
        from app.core.errors import ValidationError

        raise ValidationError("Alasan penolakan wajib diisi")

    voa.status = payload.status
    voa.rejection_reason = payload.rejection_reason
    voa.supervisor_id = current_user.id
    voa.processed_at = datetime.now(timezone.utc)

    await log_action(
        db,
        current_user.id,
        f"VOA_{payload.status.value.upper()}",
        "voa",
        voa_id,
        ip_address=get_client_ip(request),
    )

    if voa.passenger and voa.passenger.agent_id:
        await notification_manager.notify(
            db,
            [voa.passenger.agent_id],
            type="VOA_DECIDED",
            title=f"VOA {payload.status.value}",
            message=voa.passenger.full_name,
            severity="info",
            payload={"voa_id": voa.id, "passenger_id": voa.passenger_id},
            target_type="voa",
            target_id=voa.id,
        )

    await db.refresh(voa)
    return VOAResponse.model_validate(voa)
