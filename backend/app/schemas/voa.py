from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.voa import VOAStatus


class VOACreate(BaseModel):
    passenger_id: int
    duration_days: int = 30
    fee_paid: bool = False

    @field_validator("duration_days")
    @classmethod
    def duration_range(cls, v: int) -> int:
        if not (1 <= v <= 365):
            raise ValueError("Durasi VOA harus 1-365 hari")
        return v


class VOADecide(BaseModel):
    status: VOAStatus
    rejection_reason: Optional[str] = None


class VOAResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    passenger_id: int
    passenger_name: Optional[str] = None
    passenger_passport: Optional[str] = None
    passenger_nationality: Optional[str] = None
    supervisor_id: Optional[int]
    duration_days: int
    fee_paid: bool
    status: VOAStatus
    rejection_reason: Optional[str]
    applied_at: datetime
    processed_at: Optional[datetime]
