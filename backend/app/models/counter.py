import enum

from sqlalchemy import Column, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class CounterStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BREAK = "break"


class Counter(Base):
    __tablename__ = "counters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), nullable=False)
    location = Column(String(128), nullable=True)
    status = Column(Enum(CounterStatus), default=CounterStatus.INACTIVE, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    agents = relationship("User", back_populates="counter")
