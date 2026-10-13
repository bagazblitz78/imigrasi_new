from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditLog(Base):
    """Append-oriented audit trail. Rows are never updated or deleted by the
    application (requirement 29)."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_user_created", "user_id", "created_at"),
        Index("ix_audit_action_created", "action", "created_at"),
        Index("ix_audit_created", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(128), nullable=False)
    target_type = Column(String(64), nullable=True)
    target_id = Column(Integer, nullable=True)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    request_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
