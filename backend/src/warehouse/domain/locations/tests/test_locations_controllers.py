"""Controller tests for locations domain."""

from datetime import datetime
from types import SimpleNamespace
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest
from litestar.exceptions import NotFoundException

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.locations.controllers import LocationController
from warehouse.domain.locations.schemas import LocationCreate, LocationUpdate
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
def workspace(workspace_id: UUID, user_id: UUID) -> WorkspaceContext:
    """Workspace context for tests (with member role for write access)."""
    return WorkspaceContext(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=WorkspaceRole.MEMBER,
    )


@pytest.fixture
def location_service_mock() -> AsyncMock:
    svc = AsyncMock()
    svc.create_location = AsyncMock()
    svc.get_all_locations = AsyncMock()
    svc.get_location = AsyncMock()
    svc.update_location = AsyncMock()
    svc.delete_location = AsyncMock()
    return svc


@pytest.fixture
def activity_service_mock() -> AsyncMock:
    svc = AsyncMock()
    svc.log_action = AsyncMock()
    return svc


@pytest.fixture
def controller() -> LocationController:
    return LocationController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


def _location(**overrides) -> SimpleNamespace:
    defaults = {
        "id": uuid7(),
        "name": "Main",
        "zone": "A",
        "shelf": "1",
        "bin": "B",
        "description": "desc",
        "created_at": datetime(2024, 1, 1, 0, 0, 0),
        "parent_location_id": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_create_location(controller: LocationController, location_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    loc = _location()
    location_service_mock.create_location.return_value = loc
    payload = LocationCreate(name="Main", zone="A", shelf="1", bin="B", description="desc")

    resp = await _call(controller.create_location, controller, data=payload, location_service=location_service_mock, activity_service=activity_service_mock, workspace=workspace)

    location_service_mock.create_location.assert_awaited_once_with(payload, workspace.workspace_id)
    assert resp.id == loc.id
    assert resp.name == "Main"


@pytest.mark.asyncio
async def test_list_locations(controller: LocationController, location_service_mock: AsyncMock, workspace: WorkspaceContext):
    locs = [_location(name="A"), _location(name="B")]
    location_service_mock.get_all_locations.return_value = locs

    resp = await _call(controller.list_locations, controller, location_service=location_service_mock, workspace=workspace)

    location_service_mock.get_all_locations.assert_awaited_once_with(workspace.workspace_id)
    assert [l.name for l in resp] == ["A", "B"]


@pytest.mark.asyncio
async def test_get_location(controller: LocationController, location_service_mock: AsyncMock, workspace: WorkspaceContext):
    loc = _location(name="C")
    location_service_mock.get_location.return_value = loc

    resp = await _call(controller.get_location, controller, location_id=loc.id, location_service=location_service_mock, workspace=workspace)

    location_service_mock.get_location.assert_awaited_once_with(loc.id, workspace.workspace_id)
    assert resp.name == "C"


@pytest.mark.asyncio
async def test_get_location_not_found(controller: LocationController, location_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    location_service_mock.get_location.side_effect = AppError(ErrorCode.LOCATION_NOT_FOUND, status_code=404)
    missing_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(controller.get_location, controller, location_id=missing_id, location_service=location_service_mock, workspace=workspace)


@pytest.mark.asyncio
async def test_update_location(controller: LocationController, location_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    loc = _location()
    location_service_mock.get_location.return_value = _location(name="Old Name")
    location_service_mock.update_location.return_value = loc
    payload = LocationUpdate(name="Updated")

    resp = await _call(
        controller.update_location, controller, location_id=loc.id, data=payload, location_service=location_service_mock, activity_service=activity_service_mock, workspace=workspace
    )

    location_service_mock.update_location.assert_awaited_once_with(loc.id, payload, workspace.workspace_id)
    assert resp.name == loc.name


@pytest.mark.asyncio
async def test_update_location_not_found(controller: LocationController, location_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    location_service_mock.get_location.side_effect = AppError(ErrorCode.LOCATION_NOT_FOUND, status_code=404)
    missing_id = uuid7()
    payload = LocationUpdate(name="Updated")

    with pytest.raises(HTTPException, match="404"):
        await _call(
            controller.update_location,
            controller,
            location_id=missing_id,
            data=payload,
            location_service=location_service_mock,
            activity_service=activity_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_delete_location(controller: LocationController, location_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    loc_id = uuid7()
    loc = _location(id=loc_id)
    location_service_mock.get_location.return_value = loc
    location_service_mock.delete_location.return_value = True

    result = await _call(controller.delete_location, controller, location_id=loc_id, location_service=location_service_mock, activity_service=activity_service_mock, workspace=workspace)

    location_service_mock.delete_location.assert_awaited_once_with(loc_id, workspace.workspace_id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_location_not_found(controller: LocationController, location_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    location_service_mock.get_location.side_effect = AppError(ErrorCode.LOCATION_NOT_FOUND, status_code=404)
    loc_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(controller.delete_location, controller, location_id=loc_id, location_service=location_service_mock, activity_service=activity_service_mock, workspace=workspace)
