from sqlalchemy import Column, DateTime, Index, Integer, String, func

from app.core.database import Base


class LoginAttempt(Base):
    """Failed login attempts, shared across workers for distributed rate
    limiting (requirement 24)."""

    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_ip_created", "ip_address", "created_at"),
        Index("ix_login_user_created", "username", "created_at"),
        Index("ix_login_created", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(45), nullable=False)
    username = Column(String(64), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
