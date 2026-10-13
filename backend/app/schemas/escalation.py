from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.escalation import EscalationDecision


class EscalationCreate(BaseModel):
    passenger_id: int
    reason: Optional[str] = None

    @field_validator("reason")
    @classmethod
    def reason_len(cls, v):
        if v is None:
            return v
        if len(v) > 2000:
            raise ValueError("Alasan maksimal 2000 karakter")
        return v


class EscalationDecide(BaseModel):
    decision: EscalationDecision
    decision_notes: Optional[str] = None


class EscalationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    passenger_id: int
    passenger_name: Optional[str] = None
    passenger_passport: Optional[str] = None
    passenger_nationality: Optional[str] = None
    passenger_direction: Optional[str] = None
    agent_id: int
    agent_name: Optional[str] = None
    supervisor_id: Optional[int]
    reason: Optional[str]
    decision: EscalationDecision
    decision_notes: Optional[str]
    notified: bool
    created_at: datetime
    resolved_at: Optional[datetime]
