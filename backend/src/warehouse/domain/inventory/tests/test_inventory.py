"""Tests for the inventory domain service and schemas."""

import datetime
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest

from warehouse.domain.inventory.models import Inventory
from warehouse.domain.inventory.schemas import (
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate,
    StockAdjustment,
)
from warehouse.domain.inventory.service import InventoryService


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def sample_inventory(workspace_id: UUID) -> Inventory:
    """A sample inventory record."""
    return Inventory(
        id=uuid7(),
        workspace_id=workspace_id,
        item_id=uuid7(),
        location_id=uuid7(),
        quantity=5,
    )


@pytest.fixture
def repository_mock():
    """Mocked inventory repository with async methods."""
    repo = AsyncMock()
    repo.get_by_item_and_location = AsyncMock()
    repo.add = AsyncMock()
    repo.list = AsyncMock()
    repo.get_by_id = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    return repo


@pytest.fixture
def service(repository_mock: AsyncMock) -> InventoryService:
    """Inventory service wired with mock repository."""
    return InventoryService(repository=repository_mock)


@pytest.mark.asyncio
async def test_create_inventory_success(
    service: InventoryService, repository_mock: AsyncMock, workspace_id: UUID
):
    repository_mock.get_by_item_and_location.return_value = None
    created = Inventory(id=uuid7(), workspace_id=workspace_id, item_id=uuid7(), location_id=uuid7(), quantity=3)
    repository_mock.add.return_value = created
    data = InventoryCreate(item_id=created.item_id, location_id=created.location_id, quantity=3)

    result = await service.create_inventory(data, workspace_id)

    repository_mock.get_by_item_and_location.assert_awaited_once_with(
        created.item_id, created.location_id, workspace_id
    )
    repository_mock.add.assert_awaited_once()
    sent = repository_mock.add.await_args.args[0]
    assert sent.item_id == created.item_id
    assert sent.location_id == created.location_id
    assert sent.quantity == 3
    assert sent.workspace_id == workspace_id
    assert result is created


@pytest.mark.asyncio
async def test_create_inventory_duplicate(
    service: InventoryService, repository_mock: AsyncMock, sample_inventory: Inventory, workspace_id: UUID
):
    repository_mock.get_by_item_and_location.return_value = sample_inventory
    data = InventoryCreate(
        item_id=sample_inventory.item_id,
        location_id=sample_inventory.location_id,
        quantity=1,
    )

    from warehouse.errors import AppError, ErrorCode

    with pytest.raises(AppError) as exc_info:
        await service.create_inventory(data, workspace_id)

    assert exc_info.value.code == ErrorCode.INVENTORY_DUPLICATE

    repository_mock.add.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_all_inventory(
    service: InventoryService, repository_mock: AsyncMock, sample_inventory: Inventory, workspace_id: UUID
):
    another = Inventory(id=uuid7(), workspace_id=workspace_id, item_id=uuid7(), location_id=uuid7(), quantity=2)
    repository_mock.list.return_value = [sample_inventory, another]

    result = await service.get_all_inventory(workspace_id)

    repository_mock.list.assert_awaited_once_with(workspace_id=workspace_id)
    assert result == [sample_inventory, another]


@pytest.mark.asyncio
async def test_get_inventory(service: InventoryService, repository_mock: AsyncMock, sample_inventory: Inventory, workspace_id: UUID):
    repository_mock.get_one_or_none.return_value = sample_inventory

    result = await service.get_inventory(sample_inventory.id, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_inventory.id, workspace_id=workspace_id)
    assert result is sample_inventory


@pytest.mark.asyncio
async def test_get_inventory_not_found(service: InventoryService, repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await service.get_inventory(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.INVENTORY_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_get_by_item_and_location(service: InventoryService, repository_mock: AsyncMock, sample_inventory: Inventory, workspace_id: UUID):
    repository_mock.get_by_item_and_location.return_value = sample_inventory

    result = await service.get_by_item_and_location(sample_inventory.item_id, sample_inventory.location_id, workspace_id)

    repository_mock.get_by_item_and_location.assert_awaited_once_with(
        sample_inventory.item_id, sample_inventory.location_id, workspace_id
    )
    assert result is sample_inventory


@pytest.mark.asyncio
async def test_update_inventory(service: InventoryService, repository_mock: AsyncMock, sample_inventory: Inventory, workspace_id: UUID):
    repository_mock.get_one_or_none.return_value = sample_inventory
    repository_mock.update.return_value = sample_inventory
    data = InventoryUpdate(quantity=10)

    result = await service.update_inventory(sample_inventory.id, data, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_inventory.id, workspace_id=workspace_id)
    repository_mock.update.assert_awaited_once_with(sample_inventory)
    assert sample_inventory.quantity == 10
    assert result is sample_inventory


@pytest.mark.asyncio
async def test_update_inventory_not_found(service: InventoryService, repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None
    data = InventoryUpdate(quantity=10)

    with pytest.raises(AppError) as exc_info:
        await service.update_inventory(missing_id, data, workspace_id)

    assert exc_info.value.code == ErrorCode.INVENTORY_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_adjust_stock(service: InventoryService, repository_mock: AsyncMock, sample_inventory: Inventory, workspace_id: UUID):
    repository_mock.get_one_or_none.return_value = sample_inventory
    repository_mock.update.return_value = sample_inventory
    adjustment = StockAdjustment(quantity_change=3)

    result = await service.adjust_stock(sample_inventory.id, adjustment, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_inventory.id, workspace_id=workspace_id)
    repository_mock.update.assert_awaited_once_with(sample_inventory)
    assert sample_inventory.quantity == 8
    assert result is sample_inventory


@pytest.mark.asyncio
async def test_adjust_stock_negative_raises(
    service: InventoryService, repository_mock: AsyncMock, sample_inventory: Inventory, workspace_id: UUID
):
    repository_mock.get_one_or_none.return_value = sample_inventory
    adjustment = StockAdjustment(quantity_change=-10)

    from warehouse.errors import AppError, ErrorCode

    with pytest.raises(AppError) as exc_info:
        await service.adjust_stock(sample_inventory.id, adjustment, workspace_id)

    assert exc_info.value.code == ErrorCode.INVENTORY_STOCK_NEGATIVE

    repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_adjust_stock_not_found(service: InventoryService, repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None
    adjustment = StockAdjustment(quantity_change=1)

    with pytest.raises(AppError) as exc_info:
        await service.adjust_stock(missing_id, adjustment, workspace_id)

    assert exc_info.value.code == ErrorCode.INVENTORY_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_inventory(service: InventoryService, repository_mock: AsyncMock, sample_inventory: Inventory, workspace_id: UUID):
    repository_mock.get_one_or_none.return_value = sample_inventory

    result = await service.delete_inventory(sample_inventory.id, workspace_id)

    repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_inventory.id, workspace_id=workspace_id)
    repository_mock.session.delete.assert_awaited_once_with(sample_inventory)
    assert result is True


@pytest.mark.asyncio
async def test_delete_inventory_not_found(service: InventoryService, repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await service.delete_inventory(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.INVENTORY_NOT_FOUND
    repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    repository_mock.session.delete.assert_not_awaited()


def test_inventory_schemas():
    item_id = uuid7()
    loc_id = uuid7()
    inv_id = uuid7()
    create = InventoryCreate(item_id=item_id, location_id=loc_id, quantity=2)
    update = InventoryUpdate(quantity=4)
    adjustment = StockAdjustment(quantity_change=-1)
    response = InventoryResponse(
        id=inv_id,
        item_id=item_id,
        location_id=loc_id,
        quantity=4,
        created_at=datetime.datetime(2024, 1, 1, 0, 0, 0),
        updated_at=datetime.datetime(2024, 1, 2, 0, 0, 0),
    )

    assert create.quantity == 2
    assert update.quantity == 4
    assert adjustment.quantity_change == -1
    assert response.id == inv_id

    with pytest.raises(TypeError):
        InventoryCreate()  # type: ignore[call-arg]
