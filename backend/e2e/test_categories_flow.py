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


@pytest.mark.asyncio
async def test_category_hierarchy_flow(client):
    """Test creating categories with parent-child relationships."""
    # Create parent category
    parent_name = f"Parent-{uuid7().hex[:8]}"
    parent_resp = await client.post(
        "/categories/",
        json={"name": parent_name, "description": "Parent category"},
    )
    assert parent_resp.status_code == 201
    parent = parent_resp.json()

    # Create child category
    child_name = f"Child-{uuid7().hex[:8]}"
    child_resp = await client.post(
        "/categories/",
        json={
            "name": child_name,
            "parent_category_id": parent["id"],
            "description": "Child category",
        },
    )
    assert child_resp.status_code == 201
    child = child_resp.json()
    assert child["parent_category_id"] == parent["id"]

    # Create grandchild category
    grandchild_name = f"Grandchild-{uuid7().hex[:8]}"
    grandchild_resp = await client.post(
        "/categories/",
        json={
            "name": grandchild_name,
            "parent_category_id": child["id"],
            "description": "Grandchild category",
        },
    )
    assert grandchild_resp.status_code == 201
    grandchild = grandchild_resp.json()
    assert grandchild["parent_category_id"] == child["id"]

    # List categories and verify hierarchy
    list_resp = await client.get("/categories/")
    assert list_resp.status_code == 200
    categories = list_resp.json()

    parent_in_list = next((c for c in categories if c["id"] == parent["id"]), None)
    child_in_list = next((c for c in categories if c["id"] == child["id"]), None)
    grandchild_in_list = next((c for c in categories if c["id"] == grandchild["id"]), None)

    assert parent_in_list is not None
    assert child_in_list is not None
    assert grandchild_in_list is not None
    assert child_in_list["parent_category_id"] == parent["id"]
    assert grandchild_in_list["parent_category_id"] == child["id"]

    # Cleanup (delete in reverse order)
    await client.delete(f"/categories/{grandchild['id']}")
    await client.delete(f"/categories/{child['id']}")
    await client.delete(f"/categories/{parent['id']}")


@pytest.mark.asyncio
async def test_update_category_parent(client):
    """Test changing a category's parent."""
    # Create two parent categories
    parent1_name = f"Parent1-{uuid7().hex[:8]}"
    parent1_resp = await client.post(
        "/categories/",
        json={"name": parent1_name, "description": "Parent 1"},
    )
    assert parent1_resp.status_code == 201
    parent1 = parent1_resp.json()

    parent2_name = f"Parent2-{uuid7().hex[:8]}"
    parent2_resp = await client.post(
        "/categories/",
        json={"name": parent2_name, "description": "Parent 2"},
    )
    assert parent2_resp.status_code == 201
    parent2 = parent2_resp.json()

    # Create child under parent1
    child_name = f"Child-{uuid7().hex[:8]}"
    child_resp = await client.post(
        "/categories/",
        json={
            "name": child_name,
            "parent_category_id": parent1["id"],
            "description": "Child",
        },
    )
    assert child_resp.status_code == 201
    child = child_resp.json()
    assert child["parent_category_id"] == parent1["id"]

    # Move child to parent2
    update_resp = await client.patch(
        f"/categories/{child['id']}",
        json={"parent_category_id": parent2["id"]},
    )
    assert update_resp.status_code == 200
    updated_child = update_resp.json()
    assert updated_child["parent_category_id"] == parent2["id"]

    # Cleanup
    await client.delete(f"/categories/{child['id']}")
    await client.delete(f"/categories/{parent1['id']}")
    await client.delete(f"/categories/{parent2['id']}")
