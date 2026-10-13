from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip
from app.core.database import get_db
from app.core.errors import ForbiddenError, NotFoundError
from app.core.security import get_current_user, require_admin
from app.models.counter import Counter
from app.models.user import User, UserRole
from app.repositories import counter_repo
from app.schemas import (
    CounterCreate,
    CounterResponse,
    CounterUpdate,
)
from app.services.audit import log_action

router = APIRouter()


def _to_response(counter: Counter) -> CounterResponse:
    active_agents = [a for a in getattr(counter, "agents", []) if a.is_active]
    return CounterResponse(
        id=counter.id,
        name=counter.name,
        location=counter.location,
        status=counter.status,
        created_at=counter.created_at,
        active_agent_name=", ".join(a.full_name for a in active_agents) or None,
    )


@router.get("/", response_model=list[CounterResponse])
async def list_counters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    counters = await counter_repo.list_counters(db)
    return [_to_response(c) for c in counters]


@router.post("/", response_model=CounterResponse, status_code=201)
async def create_counter(
    payload: CounterCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    counter = Counter(name=payload.name, location=payload.location)
    db.add(counter)
    await db.flush()
    await log_action(
        db,
        current_user.id,
        "CREATE_COUNTER",
        "counter",
        counter.id,
        ip_address=get_client_ip(request),
    )
    await db.refresh(counter)
    return _to_response(counter)


@router.patch("/{counter_id}", response_model=CounterResponse)
async def update_counter(
    counter_id: int,
    payload: CounterUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    counter = await db.get(Counter, counter_id)
    if not counter:
        raise NotFoundError("Konter tidak ditemukan")

    if current_user.role == UserRole.AGENT:
        if current_user.counter_id != counter_id:
            raise ForbiddenError("Hanya dapat mengubah konter sendiri")
        # Agents may only change the operational status.
        if payload.status is not None:
            counter.status = payload.status
    else:
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(counter, field, value)

    await log_action(
        db,
        current_user.id,
        "UPDATE_COUNTER",
        "counter",
        counter_id,
        ip_address=get_client_ip(request),
    )
    await db.refresh(counter)
    return _to_response(counter)
