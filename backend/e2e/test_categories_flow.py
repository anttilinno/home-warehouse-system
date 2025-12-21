"""End-to-end tests for categories against the real app."""

from uuid import uuid7

import pytest


@pytest.mark.asyncio
async def test_category_create_list_and_delete(client):
    suffix = uuid7().hex
    create_resp = await client.post(
        "/categories/",
        json={"name": f"Category-{suffix}", "description": "desc"},
    )
    assert create_resp.status_code == 201
    cat_id = create_resp.json()["id"]

    list_resp = await client.get("/categories/")
    assert list_resp.status_code == 200
    assert any(c["id"] == cat_id for c in list_resp.json())

    delete_resp = await client.delete(f"/categories/{cat_id}")
    assert delete_resp.status_code in (200, 204)

    # Verify deleted
    list_resp_after = await client.get("/categories/")
    assert list_resp_after.status_code == 200
    assert all(c["id"] != cat_id for c in list_resp_after.json())


@pytest.mark.asyncio
async def test_delete_missing_category_returns_404(client):
    resp = await client.delete(f"/categories/{uuid7()}")
    assert resp.status_code == 404
