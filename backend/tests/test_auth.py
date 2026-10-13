from httpx import AsyncClient

from tests.conftest import auth_headers, login


async def test_login_success_and_me(client: AsyncClient, seeded):
    token, csrf = await login(client, "admin", "Admin1234!")
    assert token
    assert csrf
    res = await client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json()["username"] == "admin"


async def test_login_failure_is_generic(client: AsyncClient, seeded):
    res = await client.post(
        "/api/v1/auth/login", data={"username": "admin", "password": "wrong"}
    )
    assert res.status_code == 401
    # Generic message: no username enumeration oracle.
    assert "salah" in res.json()["error"]["message"].lower()


async def test_login_rate_limit_locks_out(client: AsyncClient, seeded):
    for _ in range(5):
        await client.post(
            "/api/v1/auth/login", data={"username": "agent1", "password": "wrong"}
        )
    res = await client.post(
        "/api/v1/auth/login", data={"username": "agent1", "password": "Agent123!"}
    )
    assert res.status_code == 429
    assert "Retry-After" in res.headers


async def test_refresh_rotation_and_csrf(client: AsyncClient, seeded):
    token, csrf = await login(client, "supervisor", "Spv12345!")

    # Missing CSRF header -> rejected
    res = await client.post("/api/v1/auth/refresh")
    assert res.status_code == 403

    res = await client.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert res.status_code == 200
    new_token = res.json()["access_token"]
    assert new_token

    me = await client.get("/api/v1/auth/me", headers=auth_headers(new_token))
    assert me.status_code == 200


async def test_logout_clears_session(client: AsyncClient, seeded):
    token, csrf = await login(client, "agent1", "Agent123!")
    res = await client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert res.status_code == 200


async def test_weak_password_rejected(client: AsyncClient, seeded, admin_client):
    res = await admin_client.post(
        "/api/v1/users/",
        json={
            "username": "newuser",
            "email": "new@test.id",
            "full_name": "New User",
            "password": "weak",
            "role": "agent",
        },
    )
    assert res.status_code == 422
