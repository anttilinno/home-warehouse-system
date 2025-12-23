"""End-to-end tests for authentication flow against the real app."""

from datetime import UTC, datetime
from uuid import uuid7

import asyncpg

import pytest


async def _register_and_login(client, unique: str | None = None):
    """Helper to register and login a user, returns (token, user_data)."""
    if unique is None:
        unique = uuid7().hex
    payload = {
        "email": f"{unique}@example.com",
        "full_name": f"User {unique}",
        "password": "password123",
    }
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 201

    login_resp = await client.post(
        "/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert login_resp.status_code in (200, 201)
    body = login_resp.json()
    return body["access_token"], body["user"], payload


@pytest.mark.asyncio
async def test_register_and_login_flow(client):
    unique = uuid7().hex
    register_payload = {
        "email": f"{unique}@example.com",
        "full_name": f"User {unique}",
        "password": "pw",
    }
    resp = await client.post("/auth/register", json=register_payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == register_payload["email"]
    assert body["full_name"] == register_payload["full_name"]
    assert body["is_active"] is True

    login_payload = {"email": register_payload["email"], "password": "pw"}
    login_resp = await client.post("/auth/login", json=login_payload)
    assert login_resp.status_code in (200, 201)
    token_body = login_resp.json()
    assert token_body["access_token"]
    assert token_body["token_type"] == "bearer"

    bad_login = {"email": register_payload["email"], "password": "wrong"}
    bad_resp = await client.post("/auth/login", json=bad_login)
    assert bad_resp.status_code == 401


@pytest.mark.asyncio
async def test_register_duplicate_and_inactive_login(client):
    unique = uuid7().hex
    payload = {
        "email": f"{unique}@dup.test",
        "full_name": f"Dupe User {unique}",
        "password": "pw",
    }

    first = await client.post("/auth/register", json=payload)
    assert first.status_code == 201

    # Duplicate register should surface as 400 with error code (duplicate email).
    dup = await client.post("/auth/register", json=payload)
    assert dup.status_code == 400
    # Error responses now return just the message string
    dup_detail = dup.json().get("detail", "")
    assert "Email already exists" in dup_detail

    # Deactivate user directly in DB to exercise inactive-login branch.
    conn = await asyncpg.connect("postgresql://wh:wh@localhost:5432/warehouse_dev")
    try:
        await conn.execute("UPDATE auth.users SET is_active=false WHERE email=$1", payload["email"])
    finally:
        await conn.close()

    inactive_login = await client.post(
        "/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert inactive_login.status_code == 401


@pytest.mark.asyncio
async def test_get_me_flow(client):
    """Test getting current user profile."""
    token, user, _ = await _register_and_login(client)

    # Get current user
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == user["email"]
    assert body["full_name"] == user["full_name"]


@pytest.mark.asyncio
async def test_update_profile_flow(client):
    """Test updating user profile."""
    token, user, _ = await _register_and_login(client)

    # Update profile
    new_name = f"Updated {uuid7().hex[:8]}"
    resp = await client.patch(
        "/auth/me",
        json={"full_name": new_name, "email": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["full_name"] == new_name
    assert body["email"] == user["email"]  # Email unchanged


@pytest.mark.asyncio
async def test_change_password_flow(client):
    """Test changing user password."""
    unique = uuid7().hex
    token, user, payload = await _register_and_login(client, unique)

    # Change password
    new_password = "newpassword456"
    resp = await client.post(
        "/auth/me/password",
        json={"current_password": payload["password"], "new_password": new_password},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201)

    # Login with new password should work
    login_resp = await client.post(
        "/auth/login", json={"email": payload["email"], "password": new_password}
    )
    assert login_resp.status_code in (200, 201)

    # Login with old password should fail
    old_login = await client.post(
        "/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert old_login.status_code == 401


@pytest.mark.asyncio
async def test_create_workspace_flow(client):
    """Test creating a new workspace."""
    token, user, _ = await _register_and_login(client)

    # Create workspace
    workspace_name = f"Test Workspace {uuid7().hex[:8]}"
    resp = await client.post(
        "/auth/workspaces",
        json={"name": workspace_name, "description": "A test workspace"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == workspace_name
    assert body["role"] == "owner"
    assert body["slug"]  # Should have a generated slug


@pytest.mark.asyncio
async def test_get_workspace_members_flow(client):
    """Test getting workspace members."""
    token, user, _ = await _register_and_login(client)

    # Create workspace first
    workspace_name = f"Members Test {uuid7().hex[:8]}"
    create_resp = await client.post(
        "/auth/workspaces",
        json={"name": workspace_name, "description": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    workspace = create_resp.json()

    # Get workspace members
    members_resp = await client.get(
        f"/auth/workspaces/{workspace['id']}/members",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert members_resp.status_code == 200
    members = members_resp.json()
    assert len(members) == 1  # Just the owner
    assert members[0]["email"] == user["email"]
    assert members[0]["role"] == "owner"


@pytest.mark.asyncio
async def test_invite_member_flow(client):
    """Test inviting a member to workspace."""
    # Register owner
    owner_token, owner_user, _ = await _register_and_login(client)

    # Register invitee
    invitee_token, invitee_user, _ = await _register_and_login(client)

    # Owner creates workspace
    workspace_name = f"Invite Test {uuid7().hex[:8]}"
    create_resp = await client.post(
        "/auth/workspaces",
        json={"name": workspace_name, "description": None},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert create_resp.status_code == 201
    workspace = create_resp.json()

    # Owner invites invitee
    invite_resp = await client.post(
        f"/auth/workspaces/{workspace['id']}/members",
        json={"email": invitee_user["email"], "role": "member"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert invite_resp.status_code == 201
    invite_body = invite_resp.json()
    assert invite_body["email"] == invitee_user["email"]
    assert invite_body["role"] == "member"

    # Verify members now include invitee
    members_resp = await client.get(
        f"/auth/workspaces/{workspace['id']}/members",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert members_resp.status_code == 200
    members = members_resp.json()
    assert len(members) == 2
    emails = [m["email"] for m in members]
    assert owner_user["email"] in emails
    assert invitee_user["email"] in emails


@pytest.mark.asyncio
async def test_search_users_flow(client):
    """Test searching for users."""
    token, user, payload = await _register_and_login(client)

    # Search for the user by email
    search_resp = await client.get(
        f"/auth/users/search?q={payload['email'][:10]}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search_resp.status_code == 200
    results = search_resp.json()
    # Should find at least the current user
    assert len(results) >= 1

