from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.counter import CounterStatus


class CounterCreate(BaseModel):
    name: str
    location: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_ok(cls, v: str) -> str:
        v = v.strip()
        if not (2 <= len(v) <= 64):
            raise ValueError("Nama konter harus 2-64 karakter")
        return v


class CounterUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    status: Optional[CounterStatus] = None


class CounterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location: Optional[str]
    status: CounterStatus
    created_at: datetime
    active_agent_name: Optional[str] = None
