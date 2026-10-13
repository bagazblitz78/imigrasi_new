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


class EscalationDecision(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DEPORTED = "deported"
    REJECTED = "rejected"


class Escalation(Base):
    __tablename__ = "escalations"
    __table_args__ = (
        Index("ix_escalations_decision_created", "decision", "created_at"),
        Index("ix_escalations_created", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(
        Integer, ForeignKey("passengers.id"), nullable=False, unique=True
    )
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)
    decision = Column(
        Enum(EscalationDecision), default=EscalationDecision.PENDING, index=True
    )
    decision_notes = Column(Text, nullable=True)
    notified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime, nullable=True)

    passenger = relationship("Passenger", back_populates="escalation", lazy="joined")
    agent = relationship("User", foreign_keys=[agent_id], lazy="joined")
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

    @property
    def passenger_direction(self):
        return self.passenger.direction.value if self.passenger is not None else None

    @property
    def agent_name(self):
        return self.agent.full_name if self.agent is not None else None
