"""Controller tests for inventory domain."""

import datetime
from types import SimpleNamespace
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest
from litestar.exceptions import NotFoundException

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.inventory.controllers import InventoryController
from warehouse.domain.inventory.schemas import InventoryCreate, InventoryUpdate, StockAdjustment
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
def inventory_service_mock() -> AsyncMock:
    service = AsyncMock()
    service.create_inventory = AsyncMock()
    service.get_all_inventory = AsyncMock()
    service.get_inventory = AsyncMock()
    service.update_inventory = AsyncMock()
    service.adjust_stock = AsyncMock()
    service.delete_inventory = AsyncMock()
    return service


@pytest.fixture
def controller() -> InventoryController:
    return InventoryController(owner=None)


async def _call(handler, controller: InventoryController, **kwargs):
    """Invoke handler underlying function with controller injected."""
    return await handler.fn(controller, **kwargs)


def _inventory(**overrides) -> SimpleNamespace:
    defaults = {
        "id": uuid7(),
        "item_id": uuid7(),
        "location_id": uuid7(),
        "quantity": 5,
        "expiration_date": None,
        "warranty_expires": None,
        "created_at": datetime.datetime(2024, 1, 1, 0, 0, 0),
        "updated_at": datetime.datetime(2024, 1, 2, 0, 0, 0),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_create_inventory_maps_response(
    controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext
):
    inv = _inventory(quantity=3)
    inventory_service_mock.create_inventory.return_value = inv
    payload = InventoryCreate(item_id=inv.item_id, location_id=inv.location_id, quantity=3)

    resp = await _call(controller.create_inventory, controller, data=payload, inventory_service=inventory_service_mock, workspace=workspace)

    inventory_service_mock.create_inventory.assert_awaited_once_with(payload, workspace.workspace_id)
    assert resp.id == inv.id
    assert resp.quantity == 3
    assert resp.item_id == inv.item_id
    assert resp.location_id == inv.location_id
    assert resp.created_at == inv.created_at
    assert resp.updated_at == inv.updated_at


@pytest.mark.asyncio
async def test_list_inventory_maps_all(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    inv1 = _inventory(quantity=1)
    inv2 = _inventory(quantity=2)
    inventory_service_mock.get_all_inventory.return_value = [inv1, inv2]

    resp = await _call(controller.list_inventory, controller, inventory_service=inventory_service_mock, workspace=workspace)

    inventory_service_mock.get_all_inventory.assert_awaited_once_with(workspace.workspace_id)
    assert [r.id for r in resp] == [inv1.id, inv2.id]
    assert resp[1].quantity == 2


@pytest.mark.asyncio
async def test_get_inventory_success(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    inv = _inventory(quantity=7)
    inventory_service_mock.get_inventory.return_value = inv

    resp = await _call(controller.get_inventory, controller, inventory_id=inv.id, inventory_service=inventory_service_mock, workspace=workspace)

    inventory_service_mock.get_inventory.assert_awaited_once_with(inv.id, workspace.workspace_id)
    assert resp.id == inv.id
    assert resp.quantity == 7


@pytest.mark.asyncio
async def test_get_inventory_not_found_raises(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    missing_id = uuid7()
    inventory_service_mock.get_inventory.side_effect = AppError(ErrorCode.INVENTORY_NOT_FOUND, status_code=404)

    with pytest.raises(HTTPException, match="404"):
        await _call(controller.get_inventory, controller, inventory_id=missing_id, inventory_service=inventory_service_mock, workspace=workspace)


@pytest.mark.asyncio
async def test_update_inventory_success(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    inv = _inventory(quantity=5)
    inventory_service_mock.update_inventory.return_value = inv
    payload = InventoryUpdate(quantity=9)

    resp = await _call(
        controller.update_inventory,
        controller,
        inventory_id=inv.id,
        data=payload,
        inventory_service=inventory_service_mock,
        workspace=workspace,
    )

    inventory_service_mock.update_inventory.assert_awaited_once_with(inv.id, payload, workspace.workspace_id)
    assert resp.quantity == 5


@pytest.mark.asyncio
async def test_update_inventory_not_found(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    missing_id = uuid7()
    inventory_service_mock.update_inventory.side_effect = AppError(ErrorCode.INVENTORY_NOT_FOUND, status_code=404)
    payload = InventoryUpdate(quantity=9)

    with pytest.raises(HTTPException, match="404"):
        await _call(
            controller.update_inventory,
            controller,
            inventory_id=missing_id,
            data=payload,
            inventory_service=inventory_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_adjust_stock_success(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    inv = _inventory(quantity=10)
    inventory_service_mock.adjust_stock.return_value = inv
    payload = StockAdjustment(quantity_change=-2)

    resp = await _call(
        controller.adjust_stock,
        controller,
        inventory_id=inv.id,
        data=payload,
        inventory_service=inventory_service_mock,
        workspace=workspace,
    )

    inventory_service_mock.adjust_stock.assert_awaited_once_with(inv.id, payload, workspace.workspace_id)
    assert resp.quantity == 10


@pytest.mark.asyncio
async def test_adjust_stock_not_found(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    missing_id = uuid7()
    inventory_service_mock.adjust_stock.side_effect = AppError(ErrorCode.INVENTORY_NOT_FOUND, status_code=404)
    payload = StockAdjustment(quantity_change=1)

    with pytest.raises(HTTPException, match="404"):
        await _call(
            controller.adjust_stock,
            controller,
            inventory_id=missing_id,
            data=payload,
            inventory_service=inventory_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_delete_inventory_success(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    inv_id = uuid7()
    inventory_service_mock.delete_inventory.return_value = True

    result = await _call(
        controller.delete_inventory, controller, inventory_id=inv_id, inventory_service=inventory_service_mock, workspace=workspace
    )

    inventory_service_mock.delete_inventory.assert_awaited_once_with(inv_id, workspace.workspace_id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_inventory_not_found(controller: InventoryController, inventory_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    inv_id = uuid7()
    inventory_service_mock.delete_inventory.side_effect = AppError(ErrorCode.INVENTORY_NOT_FOUND, status_code=404)

    with pytest.raises(HTTPException, match="404"):
        await _call(
            controller.delete_inventory, controller, inventory_id=inv_id, inventory_service=inventory_service_mock, workspace=workspace
        )
