from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Notification(Base):
    """Persisted notifications so the bell shows history + unread state
    (requirement 18) while SSE still delivers them in real time."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(64), nullable=False)
    title = Column(String(160), nullable=False)
    message = Column(Text, nullable=True)
    severity = Column(String(16), nullable=False, default="info")
    payload = Column(Text, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    target_type = Column(String(64), nullable=True)
    target_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
