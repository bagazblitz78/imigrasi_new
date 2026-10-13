from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip
from app.core.database import get_db
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.pagination import PageParams, pagination_params
from app.core.permissions import (
    assert_can_modify_passenger,
    assert_can_view_passenger,
)
from app.core.security import require_agent
from app.models.audit import AuditLog
from app.models.escalation import Escalation
from app.models.passenger import Passenger, PassengerStatus, TravelDirection
from app.models.user import User, UserRole
from app.repositories import passenger_repo, user_repo
from app.schemas import (
    AgentDashboard,
    MRZScanResult,
    Page,
    PassengerCreate,
    PassengerResponse,
    PassengerStatusUpdate,
    build_page,
)
from app.services.audit import log_action
from app.services.blacklist_check import check_blacklist
from app.services.image_validation import validate_image
from app.services.mrz_scanner import MRZNotFoundError, scan_passport_mrz
from app.services.notifications import notification_manager
from app.utils.masking import mask_passport

router = APIRouter()


@router.get("/dashboard/agent", response_model=AgentDashboard)
async def agent_dashboard(
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    checked_today = await passenger_repo.agent_today_count(db, current_user.id)
    recent = await passenger_repo.agent_recent(db, current_user.id, limit=10)
    counter_status = current_user.counter.status if current_user.counter else None
    counter_name = current_user.counter.name if current_user.counter else None
    return AgentDashboard(
        checked_today=checked_today,
        counter_status=counter_status,
        counter_name=counter_name,
        last_10_passengers=[PassengerResponse.model_validate(p) for p in recent],
    )


@router.get("/", response_model=Page[PassengerResponse])
async def list_passengers(
    status: Optional[PassengerStatus] = None,
    direction: Optional[TravelDirection] = None,
    search: Optional[str] = Query(None, max_length=128),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    params: PageParams = Depends(pagination_params),
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    rows, total = await passenger_repo.list_passengers(
        db,
        viewer=current_user,
        status=status,
        direction=direction,
        search=search,
        date_from=date_from,
        date_to=date_to,
        page=params.page,
        page_size=params.page_size,
        sort=params.sort,
        order=params.order,
    )
    return build_page(
        [PassengerResponse.model_validate(r) for r in rows],
        total,
        params.page,
        params.page_size,
    )


@router.post("/", response_model=PassengerResponse, status_code=201)
async def create_passenger(
    payload: PassengerCreate,
    request: Request,
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    hit = await check_blacklist(db, payload.passport_number, payload.full_name)

    passenger = Passenger(
        full_name=payload.full_name,
        passport_number=payload.passport_number,
        nationality=payload.nationality,
        visa_type=payload.visa_type,
        flight_number=payload.flight_number,
        direction=payload.direction,
        notes=payload.notes,
        agent_id=current_user.id,
        counter_id=current_user.counter_id,
        blacklist_hit=hit.reason if hit else None,
        status=PassengerStatus.HOLD if hit else PassengerStatus.PENDING,
    )
    passenger.agent = current_user
    db.add(passenger)
    await db.flush()

    if hit:
        # A blacklist hit always becomes an escalation requiring supervisor review
        # (requirement 6) instead of silently leaving the passenger on HOLD.
        escalation = Escalation(
            passenger_id=passenger.id,
            agent_id=current_user.id,
            reason=hit.reason,
        )
        db.add(escalation)
        await db.flush()

        supervisors = await user_repo.supervisors_and_admins(db)
        await notification_manager.notify(
            db,
            [u.id for u in supervisors],
            type="ESCALATION_CREATED",
            title=f"Blacklist hit: {passenger.full_name}",
            message=hit.reason,
            severity="danger",
            payload={
                "escalation_id": escalation.id,
                "passenger_id": passenger.id,
                "passenger_name": passenger.full_name,
                "agent_name": current_user.full_name,
                "match_type": hit.match_type,
            },
            target_type="escalation",
            target_id=escalation.id,
        )

    await log_action(
        db,
        current_user.id,
        "SCAN_PASSPORT",
        "passenger",
        passenger.id,
        detail=f"Paspor: {mask_passport(payload.passport_number)} | BL: {'HIT' if hit else 'CLEAR'}",
        ip_address=get_client_ip(request),
    )
    await db.refresh(passenger)
    return PassengerResponse.model_validate(passenger)


@router.post("/scan-mrz", response_model=MRZScanResult)
async def scan_passport(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    """Extract MRZ from an uploaded passport photo. The image is processed
    locally and never sent to a third party."""
    data = await file.read()
    image = validate_image(file.content_type, data)
    try:
        result = await scan_passport_mrz(image)
    except MRZNotFoundError as exc:
        raise ValidationError(str(exc))
    await log_action(
        db,
        current_user.id,
        "SCAN_MRZ",
        "mrz",
        detail="MRZ berhasil diproses",
        ip_address=get_client_ip(request),
    )
    return MRZScanResult(**result)


@router.get("/{passenger_id}", response_model=PassengerResponse)
async def get_passenger(
    passenger_id: int,
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    passenger = await db.get(Passenger, passenger_id)
    if not passenger:
        raise NotFoundError("Data penumpang tidak ditemukan")
    assert_can_view_passenger(current_user, passenger)
    return PassengerResponse.model_validate(passenger)


@router.get("/{passenger_id}/history")
async def passenger_history(
    passenger_id: int,
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    passenger = await db.get(Passenger, passenger_id)
    if not passenger:
        raise NotFoundError("Data penumpang tidak ditemukan")
    assert_can_view_passenger(current_user, passenger)
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.target_type == "passenger", AuditLog.target_id == passenger_id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "action": r.action,
            "detail": r.detail,
            "user_id": r.user_id,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.patch("/{passenger_id}/status", response_model=PassengerResponse)
async def update_passenger_status(
    passenger_id: int,
    payload: PassengerStatusUpdate,
    request: Request,
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    passenger = await db.get(Passenger, passenger_id)
    if not passenger:
        raise NotFoundError("Data penumpang tidak ditemukan")
    assert_can_modify_passenger(current_user, passenger)

    if (
        payload.status
        in (PassengerStatus.APPROVED, PassengerStatus.DEPORTED, PassengerStatus.REJECTED)
        and current_user.role == UserRole.AGENT
    ):
        raise ForbiddenError("Hanya Supervisor yang dapat approve/deportasi/tolak")

    passenger.status = payload.status
    if payload.notes is not None:
        passenger.notes = payload.notes
    passenger.processed_at = datetime.now(timezone.utc)

    await log_action(
        db,
        current_user.id,
        f"UPDATE_STATUS_{payload.status.value.upper()}",
        "passenger",
        passenger_id,
        ip_address=get_client_ip(request),
    )
    return PassengerResponse.model_validate(passenger)


@router.post("/{passenger_id}/approve", response_model=PassengerResponse)
async def approve_passenger(
    passenger_id: int,
    request: Request,
    current_user: User = Depends(require_agent),
    db: AsyncSession = Depends(get_db),
):
    passenger = await db.get(Passenger, passenger_id)
    if not passenger:
        raise NotFoundError("Data penumpang tidak ditemukan")
    assert_can_modify_passenger(current_user, passenger)
    if passenger.blacklist_hit:
        raise ValidationError(
            "Penumpang terdeteksi blacklist. Gunakan alur eskalasi ke Supervisor."
        )
    if passenger.status == PassengerStatus.APPROVED:
        return PassengerResponse.model_validate(passenger)

    passenger.status = PassengerStatus.APPROVED
    passenger.processed_at = datetime.now(timezone.utc)
    await log_action(
        db,
        current_user.id,
        "APPROVE_PASSENGER",
        "passenger",
        passenger_id,
        detail=f"Paspor: {mask_passport(passenger.passport_number)}",
        ip_address=get_client_ip(request),
    )
    return PassengerResponse.model_validate(passenger)
