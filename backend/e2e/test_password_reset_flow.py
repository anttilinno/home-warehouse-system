"""End-to-end tests for password reset flow against the real app."""

from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_password_reset_request_success(unauth_client):
    """Test requesting a password reset for existing user."""
    unique = uuid4().hex
    email = f"reset-test-{unique}@example.com"

    # Create a user first
    register_resp = await unauth_client.post(
        "/auth/register",
        json={
            "email": email,
            "full_name": "Reset Test User",
            "password": "oldpassword123",
        },
    )
    assert register_resp.status_code == 201

    # Request password reset
    reset_resp = await unauth_client.post(
        "/auth/password-reset/request",
        json={"email": email},
    )
    assert reset_resp.status_code in (200, 201)
    result = reset_resp.json()
    assert "message" in result


@pytest.mark.asyncio
async def test_password_reset_request_nonexistent_email(unauth_client):
    """Test requesting reset for non-existent email returns success (security)."""
    resp = await unauth_client.post(
        "/auth/password-reset/request",
        json={"email": "nonexistent@example.com"},
    )
    # Should return success to not reveal if email exists
    assert resp.status_code in (200, 201)
    result = resp.json()
    assert "message" in result


@pytest.mark.asyncio
async def test_password_reset_request_rate_limiting(unauth_client):
    """Test that multiple reset requests work (no rate limiting in test)."""
    unique = uuid4().hex
    email = f"rate-test-{unique}@example.com"

    # Register user
    await unauth_client.post(
        "/auth/register",
        json={
            "email": email,
            "full_name": "Rate Test",
            "password": "password123",
        },
    )

    # Multiple reset requests should work
    for _ in range(3):
        resp = await unauth_client.post(
            "/auth/password-reset/request",
            json={"email": email},
        )
        assert resp.status_code in (200, 201)
