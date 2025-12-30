"""End-to-end tests for favorites flow against the real app."""

from uuid import uuid7

import asyncpg
import pytest


async def _register_login_and_add_to_workspace(client, workspace_id: str, unique: str | None = None):
    """Helper to register, login, and add user to workspace. Returns (token, user_data)."""
    if unique is None:
        unique = uuid7().hex
    payload = {
        "email": f"{unique}@favorites.test",
        "full_name": f"Favorites User {unique}",
        "password": "testpass123",
    }
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 201
    user = resp.json()

    login_resp = await client.post(
        "/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert login_resp.status_code in (200, 201)
    body = login_resp.json()
    token = body["access_token"]

    # Add user to workspace as member via direct DB insert
    conn = await asyncpg.connect("postgresql://wh:wh@localhost:5432/warehouse_dev")
    try:
        await conn.execute(
            """
            INSERT INTO auth.workspace_members (workspace_id, user_id, role)
            VALUES ($1::uuid, $2::uuid, 'member'::auth.workspace_role_enum)
            ON CONFLICT DO NOTHING
            """,
            workspace_id,
            user["id"],
        )
    finally:
        await conn.close()

    return token, user


async def _create_item(client, token: str, sku: str | None = None):
    """Helper to create an item, returns item dict."""
    if sku is None:
        sku = f"FAV-{uuid7().hex}"  # Use full UUID for uniqueness
    resp = await client.post(
        "/items/",
        json={"sku": sku, "name": f"Favorite Item {sku}", "description": "Test item for favorites"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, f"Item creation failed with {resp.status_code}: {resp.json()}"
    return resp.json()


async def _create_location(client, token: str, name: str | None = None):
    """Helper to create a location, returns location dict."""
    if name is None:
        name = f"FavLoc-{uuid7().hex}"  # Use full UUID for uniqueness
    resp = await client.post(
        "/locations/",
        json={"name": name, "description": "Test location for favorites"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_favorites_toggle_item(client, test_workspace_id):
    """Test toggling an item as favorite."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Create an item to favorite
    item = await _create_item(client, token)
    item_id = item["id"]

    # Toggle favorite on
    toggle_resp = await client.post(
        f"/favorites/toggle/ITEM/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert toggle_resp.status_code in (200, 201)
    toggle_body = toggle_resp.json()
    assert toggle_body["is_favorited"] is True
    assert toggle_body["favorite_id"] is not None

    # Check favorite status
    check_resp = await client.get(
        f"/favorites/check/ITEM/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert check_resp.status_code == 200
    assert check_resp.json()["is_favorited"] is True

    # Toggle favorite off
    toggle_off_resp = await client.post(
        f"/favorites/toggle/ITEM/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert toggle_off_resp.status_code in (200, 201)
    assert toggle_off_resp.json()["is_favorited"] is False
    assert toggle_off_resp.json()["favorite_id"] is None

    # Verify no longer favorited
    check_off_resp = await client.get(
        f"/favorites/check/ITEM/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert check_off_resp.status_code == 200
    assert check_off_resp.json()["is_favorited"] is False


@pytest.mark.asyncio
async def test_favorites_list_with_details(client, test_workspace_id):
    """Test listing favorites with entity details."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Create an item and location
    item = await _create_item(client, token)
    location = await _create_location(client, token)

    # Add both as favorites
    await client.post(
        f"/favorites/toggle/ITEM/{item['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        f"/favorites/toggle/LOCATION/{location['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    # List favorites
    list_resp = await client.get(
        "/favorites/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.status_code == 200
    favorites = list_resp.json()
    assert len(favorites) == 2

    # Verify details are included
    favorite_types = {f["favorite_type"] for f in favorites}
    assert "ITEM" in favorite_types
    assert "LOCATION" in favorite_types

    for fav in favorites:
        assert "entity_name" in fav
        assert "entity_id" in fav
        assert fav["entity_name"] is not None


@pytest.mark.asyncio
async def test_favorites_add_directly(client, test_workspace_id):
    """Test adding a favorite via POST."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Create an item
    item = await _create_item(client, token)

    # Add favorite directly
    add_resp = await client.post(
        "/favorites/",
        json={
            "favorite_type": "ITEM",
            "item_id": item["id"],
            "location_id": None,
            "container_id": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_resp.status_code == 201
    fav = add_resp.json()
    assert fav["favorite_type"] == "ITEM"
    assert fav["item_id"] == item["id"]

    # Adding same favorite again should return existing (idempotent)
    add_again_resp = await client.post(
        "/favorites/",
        json={
            "favorite_type": "ITEM",
            "item_id": item["id"],
            "location_id": None,
            "container_id": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_again_resp.status_code == 201
    # Should return same favorite
    assert add_again_resp.json()["id"] == fav["id"]


@pytest.mark.asyncio
async def test_favorites_remove_directly(client, test_workspace_id):
    """Test removing a favorite via DELETE."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Create an item and add as favorite
    item = await _create_item(client, token)
    await client.post(
        f"/favorites/toggle/ITEM/{item['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    # Remove favorite
    delete_resp = await client.delete(
        f"/favorites/ITEM/{item['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code in (200, 204)

    # Verify removed
    check_resp = await client.get(
        f"/favorites/check/ITEM/{item['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert check_resp.status_code == 200
    assert check_resp.json()["is_favorited"] is False


@pytest.mark.asyncio
async def test_favorites_requires_auth(unauth_client, test_workspace_id):
    """Test that favorites endpoints require authentication."""
    # List favorites without auth
    resp = await unauth_client.get("/favorites/")
    assert resp.status_code == 401

    # Toggle without auth
    resp = await unauth_client.post(f"/favorites/toggle/ITEM/{uuid7()}")
    assert resp.status_code == 401

    # Check without auth
    resp = await unauth_client.get(f"/favorites/check/ITEM/{uuid7()}")
    assert resp.status_code == 401


# ===================== ERROR PATH TESTS =====================


async def _create_container(client, token: str, location_id: str, name: str | None = None):
    """Helper to create a container, returns container dict."""
    if name is None:
        name = f"FavCont-{uuid7().hex}"
    resp = await client.post(
        "/containers/",
        json={"name": name, "location_id": location_id, "description": "Test container"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_favorites_toggle_container(client, test_workspace_id):
    """Test toggling a container as favorite."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Create a location and container
    location = await _create_location(client, token)
    container = await _create_container(client, token, location["id"])

    # Toggle favorite on
    toggle_resp = await client.post(
        f"/favorites/toggle/CONTAINER/{container['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert toggle_resp.status_code in (200, 201)
    assert toggle_resp.json()["is_favorited"] is True

    # Verify in list
    list_resp = await client.get(
        "/favorites/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.status_code == 200
    favorite_types = [f["favorite_type"] for f in list_resp.json()]
    assert "CONTAINER" in favorite_types

    # Toggle off
    toggle_off_resp = await client.post(
        f"/favorites/toggle/CONTAINER/{container['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert toggle_off_resp.status_code in (200, 201)
    assert toggle_off_resp.json()["is_favorited"] is False


@pytest.mark.asyncio
async def test_favorites_add_invalid_type(client, test_workspace_id):
    """Test adding favorite with invalid type returns error."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Try to add favorite with invalid type
    resp = await client.post(
        "/favorites/",
        json={
            "favorite_type": "INVALID_TYPE",
            "item_id": str(uuid7()),
            "location_id": None,
            "container_id": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    # Should return error (400 or validation error)
    assert resp.status_code in (400, 422, 500)


@pytest.mark.asyncio
async def test_favorites_add_missing_entity_id(client, test_workspace_id):
    """Test adding favorite without entity ID returns error."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Try to add ITEM favorite without item_id
    resp = await client.post(
        "/favorites/",
        json={
            "favorite_type": "ITEM",
            "item_id": None,
            "location_id": None,
            "container_id": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_favorites_remove_nonexistent(client, test_workspace_id):
    """Test removing non-existent favorite returns false/empty."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Try to delete a favorite that doesn't exist
    fake_id = str(uuid7())
    resp = await client.delete(
        f"/favorites/ITEM/{fake_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Should succeed (idempotent delete) or return not found
    assert resp.status_code in (200, 204, 404)


@pytest.mark.asyncio
async def test_favorites_check_nonexistent(client, test_workspace_id):
    """Test checking non-existent favorite returns not favorited."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Check favorite status of something not favorited
    fake_id = str(uuid7())
    resp = await client.get(
        f"/favorites/check/ITEM/{fake_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_favorited"] is False


@pytest.mark.asyncio
async def test_favorites_toggle_nonexistent_entity(client, test_workspace_id):
    """Test toggling favorite on non-existent entity returns error."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Toggle favorite for a non-existent item
    # This should fail due to foreign key constraint
    fake_id = str(uuid7())
    resp = await client.post(
        f"/favorites/toggle/ITEM/{fake_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Foreign key error returns 500 (or could be 400/404 depending on error handling)
    assert resp.status_code in (400, 404, 500)


@pytest.mark.asyncio
async def test_favorites_list_empty(client, test_workspace_id):
    """Test listing favorites when none exist."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # List favorites for new user (should be empty)
    resp = await client.get(
        "/favorites/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_favorites_add_location_directly(client, test_workspace_id):
    """Test adding a location as favorite directly."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Create a location
    location = await _create_location(client, token)

    # Add location as favorite directly
    resp = await client.post(
        "/favorites/",
        json={
            "favorite_type": "LOCATION",
            "item_id": None,
            "location_id": location["id"],
            "container_id": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["favorite_type"] == "LOCATION"
    assert resp.json()["location_id"] == location["id"]


@pytest.mark.asyncio
async def test_favorites_add_container_directly(client, test_workspace_id):
    """Test adding a container as favorite directly."""
    token, user = await _register_login_and_add_to_workspace(client, test_workspace_id)

    # Create a location and container
    location = await _create_location(client, token)
    container = await _create_container(client, token, location["id"])

    # Add container as favorite directly
    resp = await client.post(
        "/favorites/",
        json={
            "favorite_type": "CONTAINER",
            "item_id": None,
            "location_id": None,
            "container_id": container["id"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["favorite_type"] == "CONTAINER"
    assert resp.json()["container_id"] == container["id"]
