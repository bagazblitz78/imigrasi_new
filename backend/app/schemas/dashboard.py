from typing import List, Optional

from pydantic import BaseModel

from app.models.counter import CounterStatus
from app.schemas.passenger import PassengerResponse


class AgentDashboard(BaseModel):
    checked_today: int
    counter_status: Optional[CounterStatus]
    counter_name: Optional[str]
    last_10_passengers: List[PassengerResponse]


class SupervisorDashboard(BaseModel):
    pending_escalations: int
    urgent_escalations: int
    active_counters: int
    total_arrivals_today: int
    total_departures_today: int
    pending_voa: int
    hold_today: int
    oldest_pending_escalation_minutes: Optional[int] = None


class AdminDashboard(BaseModel):
    total_users: int
    active_users: int
    total_blacklist: int
    active_blacklist: int
    audit_events_today: int
    total_passengers_today: int


class PassengerStats(BaseModel):
    total_today: int
    arrivals_today: int
    departures_today: int
    hold_today: int
    approved_today: int
    pending_today: int
    deported_today: int
    rejected_today: int
    by_nationality: dict[str, int]
