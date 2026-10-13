from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int]
    user_name: Optional[str] = None
    action: str
    target_type: Optional[str]
    target_id: Optional[int]
    detail: Optional[str]
    ip_address: Optional[str]
    request_id: Optional[str]
    created_at: datetime
