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


def _ensure_env() -> None:
    """Ensure required env vars are present for the app to use the real DB."""
    os.environ.setdefault("DATABASE_URL", DEFAULT_DB_URL)
    os.environ.setdefault("REDIS_URL", DEFAULT_REDIS_URL)
    os.environ.setdefault("SECRET_KEY", DEFAULT_SECRET_KEY)
    os.environ.setdefault("APP_DEBUG", DEFAULT_APP_DEBUG)


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
    """Wrapper that adds X-Workspace-ID header to all requests."""

    def __init__(self, client, workspace_id: str):
        self._client = client
        self._workspace_id = workspace_id

    async def get(self, url: str, **kwargs):
        headers = kwargs.pop("headers", {})
        headers["X-Workspace-ID"] = self._workspace_id
        return await self._client.get(url, headers=headers, **kwargs)

    async def post(self, url: str, **kwargs):
        headers = kwargs.pop("headers", {})
        headers["X-Workspace-ID"] = self._workspace_id
        return await self._client.post(url, headers=headers, **kwargs)

    async def patch(self, url: str, **kwargs):
        headers = kwargs.pop("headers", {})
        headers["X-Workspace-ID"] = self._workspace_id
        return await self._client.patch(url, headers=headers, **kwargs)

    async def delete(self, url: str, **kwargs):
        headers = kwargs.pop("headers", {})
        headers["X-Workspace-ID"] = self._workspace_id
        return await self._client.delete(url, headers=headers, **kwargs)

    async def put(self, url: str, **kwargs):
        headers = kwargs.pop("headers", {})
        headers["X-Workspace-ID"] = self._workspace_id
        return await self._client.put(url, headers=headers, **kwargs)


@pytest_asyncio.fixture(scope="session")
async def client(_remote_base_url: str | None, test_workspace_id: str):
    """
    Use a real app against the real database.

    - If E2E_BASE_URL is set, hit the running backend service.
    - Otherwise, use the in-process ASGI app (still talking to the real DB via env DATABASE_URL).

    All requests include the X-Workspace-ID header for multi-tenancy.
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
