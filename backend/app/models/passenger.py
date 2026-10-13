import enum

from sqlalchemy import (
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


class PassengerStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    HOLD = "hold"
    DEPORTED = "deported"
    REJECTED = "rejected"


class TravelDirection(str, enum.Enum):
    ARRIVAL = "arrival"
    DEPARTURE = "departure"


class Passenger(Base):
    __tablename__ = "passengers"
    __table_args__ = (
        Index("ix_passengers_agent_created", "agent_id", "created_at"),
        Index("ix_passengers_status_created", "status", "created_at"),
        Index("ix_passengers_direction_created", "direction", "created_at"),
        Index("ix_passengers_counter_created", "counter_id", "created_at"),
        Index("ix_passengers_created", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(128), nullable=False, index=True)
    passport_number = Column(String(64), nullable=False, index=True)
    nationality = Column(String(64), nullable=False)
    visa_type = Column(String(64), nullable=True)
    flight_number = Column(String(32), nullable=True)
    direction = Column(
        Enum(TravelDirection), nullable=False, default=TravelDirection.ARRIVAL
    )
    status = Column(
        Enum(PassengerStatus), nullable=False, default=PassengerStatus.PENDING
    )
    blacklist_hit = Column(String(256), nullable=True)
    notes = Column(Text, nullable=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    counter_id = Column(Integer, ForeignKey("counters.id"), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    agent = relationship("User", back_populates="passengers", lazy="joined")
    counter = relationship(
        "Counter", foreign_keys=[counter_id], lazy="joined", viewonly=True
    )
    escalation = relationship(
        "Escalation", back_populates="passenger", uselist=False
    )
    voa = relationship("VOA", back_populates="passenger", uselist=False)

    @property
    def agent_name(self):
        return self.agent.full_name if self.agent is not None else None

    @property
    def counter_name(self):
        return self.counter.name if self.counter is not None else None
