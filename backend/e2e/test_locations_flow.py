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


@pytest.mark.asyncio
async def test_location_hierarchy_flow(client):
    """Test creating locations with parent-child relationships."""
    # Create parent location
    parent_name = f"Parent-{uuid7().hex[:8]}"
    parent_resp = await client.post(
        "/locations/",
        json={"name": parent_name, "zone": "A", "description": "Parent location"},
    )
    assert parent_resp.status_code == 201
    parent = parent_resp.json()

    # Create child location
    child_name = f"Child-{uuid7().hex[:8]}"
    child_resp = await client.post(
        "/locations/",
        json={
            "name": child_name,
            "parent_location_id": parent["id"],
            "zone": "A1",
            "description": "Child location",
        },
    )
    assert child_resp.status_code == 201
    child = child_resp.json()
    assert child["parent_location_id"] == parent["id"]

    # Create grandchild location
    grandchild_name = f"Grandchild-{uuid7().hex[:8]}"
    grandchild_resp = await client.post(
        "/locations/",
        json={
            "name": grandchild_name,
            "parent_location_id": child["id"],
            "zone": "A1a",
            "description": "Grandchild location",
        },
    )
    assert grandchild_resp.status_code == 201
    grandchild = grandchild_resp.json()
    assert grandchild["parent_location_id"] == child["id"]

    # Cleanup
    await client.delete(f"/locations/{grandchild['id']}")
    await client.delete(f"/locations/{child['id']}")
    await client.delete(f"/locations/{parent['id']}")


@pytest.mark.asyncio
async def test_location_breadcrumb_flow(client):
    """Test getting location breadcrumb path."""
    # Create hierarchy: Root -> Middle -> Leaf
    root_name = f"Root-{uuid7().hex[:8]}"
    root_resp = await client.post(
        "/locations/",
        json={"name": root_name, "zone": "R", "description": "Root"},
    )
    assert root_resp.status_code == 201
    root = root_resp.json()

    middle_name = f"Middle-{uuid7().hex[:8]}"
    middle_resp = await client.post(
        "/locations/",
        json={
            "name": middle_name,
            "parent_location_id": root["id"],
            "zone": "M",
            "description": "Middle",
        },
    )
    assert middle_resp.status_code == 201
    middle = middle_resp.json()

    leaf_name = f"Leaf-{uuid7().hex[:8]}"
    leaf_resp = await client.post(
        "/locations/",
        json={
            "name": leaf_name,
            "parent_location_id": middle["id"],
            "zone": "L",
            "description": "Leaf",
        },
    )
    assert leaf_resp.status_code == 201
    leaf = leaf_resp.json()

    # Get breadcrumb for leaf location
    breadcrumb_resp = await client.get(f"/locations/{leaf['id']}/breadcrumb")
    assert breadcrumb_resp.status_code == 200
    breadcrumb = breadcrumb_resp.json()

    # Should return [Root, Middle, Leaf]
    assert len(breadcrumb) == 3
    assert breadcrumb[0]["id"] == root["id"]
    assert breadcrumb[0]["name"] == root_name
    assert breadcrumb[1]["id"] == middle["id"]
    assert breadcrumb[1]["name"] == middle_name
    assert breadcrumb[2]["id"] == leaf["id"]
    assert breadcrumb[2]["name"] == leaf_name

    # Cleanup
    await client.delete(f"/locations/{leaf['id']}")
    await client.delete(f"/locations/{middle['id']}")
    await client.delete(f"/locations/{root['id']}")


@pytest.mark.asyncio
async def test_update_location_parent(client):
    """Test moving a location to a different parent."""
    # Create two parent locations
    parent1_name = f"Parent1-{uuid7().hex[:8]}"
    parent1_resp = await client.post(
        "/locations/",
        json={"name": parent1_name, "zone": "P1", "description": "Parent 1"},
    )
    assert parent1_resp.status_code == 201
    parent1 = parent1_resp.json()

    parent2_name = f"Parent2-{uuid7().hex[:8]}"
    parent2_resp = await client.post(
        "/locations/",
        json={"name": parent2_name, "zone": "P2", "description": "Parent 2"},
    )
    assert parent2_resp.status_code == 201
    parent2 = parent2_resp.json()

    # Create child under parent1
    child_name = f"Child-{uuid7().hex[:8]}"
    child_resp = await client.post(
        "/locations/",
        json={
            "name": child_name,
            "parent_location_id": parent1["id"],
            "zone": "C",
            "description": "Child",
        },
    )
    assert child_resp.status_code == 201
    child = child_resp.json()
    assert child["parent_location_id"] == parent1["id"]

    # Move child to parent2
    update_resp = await client.patch(
        f"/locations/{child['id']}",
        json={"parent_location_id": parent2["id"]},
    )
    assert update_resp.status_code == 200
    updated_child = update_resp.json()
    assert updated_child["parent_location_id"] == parent2["id"]

    # Verify with breadcrumb
    breadcrumb_resp = await client.get(f"/locations/{child['id']}/breadcrumb")
    assert breadcrumb_resp.status_code == 200
    breadcrumb = breadcrumb_resp.json()
    assert len(breadcrumb) == 2
    assert breadcrumb[0]["id"] == parent2["id"]
    assert breadcrumb[1]["id"] == child["id"]

    # Cleanup
    await client.delete(f"/locations/{child['id']}")
    await client.delete(f"/locations/{parent1['id']}")
    await client.delete(f"/locations/{parent2['id']}")
