import os
from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from litestar.testing import AsyncTestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from warehouse.app import create_app

DEFAULT_DB_URL = "postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev"
DEFAULT_REDIS_URL = "redis://localhost:6379/0"
DEFAULT_SECRET_KEY = "e2e-secret-key"
DEFAULT_APP_DEBUG = "true"
# Fernet key for encryption (generate with: from cryptography.fernet import Fernet; Fernet.generate_key())
DEFAULT_ENCRYPTION_KEY = "zKRYz0DXaJL-rqLN1rJJKVSv-7zVJnM1gBg7gBxKe8Y="


def _ensure_env() -> None:
    """Ensure required env vars are present for the app to use the real DB."""
    os.environ.setdefault("DATABASE_URL", DEFAULT_DB_URL)
    os.environ.setdefault("REDIS_URL", DEFAULT_REDIS_URL)
    os.environ.setdefault("SECRET_KEY", DEFAULT_SECRET_KEY)
    os.environ.setdefault("APP_DEBUG", DEFAULT_APP_DEBUG)
    os.environ.setdefault("ENCRYPTION_KEY", DEFAULT_ENCRYPTION_KEY)


@pytest.fixture(scope="session")
def _remote_base_url() -> str | None:
    """Optional remote base URL for hitting a running backend."""
    return os.getenv("E2E_BASE_URL")


@pytest_asyncio.fixture(scope="session")
async def test_workspace_id() -> str:
    """Create a test workspace for E2E tests and return its ID."""
    _ensure_env()
    db_url = os.environ.get("DATABASE_URL", DEFAULT_DB_URL)
    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    workspace_id = str(uuid4())
    workspace_slug = f"test-{uuid4().hex[:8]}"

    async with session_factory() as session:
        # Create workspace using raw SQL to avoid model dependencies
        await session.execute(
            text("""
                INSERT INTO auth.workspaces (id, name, slug, description)
                VALUES (:id, :name, :slug, :description)
            """),
            {
                "id": workspace_id,
                "name": "E2E Test Workspace",
                "slug": workspace_slug,
                "description": "Workspace for E2E tests",
            },
        )
        await session.commit()

    yield workspace_id

    # Cleanup: delete the workspace (cascade will clean up related data)
    async with session_factory() as session:
        await session.execute(
            text("DELETE FROM auth.workspaces WHERE id = :id"),
            {"id": workspace_id},
        )
        await session.commit()

    await engine.dispose()


class WorkspaceHeaderClient:
    """Wrapper that adds X-Workspace-ID header to all requests (no auth)."""

    def __init__(self, client, workspace_id: str):
        self._client = client
        self._workspace_id = workspace_id

    def _merge_headers(self, kwargs):
        """Merge workspace header with any provided headers."""
        headers = kwargs.pop("headers", {})
        headers["X-Workspace-ID"] = self._workspace_id
        return headers

    async def get(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.get(url, headers=headers, **kwargs)

    async def post(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.post(url, headers=headers, **kwargs)

    async def patch(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.patch(url, headers=headers, **kwargs)

    async def delete(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.delete(url, headers=headers, **kwargs)

    async def put(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.put(url, headers=headers, **kwargs)


class AuthenticatedWorkspaceClient:
    """Wrapper that adds X-Workspace-ID and Authorization headers to all requests."""

    def __init__(self, client, workspace_id: str, auth_token: str):
        self._client = client
        self._workspace_id = workspace_id
        self._auth_token = auth_token

    def _merge_headers(self, kwargs):
        """Merge workspace and auth headers with any provided headers.

        Explicitly provided headers take precedence over default ones.
        """
        headers = kwargs.pop("headers", {})
        # Only set workspace ID if not explicitly provided
        if "X-Workspace-ID" not in headers:
            headers["X-Workspace-ID"] = self._workspace_id
        # Only set Authorization if not explicitly provided
        if "Authorization" not in headers:
            headers["Authorization"] = f"Bearer {self._auth_token}"
        return headers

    async def get(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.get(url, headers=headers, **kwargs)

    async def post(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.post(url, headers=headers, **kwargs)

    async def patch(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.patch(url, headers=headers, **kwargs)

    async def delete(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.delete(url, headers=headers, **kwargs)

    async def put(self, url: str, **kwargs):
        headers = self._merge_headers(kwargs)
        return await self._client.put(url, headers=headers, **kwargs)


async def _register_and_get_token(http_client, workspace_id: str) -> str:
    """Register a test user, add them to the workspace, and return their JWT token."""
    unique = uuid4().hex
    email = f"e2e-{unique}@test.local"
    password = "testpassword123"

    # Register user
    register_resp = await http_client.post(
        "/auth/register",
        json={"email": email, "full_name": f"E2E User {unique}", "password": password},
    )
    if register_resp.status_code != 201:
        raise RuntimeError(f"Failed to register test user: {register_resp.text}")

    user_id = register_resp.json()["id"]

    # Login to get token
    login_resp = await http_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    if login_resp.status_code not in (200, 201):
        raise RuntimeError(f"Failed to login test user: {login_resp.text}")

    token = login_resp.json()["access_token"]

    # Add user to the test workspace with 'owner' role using raw SQL
    db_url = os.environ.get("DATABASE_URL", DEFAULT_DB_URL)
    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        await session.execute(
            text("""
                INSERT INTO auth.workspace_members (id, workspace_id, user_id, role)
                VALUES (:id, :workspace_id, :user_id, 'owner')
                ON CONFLICT (workspace_id, user_id) DO NOTHING
            """),
            {
                "id": str(uuid4()),
                "workspace_id": workspace_id,
                "user_id": user_id,
            },
        )
        await session.commit()

    await engine.dispose()

    return token


@pytest_asyncio.fixture(scope="session")
async def unauth_client(_remote_base_url: str | None, test_workspace_id: str):
    """
    Unauthenticated client for testing auth requirements.

    Only includes X-Workspace-ID header, no Authorization header.
    Use this for tests that verify 401 responses.
    """
    _ensure_env()

    if _remote_base_url:
        async with httpx.AsyncClient(
            base_url=_remote_base_url, timeout=15.0
        ) as http_client:
            yield WorkspaceHeaderClient(http_client, test_workspace_id)
    else:
        async with AsyncTestClient(app=create_app()) as http_client:
            yield WorkspaceHeaderClient(http_client, test_workspace_id)


@pytest_asyncio.fixture(scope="session")
async def client(_remote_base_url: str | None, test_workspace_id: str):
    """
    Use a real app against the real database.

    - If E2E_BASE_URL is set, hit the running backend service.
    - Otherwise, use the in-process ASGI app (still talking to the real DB via env DATABASE_URL).

    All requests include the X-Workspace-ID header and Authorization header for multi-tenancy
    and authentication.
    """
    _ensure_env()

    if _remote_base_url:
        async with httpx.AsyncClient(
            base_url=_remote_base_url, timeout=15.0
        ) as http_client:
            token = await _register_and_get_token(http_client, test_workspace_id)
            yield AuthenticatedWorkspaceClient(http_client, test_workspace_id, token)
    else:
        async with AsyncTestClient(app=create_app()) as http_client:
            token = await _register_and_get_token(http_client, test_workspace_id)
            yield AuthenticatedWorkspaceClient(http_client, test_workspace_id, token)
