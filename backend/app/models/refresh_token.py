from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class RefreshToken(Base):
    """Server-side refresh token store enabling rotation and revocation
    (requirement 21/22).

    Only the SHA-256 hash of the opaque token is persisted.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        Index("ix_refresh_user", "user_id"),
        Index("ix_refresh_expires", "expires_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash = Column(String(128), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    replaced_by_hash = Column(String(128), nullable=True)
    user_agent = Column(String(256), nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="refresh_tokens")

    @property
    def is_active(self) -> bool:
        from datetime import datetime, timezone

        return self.revoked_at is None and self.expires_at > datetime.now(
            timezone.utc
        ).replace(tzinfo=None)
