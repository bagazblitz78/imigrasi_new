from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    message: Optional[str]
    severity: str
    is_read: bool
    target_type: Optional[str]
    target_id: Optional[int]
    created_at: datetime


class UnreadCount(BaseModel):
    unread: int
