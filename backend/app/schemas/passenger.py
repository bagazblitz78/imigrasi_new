import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.passenger import PassengerStatus, TravelDirection

_PASSPORT_RE = re.compile(r"^[A-Z0-9]{3,20}$")


class PassengerCreate(BaseModel):
    full_name: str
    passport_number: str
    nationality: str
    visa_type: Optional[str] = None
    flight_number: Optional[str] = None
    direction: TravelDirection = TravelDirection.ARRIVAL
    notes: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def check_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not (2 <= len(v) <= 128):
            raise ValueError("Nama lengkap harus 2-128 karakter")
        return v

    @field_validator("passport_number")
    @classmethod
    def check_passport(cls, v: str) -> str:
        v = re.sub(r"[^A-Za-z0-9]", "", v).upper()
        if not _PASSPORT_RE.match(v):
            raise ValueError("Nomor paspor harus 3-20 karakter alfanumerik")
        return v

    @field_validator("nationality")
    @classmethod
    def check_nationality(cls, v: str) -> str:
        v = v.strip()
        if not (2 <= len(v) <= 64):
            raise ValueError("Kewarganegaraan harus 2-64 karakter")
        return v

    @field_validator("visa_type", "flight_number")
    @classmethod
    def check_optional_short(cls, v):
        if v is None:
            return v
        v = v.strip()
        return v[:64] if v else None

    @field_validator("notes")
    @classmethod
    def check_notes(cls, v):
        if v is None:
            return v
        if len(v) > 2000:
            raise ValueError("Catatan maksimal 2000 karakter")
        return v


class PassengerUpdate(BaseModel):
    full_name: Optional[str] = None
    nationality: Optional[str] = None
    visa_type: Optional[str] = None
    flight_number: Optional[str] = None
    notes: Optional[str] = None


class PassengerStatusUpdate(BaseModel):
    status: PassengerStatus
    notes: Optional[str] = None


class PassengerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    passport_number: str
    nationality: str
    visa_type: Optional[str]
    flight_number: Optional[str]
    direction: TravelDirection
    status: PassengerStatus
    blacklist_hit: Optional[str]
    notes: Optional[str]
    agent_id: Optional[int]
    agent_name: Optional[str] = None
    counter_id: Optional[int]
    counter_name: Optional[str] = None
    processed_at: Optional[datetime]
    created_at: datetime


class MRZScanResult(BaseModel):
    document_type: str = "passport"
    valid: bool
    errors: list[str] = []
    document_number: Optional[str] = None
    surname: Optional[str] = None
    given_names: Optional[str] = None
    nationality: Optional[str] = None
    birth_date: Optional[str] = None
    sex: Optional[str] = None
    expiry_date: Optional[str] = None
    raw_mrz: Optional[str] = None
