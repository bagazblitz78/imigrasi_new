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
from app.models.escalation import Escalation, EscalationDecision
from app.models.passenger import Passenger, PassengerStatus
from app.models.user import User
from app.repositories import (
    counter_repo,
    escalation_repo,
    passenger_repo,
    user_repo,
    voa_repo,
)
from app.schemas import (
    EscalationCreate,
    EscalationDecide,
    EscalationResponse,
    Page,
    SupervisorDashboard,
    build_page,
)
from app.services.audit import log_action
from app.services.notifications import notification_manager

router = APIRouter()


@router.get("/dashboard/supervisor", response_model=SupervisorDashboard)
async def supervisor_dashboard(
    current_user: User = Depends(require_supervisor),
    db: AsyncSession = Depends(get_db),
):
    stats = await passenger_repo.stats_for_range(db)
    pending = await escalation_repo.count_pending(db)
    return SupervisorDashboard(
        pending_escalations=pending,
        urgent_escalations=pending,
        active_counters=await counter_repo.count_active(db),
        total_arrivals_today=stats["arrivals_today"],
        total_departures_today=stats["departures_today"],
        pending_voa=await voa_repo.count_pending(db),
        hold_today=stats["hold_today"],
        oldest_pending_escalation_minutes=await escalation_repo.oldest_pending_age_minutes(db),
    )


@router.get("/", response_model=Page[EscalationResponse])
async def list_escalations(
    decision: Optional[EscalationDecision] = None,
    params: PageParams = Depends(pagination_params),
    current_user: User = Depends(require_supervisor),
    db: AsyncSession = Depends(get_db),
):
    rows, total = await escalation_repo.list_escalations(
        db,
        decision=decision,
        page=params.page,
        page_size=params.page_size,
    )
    return build_page(
        [EscalationResponse.model_validate(r) for r in rows],
        total,
        params.page,
        params.page_size,
    )


@router.post("/", response_model=EscalationResponse, status_code=201)
async def create_escalation(
    payload: EscalationCreate,
    request: Request,
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    passenger = await db.get(Passenger, payload.passenger_id)
    if not passenger:
        raise NotFoundError("Penumpang tidak ditemukan")
    assert_can_modify_passenger(current_user, passenger)

    existing = await db.execute(
        select(Escalation).where(Escalation.passenger_id == passenger.id)
    )
    if existing.scalar_one_or_none():
        raise ConflictError("Penumpang sudah memiliki eskalasi")

    passenger.status = PassengerStatus.HOLD
    escalation = Escalation(
        passenger_id=passenger.id,
        agent_id=current_user.id,
        reason=payload.reason,
    )
    db.add(escalation)
    await db.flush()

    await log_action(
        db,
        current_user.id,
        "HOLD_PASSENGER",
        "escalation",
        escalation.id,
        detail=f"Alasan: {payload.reason or '-'}",
        ip_address=get_client_ip(request),
    )

    supervisors = await user_repo.supervisors_and_admins(db)
    await notification_manager.notify(
        db,
        [u.id for u in supervisors],
        type="ESCALATION_CREATED",
        title=f"Hold: {passenger.full_name}",
        message=payload.reason,
        severity="danger",
        payload={
            "escalation_id": escalation.id,
            "passenger_id": passenger.id,
            "passenger_name": passenger.full_name,
            "agent_name": current_user.full_name,
        },
        target_type="escalation",
        target_id=escalation.id,
    )
    await db.refresh(escalation)
    return EscalationResponse.model_validate(escalation)


@router.get("/{escalation_id}", response_model=EscalationResponse)
async def get_escalation(
    escalation_id: int,
    current_user: User = Depends(require_supervisor),
    db: AsyncSession = Depends(get_db),
):
    escalation = await db.get(Escalation, escalation_id)
    if not escalation:
        raise NotFoundError("Eskalasi tidak ditemukan")
    return EscalationResponse.model_validate(escalation)


@router.patch("/{escalation_id}/decide", response_model=EscalationResponse)
async def decide_escalation(
    escalation_id: int,
    payload: EscalationDecide,
    request: Request,
    current_user: User = Depends(require_supervisor),
    db: AsyncSession = Depends(get_db),
):
    escalation = await db.get(Escalation, escalation_id)
    if not escalation:
        raise NotFoundError("Eskalasi tidak ditemukan")
    if escalation.decision != EscalationDecision.PENDING:
        raise ConflictError("Eskalasi sudah diproses")

    escalation.decision = payload.decision
    escalation.decision_notes = payload.decision_notes
    escalation.supervisor_id = current_user.id
    escalation.resolved_at = datetime.now(timezone.utc)

    passenger = await db.get(Passenger, escalation.passenger_id)
    if passenger:
        mapping = {
            EscalationDecision.APPROVED: PassengerStatus.APPROVED,
            EscalationDecision.DEPORTED: PassengerStatus.DEPORTED,
            EscalationDecision.REJECTED: PassengerStatus.REJECTED,
        }
        passenger.status = mapping[payload.decision]
        passenger.processed_at = datetime.now(timezone.utc)

    await log_action(
        db,
        current_user.id,
        f"ESCALATION_{payload.decision.value.upper()}",
        "passenger",
        escalation.passenger_id,
        detail=f"Eskalasi #{escalation_id}: {payload.decision.value}",
        ip_address=get_client_ip(request),
    )

    if passenger:
        await notification_manager.notify(
            db,
            [escalation.agent_id],
            type="ESCALATION_DECIDED",
            title=f"Eskalasi diputuskan: {payload.decision.value}",
            message=f"{passenger.full_name} — {payload.decision.value}",
            severity="info",
            payload={"escalation_id": escalation.id, "passenger_id": passenger.id},
            target_type="escalation",
            target_id=escalation.id,
        )

    await db.refresh(escalation)
    return EscalationResponse.model_validate(escalation)
