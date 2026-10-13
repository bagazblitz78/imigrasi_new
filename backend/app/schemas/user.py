from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.core.security import validate_password_strength
from app.models.user import UserRole


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: UserRole
    counter_id: Optional[int] = None


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.AGENT
    counter_id: Optional[int] = None

    @field_validator("username")
    @classmethod
    def username_ok(cls, v: str) -> str:
        v = v.strip()
        if not (3 <= len(v) <= 64):
            raise ValueError("Username harus 3-64 karakter")
        if not all(c.isalnum() or c in "._-" for c in v):
            raise ValueError("Username hanya boleh huruf, angka, titik, underscore, strip")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_ok(cls, v: str) -> str:
        v = v.strip()
        if not (2 <= len(v) <= 128):
            raise ValueError("Nama lengkap harus 2-128 karakter")
        return v

    @field_validator("password")
    @classmethod
    def password_ok(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    counter_id: Optional[int] = None

    @field_validator("full_name")
    @classmethod
    def full_name_ok(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not (2 <= len(v) <= 128):
            raise ValueError("Nama lengkap harus 2-128 karakter")
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    counter_id: Optional[int]
    created_at: datetime


class UserPasswordChange(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_ok(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class AdminPasswordReset(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_ok(cls, v: str) -> str:
        validate_password_strength(v)
        return v
