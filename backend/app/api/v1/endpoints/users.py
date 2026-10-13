from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip
from app.core.database import get_db
from app.core.errors import ConflictError, NotFoundError
from app.core.pagination import PageParams, pagination_params
from app.core.security import hash_password, require_admin
from app.models.user import User, UserRole
from app.repositories import user_repo
from app.schemas import (
    AdminPasswordReset,
    Message,
    Page,
    UserCreate,
    UserResponse,
    UserUpdate,
    build_page,
)
from app.services import auth_service
from app.services.audit import log_action

router = APIRouter()


@router.get("/", response_model=Page[UserResponse])
async def list_users(
    search: Optional[str] = Query(None, max_length=128),
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    params: PageParams = Depends(pagination_params),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows, total = await user_repo.list_users(
        db,
        search=search,
        role=role,
        is_active=is_active,
        page=params.page,
        page_size=params.page_size,
        sort=params.sort,
        order=params.order,
    )
    return build_page(
        [UserResponse.model_validate(r) for r in rows],
        total,
        params.page,
        params.page_size,
    )


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if await user_repo.get_by_username(db, payload.username):
        raise ConflictError("Username sudah digunakan")
    if await user_repo.get_by_email(db, payload.email):
        raise ConflictError("Email sudah digunakan")

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        counter_id=payload.counter_id,
    )
    db.add(user)
    await db.flush()
    await log_action(
        db,
        current_user.id,
        "CREATE_USER",
        "user",
        user.id,
        detail=f"Buat akun {payload.username} [{payload.role.value}]",
        ip_address=get_client_ip(request),
    )
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User tidak ditemukan")
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)
    if "role" in data and data["role"] is not None:
        # Prevent an admin from accidentally locking themselves out.
        if user.id == current_user.id and data["role"] != UserRole.ADMIN:
            from app.core.errors import ValidationError

            raise ValidationError("Tidak dapat menurunkan role akun sendiri")
    if "is_active" in data and user.id == current_user.id and data["is_active"] is False:
        from app.core.errors import ValidationError

        raise ValidationError("Tidak dapat menonaktifkan akun sendiri")

    for field, value in data.items():
        setattr(user, field, value)

    if data.get("is_active") is False:
        await auth_service.revoke_all_for_user(db, user.id)

    await log_action(
        db,
        current_user.id,
        "UPDATE_USER",
        "user",
        user_id,
        detail=", ".join(sorted(data.keys())),
        ip_address=get_client_ip(request),
    )
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", response_model=Message)
async def deactivate_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User tidak ditemukan")
    if user.id == current_user.id:
        from app.core.errors import ValidationError

        raise ValidationError("Tidak dapat menonaktifkan akun sendiri")
    user.is_active = False
    await auth_service.revoke_all_for_user(db, user.id)
    await log_action(
        db,
        current_user.id,
        "DEACTIVATE_USER",
        "user",
        user_id,
        ip_address=get_client_ip(request),
    )
    return Message(message=f"Akun {user.username} dinonaktifkan")


@router.post("/{user_id}/reset-password", response_model=Message)
async def admin_reset_password(
    user_id: int,
    payload: AdminPasswordReset,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise NotFoundError("User tidak ditemukan")
    user.hashed_password = hash_password(payload.new_password)
    await auth_service.revoke_all_for_user(db, user.id)
    await log_action(
        db,
        current_user.id,
        "ADMIN_RESET_PASSWORD",
        "user",
        user_id,
        detail=f"Reset password untuk {user.username}",
        ip_address=get_client_ip(request),
    )
    return Message(message=f"Password {user.username} berhasil direset")
