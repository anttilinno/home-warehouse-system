"""End-to-end tests for locations CRUD against the real app."""

from uuid import uuid7

import pytest


@pytest.mark.asyncio
async def test_location_crud_flow(client):
    name = f"A1-{uuid7().hex}"
    create_resp = await client.post(
        "/locations/",
        json={"name": name, "zone": "A", "shelf": "1", "bin": "B", "description": "desc"},
    )
    assert create_resp.status_code == 201
    loc_id = create_resp.json()["id"]

    list_resp = await client.get("/locations/")
    assert list_resp.status_code == 200
    assert any(l["id"] == loc_id for l in list_resp.json())

    get_resp = await client.get(f"/locations/{loc_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == name

    update_resp = await client.patch(
        f"/locations/{loc_id}",
        json={"name": "A2", "zone": "B", "shelf": "2", "bin": "C", "description": "new"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "A2"
    assert update_resp.json()["zone"] == "B"
    assert update_resp.json()["shelf"] == "2"
    assert update_resp.json()["bin"] == "C"

    delete_resp = await client.delete(f"/locations/{loc_id}")
    assert delete_resp.status_code in (200, 204)
    missing_resp = await client.get(f"/locations/{loc_id}")
    assert missing_resp.status_code == 404

    # Negative: update missing
    missing_id = uuid7()
    not_found_resp = await client.patch(
        f"/locations/{missing_id}", json={"name": "missing", "description": "none"}
    )
    assert not_found_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_missing_location_returns_404(client):
    resp = await client.delete(f"/locations/{uuid7()}")
    assert resp.status_code == 404
