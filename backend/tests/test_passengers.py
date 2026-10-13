import io

from httpx import AsyncClient
from PIL import Image

from tests.conftest import auth_headers, login


def _payload(**overrides):
    base = {
        "full_name": "Budi Santoso",
        "passport_number": "AB123456",
        "nationality": "Indonesia",
        "direction": "arrival",
    }
    base.update(overrides)
    return base


async def test_create_clear_passenger_is_pending(agent_client: AsyncClient):
    res = await agent_client.post("/api/v1/passengers/", json=_payload())
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending"
    assert body["blacklist_hit"] is None


async def test_blacklist_hit_creates_hold_and_escalation(
    client: AsyncClient, seeded, admin_client: AsyncClient
):
    # Admin adds a blacklist entry (normalized matching).
    bl = await admin_client.post(
        "/api/v1/blacklist/",
        json={
            "passport_number": "xx99 8877",
            "full_name": "Bad Actor",
            "type": "both",
            "reason": "Test cekal",
        },
    )
    assert bl.status_code == 201

    token, _ = await login(client, "agent1", "Agent123!")
    res = await client.post(
        "/api/v1/passengers/",
        json=_payload(full_name="Bad Actor", passport_number="XX998877"),
        headers=auth_headers(token),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "hold"
    assert body["blacklist_hit"]

    # An escalation must have been created automatically.
    sup_token, _ = await login(client, "supervisor", "Spv12345!")
    escalations = await client.get(
        "/api/v1/escalations/?decision=pending",
        headers=auth_headers(sup_token),
    )
    assert escalations.status_code == 200
    items = escalations.json()["items"]
    assert any(e["passenger_id"] == body["id"] for e in items)


async def test_agent_cannot_approve_blacklisted(client: AsyncClient, seeded, admin_client):
    await admin_client.post(
        "/api/v1/blacklist/",
        json={"passport_number": "ZZ000001", "type": "passport", "reason": "cek"},
    )
    token, _ = await login(client, "agent2", "Agent123!")
    created = await client.post(
        "/api/v1/passengers/",
        json=_payload(full_name="Someone", passport_number="ZZ000001"),
        headers=auth_headers(token),
    )
    pid = created.json()["id"]
    res = await client.post(f"/api/v1/passengers/{pid}/approve", headers=auth_headers(token))
    assert res.status_code == 422


async def test_supervisor_decision_updates_passenger(
    client: AsyncClient, seeded, agent_client: AsyncClient
):
    created = await agent_client.post(
        "/api/v1/passengers/", json=_payload(passport_number="QQ123123")
    )
    pid = created.json()["id"]
    escalation = await agent_client.post(
        "/api/v1/escalations/", json={"passenger_id": pid, "reason": "Perlu review"}
    )
    assert escalation.status_code == 201
    esc_id = escalation.json()["id"]

    sup_token, _ = await login(client, "supervisor", "Spv12345!")
    decided = await client.patch(
        f"/api/v1/escalations/{esc_id}/decide",
        json={"decision": "deported", "decision_notes": "Tidak memenuhi syarat"},
        headers=auth_headers(sup_token),
    )
    assert decided.status_code == 200
    detail = await client.get(f"/api/v1/passengers/{pid}", headers=auth_headers(sup_token))
    assert detail.json()["status"] == "deported"


async def test_mrz_rejects_non_image(agent_client: AsyncClient):
    res = await agent_client.post(
        "/api/v1/passengers/scan-mrz",
        files={"file": ("evil.jpg", io.BytesIO(b"not an image"), "image/jpeg")},
    )
    assert res.status_code == 422


async def test_mrz_rejects_wrong_content_type(agent_client: AsyncClient):
    buf = io.BytesIO()
    Image.new("RGB", (30, 30), "white").save(buf, format="PNG")
    res = await agent_client.post(
        "/api/v1/passengers/scan-mrz",
        files={"file": ("x.png", io.BytesIO(buf.getvalue()), "application/pdf")},
    )
    assert res.status_code == 422


async def test_pagination_page_size_capped(agent_client: AsyncClient):
    res = await agent_client.get("/api/v1/passengers/?page_size=9999")
    assert res.status_code == 422
