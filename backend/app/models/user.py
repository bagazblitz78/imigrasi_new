import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    AGENT = "agent"
    SUPERVISOR = "supervisor"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(128), unique=True, nullable=False, index=True)
    full_name = Column(String(128), nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.AGENT, index=True)
    is_active = Column(Boolean, default=True, index=True)
    counter_id = Column(Integer, ForeignKey("counters.id"), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    counter = relationship("Counter", back_populates="agents", lazy="selectin")
    passengers = relationship("Passenger", back_populates="agent")
    audit_logs = relationship("AuditLog", back_populates="user")
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
