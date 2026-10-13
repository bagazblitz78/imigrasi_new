from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.blacklist import BlacklistType


class BlacklistCreate(BaseModel):
    passport_number: Optional[str] = None
    full_name: Optional[str] = None
    nationality: Optional[str] = None
    type: BlacklistType = BlacklistType.PASSPORT
    reason: Optional[str] = None

    @field_validator("passport_number")
    @classmethod
    def clean_passport(cls, v):
        if v is None:
            return v
        v = "".join(ch for ch in v if ch.isalnum()).upper()
        return v or None

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v):
        if v is None:
            return v
        v = " ".join(v.split())
        return v or None


class BlacklistUpdate(BaseModel):
    reason: Optional[str] = None
    nationality: Optional[str] = None
    is_active: Optional[bool] = None


class BlacklistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    passport_number: Optional[str]
    full_name: Optional[str]
    nationality: Optional[str]
    type: BlacklistType
    reason: Optional[str]
    is_active: bool
    added_by: Optional[int]
    created_at: datetime
