import csv
import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.pagination import PageParams, pagination_params
from app.core.security import require_admin, require_supervisor
from app.models.user import User
from app.repositories import (
    audit_repo,
    blacklist_repo,
    passenger_repo,
    user_repo,
)
from app.schemas import (
    AdminDashboard,
    AuditLogResponse,
    Page,
    PassengerStats,
    build_page,
)
from app.utils.masking import mask_passport

router = APIRouter()


@router.get("/audit-logs", response_model=Page[AuditLogResponse])
async def get_audit_logs(
    user_id: Optional[int] = None,
    action: Optional[str] = Query(None, max_length=128),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    params: PageParams = Depends(pagination_params),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows, total = await audit_repo.list_audit_logs(
        db,
        user_id=user_id,
        action=action,
        date_from=date_from,
        date_to=date_to,
        page=params.page,
        page_size=params.page_size,
    )
    items = []
    for row in rows:
        item = AuditLogResponse.model_validate(row)
        item.user_name = row.user.full_name if row.user else None
        items.append(item)
    return build_page(items, total, params.page, params.page_size)


@router.get("/passengers/stats", response_model=PassengerStats)
async def passenger_stats(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(require_supervisor),
    db: AsyncSession = Depends(get_db),
):
    stats = await passenger_repo.stats_for_range(db, start=start_date, end=end_date)
    return PassengerStats(**stats)


@router.get("/dashboard/admin", response_model=AdminDashboard)
async def admin_dashboard(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users, total_users = await user_repo.list_users(db, page=1, page_size=1)
    _, active_users = await user_repo.list_users(db, is_active=True, page=1, page_size=1)
    stats = await passenger_repo.stats_for_range(db)
    return AdminDashboard(
        total_users=total_users,
        active_users=active_users,
        total_blacklist=await blacklist_repo.count_all(db),
        active_blacklist=await blacklist_repo.count_active(db),
        audit_events_today=await audit_repo.count_today(db),
        total_passengers_today=stats["total_today"],
    )


@router.get("/passengers/export-csv")
async def export_passengers_csv(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    direction: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = await passenger_repo.export_rows(
        db, start=start_date, end=end_date, direction=direction
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Nama Lengkap",
            "No Paspor",
            "Kebangsaan",
            "Jenis Visa",
            "No Penerbangan",
            "Arah",
            "Status",
            "Blacklist Hit",
            "Petugas",
            "Waktu Proses",
            "Dibuat",
        ]
    )
    for p in rows:
        writer.writerow(
            [
                p.id,
                p.full_name,
                mask_passport(p.passport_number),
                p.nationality,
                p.visa_type or "",
                p.flight_number or "",
                p.direction.value,
                p.status.value,
                "YA" if p.blacklist_hit else "TIDAK",
                p.agent_name or "",
                p.processed_at.isoformat() if p.processed_at else "",
                p.created_at.isoformat(),
            ]
        )

    payload = "\ufeff" + output.getvalue()  # BOM for Excel compatibility
    filename = f"imigrasi_laporan_{date.today()}.csv"
    return StreamingResponse(
        iter([payload]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
