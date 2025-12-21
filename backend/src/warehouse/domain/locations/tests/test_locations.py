"""Tests for the locations domain service and schemas."""

from datetime import datetime
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest

from warehouse.domain.locations.models import Location
from warehouse.domain.locations.schemas import (
    LocationCreate,
    LocationResponse,
    LocationUpdate,
)
from warehouse.domain.locations.service import LocationService


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def sample_location(workspace_id: UUID) -> Location:
    """A sample location instance."""
    return Location(
        id=uuid7(),
        workspace_id=workspace_id,
        name="Main Shelf",
        zone="A",
        shelf="1",
        bin="B",
        description="Primary storage",
        created_at=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def repository_mock():
    """Mocked repository with async methods."""
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.list = AsyncMock()
    repo.get_by_id = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    return repo


@pytest.fixture
def service(repository_mock: AsyncMock) -> LocationService:
    """Location service wired with mocked repository."""
    return LocationService(repository=repository_mock)


@pytest.mark.asyncio
async def test_create_location(service: LocationService, repository_mock: AsyncMock, workspace_id: UUID):
    location_data = LocationCreate(
        name="New Location",
        zone="Z1",
        shelf="S2",
        bin="B3",
        description="A new spot",
    )
    created_location = Location(
        id=uuid7(),
        workspace_id=workspace_id,
        name=location_data.name,
        zone=location_data.zone,
        shelf=location_data.shelf,
        bin=location_data.bin,
        description=location_data.description,
        created_at=datetime(2024, 2, 2, 10, 0, 0),
    )
    repository_mock.add.return_value = created_location

    result = await service.create_location(location_data, workspace_id)

    repository_mock.add.assert_awaited_once()
    sent_location = repository_mock.add.await_args.args[0]
    assert sent_location.name == location_data.name
    assert sent_location.zone == location_data.zone
    assert sent_location.shelf == location_data.shelf
    assert sent_location.bin == location_data.bin
    assert sent_location.description == location_data.description
    assert sent_location.workspace_id == workspace_id
    assert result is created_location


@pytest.mark.asyncio
async def test_get_all_locations(service: LocationService, repository_mock: AsyncMock, sample_location: Location, workspace_id: UUID):
    another_location = Location(
        id=uuid7(),
        workspace_id=workspace_id,
        name="Secondary",
        zone="B",
        shelf="2",
        bin="C",
        description=None,
        created_at=datetime(2024, 1, 2, 9, 0, 0),
    )
    repository_mock.list.return_value = [sample_location, another_location]

    result = await service.get_all_locations(workspace_id)

    repository_mock.list.assert_awaited_once_with(workspace_id=workspace_id)
    assert result == [sample_location, another_location]


@pytest.mark.asyncio
async def test_get_location(service: LocationService, repository_mock: AsyncMock, sample_location: Location, workspace_id: UUID):
    repository_mock.get_one_or_none.return_value = sample_location

    result = await service.get_location(sample_location.id, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_location.id, workspace_id=workspace_id)
    assert result is sample_location


@pytest.mark.asyncio
async def test_get_location_not_found(service: LocationService, repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await service.get_location(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.LOCATION_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_update_location(service: LocationService, repository_mock: AsyncMock, sample_location: Location, workspace_id: UUID):
    repository_mock.get_one_or_none.return_value = sample_location
    repository_mock.update.return_value = sample_location
    update_data = LocationUpdate(name="Updated Name", description="Updated desc")

    result = await service.update_location(sample_location.id, update_data, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_location.id, workspace_id=workspace_id)
    repository_mock.update.assert_awaited_once_with(sample_location)
    assert sample_location.name == "Updated Name"
    assert sample_location.description == "Updated desc"
    assert sample_location.zone == "A"
    assert sample_location.shelf == "1"
    assert sample_location.bin == "B"
    assert result is sample_location


@pytest.mark.asyncio
async def test_update_location_not_found(service: LocationService, repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None
    update_data = LocationUpdate(name="Updated Name")

    with pytest.raises(AppError) as exc_info:
        await service.update_location(missing_id, update_data, workspace_id)

    assert exc_info.value.code == ErrorCode.LOCATION_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_location(service: LocationService, repository_mock: AsyncMock, sample_location: Location, workspace_id: UUID):
    repository_mock.get_one_or_none.return_value = sample_location

    result = await service.delete_location(sample_location.id, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_location.id, workspace_id=workspace_id)
    repository_mock.session.delete.assert_awaited_once_with(sample_location)
    assert result is True


@pytest.mark.asyncio
async def test_delete_location_not_found(service: LocationService, repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await service.delete_location(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.LOCATION_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    repository_mock.session.delete.assert_not_awaited()


def test_location_create_schema():
    create = LocationCreate(name="Shelf A")

    assert create.name == "Shelf A"
    assert create.zone is None
    assert create.shelf is None
    assert create.bin is None
    assert create.description is None

    with pytest.raises(TypeError):
        LocationCreate()  # type: ignore[call-arg]


def test_location_update_schema():
    update = LocationUpdate()

    assert update.name is None
    assert update.zone is None
    assert update.shelf is None
    assert update.bin is None
    assert update.description is None


def test_location_response_schema():
    location_id = uuid7()
    created_at = datetime(2024, 3, 3, 8, 30, 0)
    response = LocationResponse(
        id=location_id,
        name="Zone X",
        zone="X",
        shelf="Top",
        bin="1",
        description="Response payload",
        created_at=created_at,
    )

    assert response.id == location_id
    assert response.name == "Zone X"
    assert response.zone == "X"
    assert response.shelf == "Top"
    assert response.bin == "1"
    assert response.description == "Response payload"
    assert response.created_at == created_at


@pytest.mark.asyncio
async def test_update_location_updates_optional_fields(service: LocationService, repository_mock: AsyncMock, sample_location: Location, workspace_id: UUID):
    repository_mock.get_one_or_none.return_value = sample_location
    repository_mock.update.return_value = sample_location
    update_data = LocationUpdate(zone="Z", shelf="S", bin="BIN")

    result = await service.update_location(sample_location.id, update_data, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_location.id, workspace_id=workspace_id)
    assert sample_location.zone == "Z"
    assert sample_location.shelf == "S"
    assert sample_location.bin == "BIN"
    assert result is sample_location
