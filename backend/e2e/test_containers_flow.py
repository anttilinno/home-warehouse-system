"""End-to-end tests for containers flow against the real app."""

from uuid import uuid7

import pytest


@pytest.mark.asyncio
async def test_container_crud_flow(client):
    """Test complete container CRUD operations."""
    suffix = uuid7().hex

    # First create a location for the container
    loc_resp = await client.post(
        "/locations/",
        json={"name": f"ContainerLoc-{suffix}", "zone": "C", "shelf": "1", "bin": "1", "description": None},
    )
    assert loc_resp.status_code == 201
    location_id = loc_resp.json()["id"]

    # Create container
    create_resp = await client.post(
        "/containers/",
        json={
            "name": f"Container-{suffix}",
            "location_id": location_id,
            "description": "Test container",
            "capacity": "100 units",
        },
    )
    assert create_resp.status_code == 201
    container = create_resp.json()
    container_id = container["id"]

    assert container["name"] == f"Container-{suffix}"
    assert container["location_id"] == location_id
    assert container["description"] == "Test container"
    assert container["capacity"] == "100 units"
    # short_code is optional and not auto-generated
    assert container["location_name"] is not None

    # List containers
    list_resp = await client.get("/containers/")
    assert list_resp.status_code == 200
    containers = list_resp.json()
    assert any(c["id"] == container_id for c in containers)

    # Get container by ID
    get_resp = await client.get(f"/containers/{container_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == container_id
    assert get_resp.json()["name"] == f"Container-{suffix}"

    # Update container
    update_resp = await client.patch(
        f"/containers/{container_id}",
        json={"description": "Updated description", "capacity": "200 units"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["description"] == "Updated description"
    assert update_resp.json()["capacity"] == "200 units"

    # Delete container
    delete_resp = await client.delete(f"/containers/{container_id}")
    assert delete_resp.status_code == 204

    # Verify deleted
    get_deleted_resp = await client.get(f"/containers/{container_id}")
    assert get_deleted_resp.status_code == 404


@pytest.mark.asyncio
async def test_container_with_description_and_capacity(client):
    """Test creating container with optional fields."""
    suffix = uuid7().hex

    # Create a location first (required)
    loc_resp = await client.post(
        "/locations/",
        json={"name": f"OptLoc-{suffix}", "zone": "O", "shelf": "1", "bin": "1", "description": None},
    )
    assert loc_resp.status_code == 201
    location_id = loc_resp.json()["id"]

    # Create container with optional fields (but not short_code to avoid uniqueness issues)
    create_resp = await client.post(
        "/containers/",
        json={
            "name": f"FullContainer-{suffix}",
            "location_id": location_id,
            "description": "Container with all fields",
            "capacity": "Large - 50 items",
        },
    )
    assert create_resp.status_code == 201
    container = create_resp.json()
    assert container["description"] == "Container with all fields"
    assert container["capacity"] == "Large - 50 items"


@pytest.mark.asyncio
async def test_container_get_missing(client):
    """Test getting a non-existent container returns 404."""
    missing_id = uuid7()
    resp = await client.get(f"/containers/{missing_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_container_update_missing(client):
    """Test updating a non-existent container returns 404."""
    missing_id = uuid7()
    resp = await client.patch(
        f"/containers/{missing_id}",
        json={"description": "Should fail"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_container_delete_missing(client):
    """Test deleting a non-existent container returns 404."""
    missing_id = uuid7()
    resp = await client.delete(f"/containers/{missing_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_container_update_location(client):
    """Test updating container to a different location."""
    suffix = uuid7().hex

    # Create two locations
    loc1_resp = await client.post(
        "/locations/",
        json={"name": f"ContLoc1-{suffix}", "zone": "A", "shelf": "1", "bin": "1", "description": None},
    )
    location1_id = loc1_resp.json()["id"]

    loc2_resp = await client.post(
        "/locations/",
        json={"name": f"ContLoc2-{suffix}", "zone": "B", "shelf": "2", "bin": "2", "description": None},
    )
    location2_id = loc2_resp.json()["id"]

    # Create container at location 1
    create_resp = await client.post(
        "/containers/",
        json={
            "name": f"MovableContainer-{suffix}",
            "location_id": location1_id,
            "description": None,
            "capacity": None,
        },
    )
    container_id = create_resp.json()["id"]
    assert create_resp.json()["location_id"] == location1_id

    # Move to location 2
    update_resp = await client.patch(
        f"/containers/{container_id}",
        json={"location_id": location2_id},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["location_id"] == location2_id
