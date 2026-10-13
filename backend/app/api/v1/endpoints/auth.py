from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import enforce_csrf, get_client_ip, get_user_agent
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    get_current_user,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas import (
    LoginResponse,
    Message,
    Token,
    UserPasswordChange,
    UserResponse,
)
from app.services import auth_service
from app.services.audit import log_action
from app.services.auth_service import SessionExpiredError

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    user = await auth_service.authenticate(
        db, username=form_data.username, password=form_data.password, ip_address=ip
    )
    access, refresh, csrf = await auth_service.start_session(
        db, user, ip_address=ip, user_agent=get_user_agent(request)
    )
    auth_service.set_session_cookies(response, refresh, csrf)
    await log_action(db, user.id, "LOGIN", detail="Login berhasil", ip_address=ip)
    return LoginResponse(
        access_token=access,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
        csrf_token=csrf,
    )


@router.post("/refresh", response_model=Token)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    enforce_csrf(request)
    token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not token:
        raise SessionExpiredError("Sesi tidak ditemukan. Silakan login kembali.")
    _, access, new_refresh, csrf = await auth_service.rotate_session(
        db,
        refresh_token=token,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    auth_service.set_session_cookies(response, new_refresh, csrf)
    return Token(
        access_token=access,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", response_model=Message)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # SameSite=Strict on the refresh cookie prevents cross-site logout abuse.
    token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    user_id = None
    if token:
        from app.core.security import hash_refresh_token
        from app.models.refresh_token import RefreshToken
        from sqlalchemy import select

        row = (
            await db.execute(
                select(RefreshToken).where(
                    RefreshToken.token_hash == hash_refresh_token(token)
                )
            )
        ).scalar_one_or_none()
        if row:
            user_id = row.user_id
    await auth_service.revoke_refresh_token(db, token)
    auth_service.clear_session_cookies(response)
    if user_id:
        await log_action(
            db, user_id, "LOGOUT", detail="Logout", ip_address=get_client_ip(request)
        )
    return Message(message="Logout berhasil")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", response_model=Message)
async def change_password(
    request: Request,
    payload: UserPasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        from app.core.errors import ValidationError

        raise ValidationError("Password lama salah")
    current_user.hashed_password = hash_password(payload.new_password)
    # Force all existing sessions to re-authenticate.
    await auth_service.revoke_all_for_user(db, current_user.id)
    await log_action(
        db,
        current_user.id,
        "PASSWORD_CHANGED",
        "user",
        current_user.id,
        ip_address=get_client_ip(request),
    )
    return Message(message="Password berhasil diubah. Silakan login kembali.")
