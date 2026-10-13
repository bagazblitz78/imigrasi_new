import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class VOAStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class VOA(Base):
    __tablename__ = "voa_applications"
    __table_args__ = (
        Index("ix_voa_status_applied", "status", "applied_at"),
        Index("ix_voa_applied", "applied_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(
        Integer, ForeignKey("passengers.id"), nullable=False, unique=True
    )
    supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    duration_days = Column(Integer, default=30)
    fee_paid = Column(Boolean, default=False)
    status = Column(Enum(VOAStatus), default=VOAStatus.PENDING, index=True)
    rejection_reason = Column(Text, nullable=True)
    applied_at = Column(DateTime, server_default=func.now())
    processed_at = Column(DateTime, nullable=True)

    passenger = relationship("Passenger", back_populates="voa", lazy="joined")
    supervisor = relationship("User", foreign_keys=[supervisor_id], lazy="joined")

    @property
    def passenger_name(self):
        return self.passenger.full_name if self.passenger is not None else None

    @property
    def passenger_passport(self):
        return self.passenger.passport_number if self.passenger is not None else None

    @property
    def passenger_nationality(self):
        return self.passenger.nationality if self.passenger is not None else None
