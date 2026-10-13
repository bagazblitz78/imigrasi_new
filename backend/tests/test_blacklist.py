from httpx import AsyncClient

from app.utils.normalize import normalize_name, normalize_passport


def test_normalization_helpers():
    assert normalize_passport("ab-12 345") == "AB12345"
    assert normalize_name("  john   doe ") == "JOHN DOE"


async def test_blacklist_normalized_matching(admin_client: AsyncClient):
    created = await admin_client.post(
        "/api/v1/blacklist/",
        json={"passport_number": "a1 b2-c3", "type": "passport", "reason": "test"},
    )
    assert created.status_code == 201
    listing = await admin_client.get("/api/v1/blacklist/?search=A1B2C3")
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1


async def test_blacklist_requires_identifier(admin_client: AsyncClient):
    res = await admin_client.post("/api/v1/blacklist/", json={"type": "both"})
    assert res.status_code == 422
