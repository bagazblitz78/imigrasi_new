from pydantic import BaseModel

from app.schemas.user import UserSummary


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class LoginResponse(Token):
    user: UserSummary
    csrf_token: str


class SessionInfo(BaseModel):
    user: UserSummary
    expires_in: int
