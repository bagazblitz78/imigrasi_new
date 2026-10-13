"""Async SQLAlchemy engine, session factory and request-scoped session.

`get_db` commits once per successful request and rolls back on error, so a
passenger creation + blacklist result + audit log are written atomically
(requirement 51).
"""
from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=False,  # aiomysql 0.2.0 + SQLAlchemy 2.0.35 ping signature workaround
    pool_recycle=1800,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
