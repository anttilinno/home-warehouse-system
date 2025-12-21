"""End-to-end tests for authentication flow against the real app."""

from datetime import UTC, datetime
from uuid import uuid7

import asyncpg

import pytest


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

