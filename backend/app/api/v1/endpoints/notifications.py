from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import stream_tickets
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.security import get_current_user, require_supervisor
from app.models.user import User, UserRole
from app.repositories import notification_repo
from app.schemas import Message, NotificationResponse, UnreadCount
from app.services.notifications import notification_manager

router = APIRouter()


@router.post("/stream-ticket")
async def issue_stream_ticket(current_user: User = Depends(require_supervisor)):
    if not settings.SSE_ENABLED:
        raise HTTPException(status_code=503, detail="Notifikasi realtime dinonaktifkan")
    return {"ticket": stream_tickets.issue_ticket(current_user.id)}


@router.get("/stream")
async def notification_stream(ticket: str):
    user_id = stream_tickets.consume_ticket(ticket)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tiket stream tidak valid atau sudah kedaluwarsa",
        )
    # Use a short-lived session: a request-scoped dependency would stay open for
    # the entire (potentially hours-long) SSE connection.
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
    if not user or not user.is_active or user.role not in (UserRole.SUPERVISOR, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    queue = notification_manager.subscribe(user.id)
    return StreamingResponse(
        notification_manager.event_generator(user.id, queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 100)
    rows = await notification_repo.list_for_user(db, current_user.id, limit=limit)
    return [NotificationResponse.model_validate(r) for r in rows]


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return UnreadCount(unread=await notification_repo.unread_count(db, current_user.id))


@router.post("/{notification_id}/read", response_model=Message)
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await notification_repo.mark_read(db, current_user.id, notification_id)
    return Message(message="Notifikasi ditandai sudah dibaca")


@router.post("/read-all", response_model=Message)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await notification_repo.mark_all_read(db, current_user.id)
    return Message(message="Semua notifikasi ditandai sudah dibaca")
