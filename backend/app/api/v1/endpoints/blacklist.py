from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip
from app.core.database import get_db
from app.core.errors import NotFoundError, ValidationError
from app.core.pagination import PageParams, pagination_params
from app.core.security import require_admin
from app.models.blacklist import Blacklist
from app.models.user import User
from app.repositories import blacklist_repo
from app.schemas import (
    BlacklistCreate,
    BlacklistResponse,
    BlacklistUpdate,
    Message,
    Page,
    build_page,
)
from app.services.audit import log_action
from app.utils.normalize import normalize_name, normalize_passport

router = APIRouter()


@router.get("/", response_model=Page[BlacklistResponse])
async def list_blacklist(
    search: Optional[str] = Query(None, max_length=128),
    is_active: Optional[bool] = True,
    params: PageParams = Depends(pagination_params),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows, total = await blacklist_repo.list_blacklist(
        db,
        search=search,
        is_active=is_active,
        page=params.page,
        page_size=params.page_size,
        sort=params.sort,
        order=params.order,
    )
    return build_page(
        [BlacklistResponse.model_validate(r) for r in rows],
        total,
        params.page,
        params.page_size,
    )


@router.post("/", response_model=BlacklistResponse, status_code=201)
async def add_blacklist(
    payload: BlacklistCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not payload.passport_number and not payload.full_name:
        raise ValidationError("Isi minimal nomor paspor atau nama lengkap")

    entry = Blacklist(
        passport_number=payload.passport_number,
        full_name=payload.full_name,
        nationality=payload.nationality,
        type=payload.type,
        reason=payload.reason,
        added_by=current_user.id,
        passport_normalized=normalize_passport(payload.passport_number),
        name_normalized=normalize_name(payload.full_name),
    )
    db.add(entry)
    await db.flush()
    await log_action(
        db,
        current_user.id,
        "ADD_BLACKLIST",
        "blacklist",
        entry.id,
        detail="Entri daftar cekal ditambahkan",
        ip_address=get_client_ip(request),
    )
    return BlacklistResponse.model_validate(entry)


@router.patch("/{blacklist_id}", response_model=BlacklistResponse)
async def update_blacklist(
    blacklist_id: int,
    payload: BlacklistUpdate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    entry = await db.get(Blacklist, blacklist_id)
    if not entry:
        raise NotFoundError("Data blacklist tidak ditemukan")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await log_action(
        db,
        current_user.id,
        "UPDATE_BLACKLIST",
        "blacklist",
        blacklist_id,
        ip_address=get_client_ip(request),
    )
    return BlacklistResponse.model_validate(entry)


@router.delete("/{blacklist_id}", response_model=Message)
async def remove_blacklist(
    blacklist_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    entry = await db.get(Blacklist, blacklist_id)
    if not entry:
        raise NotFoundError("Data blacklist tidak ditemukan")
    entry.is_active = False
    await log_action(
        db,
        current_user.id,
        "REMOVE_BLACKLIST",
        "blacklist",
        blacklist_id,
        ip_address=get_client_ip(request),
    )
    return Message(message="Data blacklist dinonaktifkan")
