import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class BlacklistType(str, enum.Enum):
    PASSPORT = "passport"
    NAME = "name"
    BOTH = "both"


class Blacklist(Base):
    __tablename__ = "blacklists"
    __table_args__ = (
        Index("ix_blacklists_active_passport", "is_active", "passport_number"),
        Index("ix_blacklists_active_name", "is_active", "full_name"),
        Index("ix_blacklists_passport_norm", "passport_normalized"),
        Index("ix_blacklists_name_norm", "name_normalized"),
    )

    id = Column(Integer, primary_key=True, index=True)
    passport_number = Column(String(64), nullable=True, index=True)
    full_name = Column(String(128), nullable=True, index=True)
    nationality = Column(String(64), nullable=True)
    type = Column(Enum(BlacklistType), nullable=False, default=BlacklistType.PASSPORT)
    reason = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    # Normalised columns power fast, case/format-insensitive matching.
    passport_normalized = Column(String(64), nullable=True)
    name_normalized = Column(String(128), nullable=True)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    added_by_user = relationship("User", foreign_keys=[added_by])
