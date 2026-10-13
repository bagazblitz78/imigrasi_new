import os

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("JWT_SECRET", "test-secret-key-that-is-long-enough-123456")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import Counter, CounterStatus, User, UserRole


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session_factory(engine):
    return async_sessionmaker(bind=engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def seeded(session_factory):
    async with session_factory() as db:
        c1 = Counter(name="Konter A-1", location="T2", status=CounterStatus.ACTIVE)
        c2 = Counter(name="Konter A-2", location="T2", status=CounterStatus.ACTIVE)
        db.add_all([c1, c2])
        await db.flush()

        users = {
            "admin": User(
                username="admin",
                email="admin@test.id",
                full_name="Admin Test",
                hashed_password=hash_password("Admin1234!"),
                role=UserRole.ADMIN,
            ),
            "supervisor": User(
                username="supervisor",
                email="spv@test.id",
                full_name="Supervisor Test",
                hashed_password=hash_password("Spv12345!"),
                role=UserRole.SUPERVISOR,
            ),
            "agent1": User(
                username="agent1",
                email="a1@test.id",
                full_name="Agent One",
                hashed_password=hash_password("Agent123!"),
                role=UserRole.AGENT,
                counter_id=c1.id,
            ),
            "agent2": User(
                username="agent2",
                email="a2@test.id",
                full_name="Agent Two",
                hashed_password=hash_password("Agent123!"),
                role=UserRole.AGENT,
                counter_id=c2.id,
            ),
        }
        db.add_all(users.values())
        await db.commit()
        return {k: v.id for k, v in users.items()}


@pytest_asyncio.fixture
async def client(session_factory):
    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def login(client: AsyncClient, username: str, password: str):
    res = await client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    return data["access_token"], res.cookies.get("imigrasi_csrf")


def auth_headers(token: str, csrf: str | None = None):
    headers = {"Authorization": f"Bearer {token}"}
    if csrf:
        headers["X-CSRF-Token"] = csrf
    return headers


@pytest_asyncio.fixture
async def admin_client(client, seeded):
    token, csrf = await login(client, "admin", "Admin1234!")
    client.headers.update(auth_headers(token, csrf))
    return client


@pytest_asyncio.fixture
async def agent_client(client, seeded):
    token, csrf = await login(client, "agent1", "Agent123!")
    client.headers.update(auth_headers(token, csrf))
    return client
