from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    blacklist,
    counters,
    escalations,
    notifications,
    passengers,
    reports,
    users,
    voa,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(passengers.router, prefix="/passengers", tags=["Passengers"])
api_router.include_router(blacklist.router, prefix="/blacklist", tags=["Blacklist"])
api_router.include_router(escalations.router, prefix="/escalations", tags=["Escalations"])
api_router.include_router(voa.router, prefix="/voa", tags=["VOA"])
api_router.include_router(counters.router, prefix="/counters", tags=["Counters"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["Notifications"]
)
