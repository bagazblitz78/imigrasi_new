from httpx import AsyncClient

from tests.conftest import auth_headers, login


async def test_agent_cannot_access_admin_endpoints(agent_client: AsyncClient):
    assert (await agent_client.get("/api/v1/users/")).status_code == 403
    assert (await agent_client.get("/api/v1/blacklist/")).status_code == 403
    assert (await agent_client.get("/api/v1/reports/audit-logs")).status_code == 403
    assert (await agent_client.get("/api/v1/reports/passengers/export-csv")).status_code == 403


async def test_agent_cannot_decide_escalation(client: AsyncClient, seeded):
    token, _ = await login(client, "agent1", "Agent123!")
    res = await client.patch(
        "/api/v1/escalations/1/decide",
        json={"decision": "approved"},
        headers=auth_headers(token),
    )
    assert res.status_code == 403


async def test_object_level_authorization_idor(client: AsyncClient, seeded):
    # agent1 creates a passenger
    token1, _ = await login(client, "agent1", "Agent123!")
    created = await client.post(
        "/api/v1/passengers/",
        json={
            "full_name": "Passenger One",
            "passport_number": "AA111111",
            "nationality": "Indonesia",
            "direction": "arrival",
        },
        headers=auth_headers(token1),
    )
    assert created.status_code == 201
    passenger_id = created.json()["id"]

    # agent2 must not be able to read or act on agent1's passenger
    token2, csrf2 = await login(client, "agent2", "Agent123!")
    assert (
        await client.get(f"/api/v1/passengers/{passenger_id}", headers=auth_headers(token2))
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v1/passengers/{passenger_id}/approve", headers=auth_headers(token2)
        )
    ).status_code == 404

    # agent1 can view their own
    assert (
        await client.get(f"/api/v1/passengers/{passenger_id}", headers=auth_headers(token1))
    ).status_code == 200


async def test_unauthenticated_rejected(client: AsyncClient):
    assert (await client.get("/api/v1/passengers/")).status_code == 401
