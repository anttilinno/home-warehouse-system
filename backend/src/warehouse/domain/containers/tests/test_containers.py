"""Tests for the containers domain service and schemas."""

from datetime import datetime
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest

from warehouse.domain.containers.models import Container
from warehouse.domain.containers.schemas import (
    ContainerCreate,
    ContainerResponse,
    ContainerUpdate,
)
from warehouse.domain.containers.service import ContainerService
from warehouse.errors import AppError, ErrorCode


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def location_id() -> UUID:
    """A sample location ID."""
    return uuid7()


@pytest.fixture
def sample_container(workspace_id: UUID, location_id: UUID) -> Container:
    """A sample container instance."""
    return Container(
        id=uuid7(),
        workspace_id=workspace_id,
        name="Box A",
        location_id=location_id,
        description="Storage box",
        capacity="10 items",
        short_code="BOX-A",
        created_at=datetime(2024, 1, 1, 12, 0, 0),
        updated_at=datetime(2024, 1, 1, 12, 0, 0),
    )


@pytest.fixture
def repository_mock():
    """Mocked repository with async methods."""
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.list = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    repo.session = AsyncMock()
    repo.session.commit = AsyncMock()
    repo.session.delete = AsyncMock()
    return repo


@pytest.fixture
def service(repository_mock: AsyncMock) -> ContainerService:
    """Container service wired with mocked repository."""
    return ContainerService(repository=repository_mock)


@pytest.mark.asyncio
async def test_create_container(
    service: ContainerService,
    repository_mock: AsyncMock,
    workspace_id: UUID,
    location_id: UUID,
):
    """Test creating a new container."""
    container_data = ContainerCreate(
        name="New Box",
        location_id=location_id,
        description="A new box",
        capacity="5 items",
        short_code="NEW-BOX",
    )
    created_container = Container(
        id=uuid7(),
        workspace_id=workspace_id,
        name=container_data.name,
        location_id=container_data.location_id,
        description=container_data.description,
        capacity=container_data.capacity,
        short_code=container_data.short_code,
        created_at=datetime(2024, 2, 2, 10, 0, 0),
        updated_at=datetime(2024, 2, 2, 10, 0, 0),
    )
    repository_mock.add.return_value = created_container

    result = await service.create_container(container_data, workspace_id)

    repository_mock.add.assert_awaited_once()
    sent_container = repository_mock.add.await_args.args[0]
    assert sent_container.name == container_data.name
    assert sent_container.location_id == container_data.location_id
    assert sent_container.description == container_data.description
    assert sent_container.capacity == container_data.capacity
    assert sent_container.short_code == container_data.short_code
    assert sent_container.workspace_id == workspace_id
    repository_mock.session.commit.assert_awaited_once()
    assert result is created_container


@pytest.mark.asyncio
async def test_get_all_containers(
    service: ContainerService,
    repository_mock: AsyncMock,
    sample_container: Container,
    workspace_id: UUID,
):
    """Test getting all containers for a workspace."""
    another_container = Container(
        id=uuid7(),
        workspace_id=workspace_id,
        name="Box B",
        location_id=uuid7(),
        description=None,
        capacity=None,
        short_code="BOX-B",
        created_at=datetime(2024, 1, 2, 9, 0, 0),
        updated_at=datetime(2024, 1, 2, 9, 0, 0),
    )
    repository_mock.list.return_value = [sample_container, another_container]

    result = await service.get_all_containers(workspace_id)

    repository_mock.list.assert_awaited_once_with(workspace_id=workspace_id)
    assert result == [sample_container, another_container]


@pytest.mark.asyncio
async def test_get_container(
    service: ContainerService,
    repository_mock: AsyncMock,
    sample_container: Container,
    workspace_id: UUID,
):
    """Test getting a container by ID."""
    repository_mock.get_one_or_none.return_value = sample_container

    result = await service.get_container(sample_container.id, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(
        id=sample_container.id, workspace_id=workspace_id
    )
    assert result is sample_container


@pytest.mark.asyncio
async def test_get_container_not_found(
    service: ContainerService,
    repository_mock: AsyncMock,
    workspace_id: UUID,
):
    """Test getting a non-existent container raises error."""
    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await service.get_container(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.CONTAINER_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(
        id=missing_id, workspace_id=workspace_id
    )


@pytest.mark.asyncio
async def test_update_container(
    service: ContainerService,
    repository_mock: AsyncMock,
    sample_container: Container,
    workspace_id: UUID,
):
    """Test updating a container."""
    repository_mock.get_one_or_none.return_value = sample_container
    repository_mock.update.return_value = sample_container
    update_data = ContainerUpdate(name="Updated Box", description="Updated desc")

    result = await service.update_container(sample_container.id, update_data, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(
        id=sample_container.id, workspace_id=workspace_id
    )
    repository_mock.update.assert_awaited_once_with(sample_container)
    repository_mock.session.commit.assert_awaited_once()
    assert sample_container.name == "Updated Box"
    assert sample_container.description == "Updated desc"
    assert result is sample_container


@pytest.mark.asyncio
async def test_update_container_partial(
    service: ContainerService,
    repository_mock: AsyncMock,
    sample_container: Container,
    workspace_id: UUID,
):
    """Test partial update only changes specified fields."""
    original_name = sample_container.name
    original_description = sample_container.description
    repository_mock.get_one_or_none.return_value = sample_container
    repository_mock.update.return_value = sample_container
    update_data = ContainerUpdate(capacity="20 items")

    await service.update_container(sample_container.id, update_data, workspace_id)

    assert sample_container.name == original_name
    assert sample_container.description == original_description
    assert sample_container.capacity == "20 items"


@pytest.mark.asyncio
async def test_update_container_not_found(
    service: ContainerService,
    repository_mock: AsyncMock,
    workspace_id: UUID,
):
    """Test updating a non-existent container raises error."""
    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None
    update_data = ContainerUpdate(name="Updated Name")

    with pytest.raises(AppError) as exc_info:
        await service.update_container(missing_id, update_data, workspace_id)

    assert exc_info.value.code == ErrorCode.CONTAINER_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(
        id=missing_id, workspace_id=workspace_id
    )
    repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_container(
    service: ContainerService,
    repository_mock: AsyncMock,
    sample_container: Container,
    workspace_id: UUID,
):
    """Test deleting a container."""
    repository_mock.get_one_or_none.return_value = sample_container

    result = await service.delete_container(sample_container.id, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(
        id=sample_container.id, workspace_id=workspace_id
    )
    repository_mock.session.delete.assert_awaited_once_with(sample_container)
    repository_mock.session.commit.assert_awaited_once()
    assert result is True


@pytest.mark.asyncio
async def test_delete_container_not_found(
    service: ContainerService,
    repository_mock: AsyncMock,
    workspace_id: UUID,
):
    """Test deleting a non-existent container raises error."""
    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await service.delete_container(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.CONTAINER_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(
        id=missing_id, workspace_id=workspace_id
    )
    repository_mock.session.delete.assert_not_awaited()


class TestContainerSchemas:
    """Tests for container schemas."""

    def test_container_create_schema(self):
        location_id = uuid7()
        create = ContainerCreate(
            name="Box A",
            location_id=location_id,
            description="A box",
            capacity="10 items",
            short_code="BOX-A",
        )
        assert create.name == "Box A"
        assert create.location_id == location_id
        assert create.description == "A box"
        assert create.capacity == "10 items"
        assert create.short_code == "BOX-A"

    def test_container_create_schema_minimal(self):
        location_id = uuid7()
        create = ContainerCreate(name="Box B", location_id=location_id)
        assert create.name == "Box B"
        assert create.location_id == location_id
        assert create.description is None
        assert create.capacity is None
        assert create.short_code is None

    def test_container_update_schema(self):
        update = ContainerUpdate()
        assert update.name is None
        assert update.location_id is None
        assert update.description is None
        assert update.capacity is None
        assert update.short_code is None

    def test_container_update_schema_with_values(self):
        location_id = uuid7()
        update = ContainerUpdate(
            name="Updated",
            location_id=location_id,
            description="Updated desc",
        )
        assert update.name == "Updated"
        assert update.location_id == location_id
        assert update.description == "Updated desc"

    def test_container_response_schema(self):
        container_id = uuid7()
        location_id = uuid7()
        created_at = datetime(2024, 3, 3, 8, 30, 0)
        updated_at = datetime(2024, 3, 3, 9, 30, 0)
        response = ContainerResponse(
            id=container_id,
            name="Container X",
            location_id=location_id,
            location_name="Garage",
            description="A container",
            capacity="15 items",
            short_code="X-001",
            created_at=created_at,
            updated_at=updated_at,
        )
        assert response.id == container_id
        assert response.name == "Container X"
        assert response.location_id == location_id
        assert response.location_name == "Garage"
        assert response.description == "A container"
        assert response.capacity == "15 items"
        assert response.short_code == "X-001"
        assert response.created_at == created_at
        assert response.updated_at == updated_at
