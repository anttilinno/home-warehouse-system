"""Controller tests for containers domain."""

from datetime import datetime
from types import SimpleNamespace
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest
from litestar.exceptions import HTTPException

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.containers.controllers import ContainerController
from warehouse.domain.containers.schemas import ContainerCreate, ContainerUpdate
from warehouse.errors import AppError, ErrorCode
from warehouse.lib.workspace import WorkspaceContext


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def user_id() -> UUID:
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def location_id() -> UUID:
    """A sample location ID."""
    return uuid7()


@pytest.fixture
def workspace(workspace_id: UUID, user_id: UUID) -> WorkspaceContext:
    """Workspace context for tests (with member role for write access)."""
    return WorkspaceContext(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=WorkspaceRole.MEMBER,
    )


@pytest.fixture
def container_service_mock() -> AsyncMock:
    """Mocked container service."""
    svc = AsyncMock()
    svc.create_container = AsyncMock()
    svc.get_all_containers = AsyncMock()
    svc.get_container = AsyncMock()
    svc.update_container = AsyncMock()
    svc.delete_container = AsyncMock()
    return svc


@pytest.fixture
def controller() -> ContainerController:
    """Container controller instance."""
    return ContainerController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


def _container(location_id: UUID, **overrides) -> SimpleNamespace:
    """Create a mock container object."""
    loc = SimpleNamespace(name="Test Location")
    defaults = {
        "id": uuid7(),
        "name": "Box A",
        "location_id": location_id,
        "location": loc,
        "description": "A storage box",
        "capacity": "10 items",
        "short_code": "BOX-A",
        "created_at": datetime(2024, 1, 1, 0, 0, 0),
        "updated_at": datetime(2024, 1, 1, 0, 0, 0),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_create_container(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
    location_id: UUID,
):
    """Test creating a container."""
    container = _container(location_id)
    container_service_mock.create_container.return_value = container
    payload = ContainerCreate(
        name="Box A",
        location_id=location_id,
        description="A storage box",
        capacity="10 items",
        short_code="BOX-A",
    )

    resp = await _call(
        controller.create_container,
        controller,
        data=payload,
        container_service=container_service_mock,
        workspace=workspace,
    )

    container_service_mock.create_container.assert_awaited_once_with(
        payload, workspace.workspace_id
    )
    assert resp.id == container.id
    assert resp.name == "Box A"
    assert resp.location_name == "Test Location"


@pytest.mark.asyncio
async def test_list_containers(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
    location_id: UUID,
):
    """Test listing containers."""
    containers = [
        _container(location_id, name="Box A"),
        _container(location_id, name="Box B"),
    ]
    container_service_mock.get_all_containers.return_value = containers

    resp = await _call(
        controller.list_containers,
        controller,
        container_service=container_service_mock,
        workspace=workspace,
    )

    container_service_mock.get_all_containers.assert_awaited_once_with(
        workspace.workspace_id
    )
    assert len(resp) == 2
    assert [c.name for c in resp] == ["Box A", "Box B"]


@pytest.mark.asyncio
async def test_get_container(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
    location_id: UUID,
):
    """Test getting a container by ID."""
    container = _container(location_id, name="Box C")
    container_service_mock.get_container.return_value = container

    resp = await _call(
        controller.get_container,
        controller,
        container_id=container.id,
        container_service=container_service_mock,
        workspace=workspace,
    )

    container_service_mock.get_container.assert_awaited_once_with(
        container.id, workspace.workspace_id
    )
    assert resp.name == "Box C"


@pytest.mark.asyncio
async def test_get_container_not_found(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test getting a non-existent container returns 404."""
    container_service_mock.get_container.side_effect = AppError(
        ErrorCode.CONTAINER_NOT_FOUND, status_code=404
    )
    missing_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(
            controller.get_container,
            controller,
            container_id=missing_id,
            container_service=container_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_update_container(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
    location_id: UUID,
):
    """Test updating a container."""
    container = _container(location_id, name="Updated Box")
    container_service_mock.update_container.return_value = container
    payload = ContainerUpdate(name="Updated Box")

    resp = await _call(
        controller.update_container,
        controller,
        container_id=container.id,
        data=payload,
        container_service=container_service_mock,
        workspace=workspace,
    )

    container_service_mock.update_container.assert_awaited_once_with(
        container.id, payload, workspace.workspace_id
    )
    assert resp.name == "Updated Box"


@pytest.mark.asyncio
async def test_update_container_not_found(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test updating a non-existent container returns 404."""
    container_service_mock.update_container.side_effect = AppError(
        ErrorCode.CONTAINER_NOT_FOUND, status_code=404
    )
    missing_id = uuid7()
    payload = ContainerUpdate(name="Updated Name")

    with pytest.raises(HTTPException, match="404"):
        await _call(
            controller.update_container,
            controller,
            container_id=missing_id,
            data=payload,
            container_service=container_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_delete_container(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test deleting a container."""
    container_service_mock.delete_container.return_value = True
    container_id = uuid7()

    result = await _call(
        controller.delete_container,
        controller,
        container_id=container_id,
        container_service=container_service_mock,
        workspace=workspace,
    )

    container_service_mock.delete_container.assert_awaited_once_with(
        container_id, workspace.workspace_id
    )
    assert result is None


@pytest.mark.asyncio
async def test_delete_container_not_found(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test deleting a non-existent container returns 404."""
    container_service_mock.delete_container.side_effect = AppError(
        ErrorCode.CONTAINER_NOT_FOUND, status_code=404
    )
    container_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(
            controller.delete_container,
            controller,
            container_id=container_id,
            container_service=container_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_container_with_no_location(
    controller: ContainerController,
    container_service_mock: AsyncMock,
    workspace: WorkspaceContext,
    location_id: UUID,
):
    """Test container response when location is None."""
    container = _container(location_id, location=None)
    container_service_mock.get_container.return_value = container

    resp = await _call(
        controller.get_container,
        controller,
        container_id=container.id,
        container_service=container_service_mock,
        workspace=workspace,
    )

    assert resp.location_name is None
