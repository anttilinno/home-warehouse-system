"""End-to-end tests for Docspell integration flow."""

import pytest


@pytest.mark.asyncio
async def test_docspell_settings_not_configured(client):
    """Test that settings return None when not configured."""
    resp = await client.get("/docspell/settings")
    assert resp.status_code == 200
    # Should return null/None when not configured
    assert resp.json() is None


@pytest.mark.asyncio
async def test_docspell_settings_create(client):
    """Test creating Docspell settings."""
    settings_data = {
        "base_url": "http://docspell:7880",
        "collective_name": "test-collective",
        "username": "testuser",
        "password": "testpass123",
        "sync_tags_enabled": False,
    }

    resp = await client.post("/docspell/settings", json=settings_data)
    assert resp.status_code == 201

    result = resp.json()
    assert result["base_url"] == "http://docspell:7880"
    assert result["collective_name"] == "test-collective"
    assert result["username"] == "testuser"
    assert result["sync_tags_enabled"] is False
    assert result["is_enabled"] is True
    # Password should NOT be in response
    assert "password" not in result
    assert "password_encrypted" not in result


@pytest.mark.asyncio
async def test_docspell_settings_get_after_create(client):
    """Test getting settings after creation."""
    resp = await client.get("/docspell/settings")
    assert resp.status_code == 200

    result = resp.json()
    assert result is not None
    assert result["base_url"] == "http://docspell:7880"
    assert result["collective_name"] == "test-collective"


@pytest.mark.asyncio
async def test_docspell_settings_duplicate_error(client):
    """Test that creating duplicate settings returns error."""
    settings_data = {
        "base_url": "http://another:7880",
        "collective_name": "another",
        "username": "user",
        "password": "pass",
    }

    resp = await client.post("/docspell/settings", json=settings_data)
    # Should fail because settings already exist
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_docspell_settings_update(client):
    """Test updating Docspell settings."""
    update_data = {
        "sync_tags_enabled": True,
        "base_url": "http://updated-docspell:7880",
    }

    resp = await client.patch("/docspell/settings", json=update_data)
    assert resp.status_code == 200

    result = resp.json()
    assert result["sync_tags_enabled"] is True
    assert result["base_url"] == "http://updated-docspell:7880"
    # Other fields should be unchanged
    assert result["collective_name"] == "test-collective"


@pytest.mark.asyncio
async def test_docspell_settings_update_password(client):
    """Test updating password (should be encrypted)."""
    update_data = {
        "password": "new-secure-password",
    }

    resp = await client.patch("/docspell/settings", json=update_data)
    assert resp.status_code == 200
    # Password should not be returned
    assert "password" not in resp.json()


@pytest.mark.asyncio
async def test_docspell_settings_disable(client):
    """Test disabling Docspell integration."""
    update_data = {
        "is_enabled": False,
    }

    resp = await client.patch("/docspell/settings", json=update_data)
    assert resp.status_code == 200
    assert resp.json()["is_enabled"] is False


@pytest.mark.asyncio
async def test_docspell_test_connection_when_disabled(client):
    """Test connection test when disabled (should still work)."""
    resp = await client.get("/docspell/test")
    assert resp.status_code == 200

    result = resp.json()
    # Connection test should run even when disabled
    # It will fail because the Docspell server isn't running
    assert "success" in result
    assert "message" in result


@pytest.mark.asyncio
async def test_docspell_search_when_disabled(client):
    """Test search fails when integration is disabled."""
    resp = await client.get("/docspell/search?q=invoice")
    # Should fail because integration is disabled
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_docspell_settings_enable(client):
    """Test re-enabling Docspell integration."""
    update_data = {
        "is_enabled": True,
    }

    resp = await client.patch("/docspell/settings", json=update_data)
    assert resp.status_code == 200
    assert resp.json()["is_enabled"] is True


@pytest.mark.asyncio
async def test_docspell_tags_sync_disabled(client):
    """Test tag sync fails when sync is disabled."""
    # First disable sync
    await client.patch("/docspell/settings", json={"sync_tags_enabled": False})

    resp = await client.post("/docspell/tags/sync", json={"direction": "both"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_docspell_settings_delete(client):
    """Test deleting Docspell settings."""
    resp = await client.delete("/docspell/settings")
    assert resp.status_code == 204

    # Verify deletion
    get_resp = await client.get("/docspell/settings")
    assert get_resp.status_code == 200
    assert get_resp.json() is None


@pytest.mark.asyncio
async def test_docspell_settings_delete_not_found(client):
    """Test deleting settings that don't exist."""
    resp = await client.delete("/docspell/settings")
    # Settings were already deleted in previous test
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_docspell_update_not_found(client):
    """Test updating settings that don't exist."""
    resp = await client.patch("/docspell/settings", json={"base_url": "http://x:7880"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_docspell_requires_auth(unauth_client):
    """Test that Docspell endpoints require authentication."""
    resp = await unauth_client.get("/docspell/settings")
    assert resp.status_code == 401

    resp = await unauth_client.post("/docspell/settings", json={
        "base_url": "http://x:7880",
        "collective_name": "x",
        "username": "x",
        "password": "x",
    })
    assert resp.status_code == 401
