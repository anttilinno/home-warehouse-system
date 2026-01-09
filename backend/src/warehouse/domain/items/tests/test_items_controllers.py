"""Controller tests for items domain."""

import datetime
from types import SimpleNamespace
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest
from litestar.exceptions import NotFoundException

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.items.controllers import CategoryController, ItemController
from warehouse.domain.items.schemas import CategoryCreate, CategoryUpdate, ItemCreate, ItemUpdate
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
def category_service_mock() -> AsyncMock:
    svc = AsyncMock()
    svc.create_category = AsyncMock()
    svc.get_all_categories = AsyncMock()
    svc.update_category = AsyncMock()
    svc.delete_category = AsyncMock()
    return svc


@pytest.fixture
def item_service_mock() -> AsyncMock:
    svc = AsyncMock()
    svc.create_item = AsyncMock()
    svc.get_all_items = AsyncMock()
    svc.get_item = AsyncMock()
    svc.update_item = AsyncMock()
    svc.delete_item = AsyncMock()
    return svc


@pytest.fixture
def activity_service_mock() -> AsyncMock:
    svc = AsyncMock()
    svc.log_action = AsyncMock()
    return svc


@pytest.fixture
def category_controller() -> CategoryController:
    return CategoryController(owner=None)


@pytest.fixture
def item_controller() -> ItemController:
    return ItemController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


def _category(**overrides) -> SimpleNamespace:
    defaults = {
        "id": uuid7(),
        "name": "Tools",
        "parent_category_id": None,
        "description": "desc",
        "created_at": datetime.datetime(2024, 1, 1, 0, 0, 0),
        "updated_at": datetime.datetime(2024, 1, 1, 0, 0, 0),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _item(**overrides) -> SimpleNamespace:
    defaults = {
        "id": uuid7(),
        "sku": "SKU1",
        "name": "Hammer",
        "description": "d",
        "category_id": uuid7(),
        "short_code": None,
        "created_at": datetime.datetime(2024, 1, 2, 0, 0, 0),
        "updated_at": datetime.datetime(2024, 1, 3, 0, 0, 0),
        "obsidian_vault_path": None,
        "obsidian_note_path": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_create_category(category_controller: CategoryController, category_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    cat = _category()
    category_service_mock.create_category.return_value = cat
    payload = CategoryCreate(name="Tools")

    resp = await _call(
        category_controller.create_category,
        category_controller,
        data=payload,
        category_service=category_service_mock,
        activity_service=activity_service_mock,
        workspace=workspace,
    )

    category_service_mock.create_category.assert_awaited_once_with(payload, workspace.workspace_id)
    assert resp.id == cat.id
    assert resp.parent_category_id == cat.parent_category_id
    assert resp.created_at == cat.created_at


@pytest.mark.asyncio
async def test_list_categories(category_controller: CategoryController, category_service_mock: AsyncMock, workspace: WorkspaceContext):
    cats = [_category(name="A"), _category(name="B")]
    category_service_mock.get_all_categories.return_value = cats

    resp = await _call(
        category_controller.list_categories, category_controller, category_service=category_service_mock, workspace=workspace
    )

    category_service_mock.get_all_categories.assert_awaited_once_with(workspace.workspace_id)
    assert [r.name for r in resp] == ["A", "B"]


@pytest.mark.asyncio
async def test_delete_category_success(category_controller: CategoryController, category_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    cat_id = uuid7()
    cat = _category(id=cat_id)
    category_service_mock.get_category.return_value = cat
    category_service_mock.delete_category.return_value = True

    result = await _call(
        category_controller.delete_category,
        category_controller,
        category_id=cat_id,
        category_service=category_service_mock,
        activity_service=activity_service_mock,
        workspace=workspace,
    )

    category_service_mock.delete_category.assert_awaited_once_with(cat_id, workspace.workspace_id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_category_not_found(category_controller: CategoryController, category_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    cat_id = uuid7()
    category_service_mock.get_category.side_effect = AppError(ErrorCode.CATEGORY_NOT_FOUND, status_code=404)

    with pytest.raises(HTTPException, match="404"):
        await _call(
            category_controller.delete_category,
            category_controller,
            category_id=cat_id,
            category_service=category_service_mock,
            activity_service=activity_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_update_category(category_controller: CategoryController, category_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    cat = _category(name="Updated Name", description="Updated description")
    category_service_mock.get_category.return_value = _category(name="Old Name")
    category_service_mock.update_category.return_value = cat
    payload = CategoryUpdate(name="Updated Name", description="Updated description")

    resp = await _call(
        category_controller.update_category,
        category_controller,
        category_id=cat.id,
        data=payload,
        category_service=category_service_mock,
        activity_service=activity_service_mock,
        workspace=workspace,
    )

    category_service_mock.update_category.assert_awaited_once_with(cat.id, payload, workspace.workspace_id)
    assert resp.id == cat.id
    assert resp.name == "Updated Name"
    assert resp.description == "Updated description"
    assert resp.created_at == cat.created_at


@pytest.mark.asyncio
async def test_update_category_not_found(category_controller: CategoryController, category_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    cat_id = uuid7()
    category_service_mock.get_category.side_effect = AppError(ErrorCode.CATEGORY_NOT_FOUND, status_code=404)
    payload = CategoryUpdate(name="New Name")

    with pytest.raises(HTTPException, match="404"):
        await _call(
            category_controller.update_category,
            category_controller,
            category_id=cat_id,
            data=payload,
            category_service=category_service_mock,
            activity_service=activity_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_create_item(item_controller: ItemController, item_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    item = _item()
    item_service_mock.create_item.return_value = item
    payload = ItemCreate(sku="SKU1", name="Hammer", description="d", category_id=item.category_id)

    resp = await _call(item_controller.create_item, item_controller, data=payload, item_service=item_service_mock, activity_service=activity_service_mock, workspace=workspace)

    item_service_mock.create_item.assert_awaited_once_with(payload, workspace.workspace_id)
    assert resp.id == item.id
    assert resp.sku == "SKU1"
    assert resp.created_at == item.created_at


@pytest.mark.asyncio
async def test_list_items(item_controller: ItemController, item_service_mock: AsyncMock, workspace: WorkspaceContext):
    items = [_item(name="Hammer"), _item(name="Screwdriver")]
    item_service_mock.get_all_items.return_value = items

    resp = await _call(item_controller.list_items, item_controller, item_service=item_service_mock, workspace=workspace)

    item_service_mock.get_all_items.assert_awaited_once_with(workspace.workspace_id)
    assert [r.name for r in resp] == ["Hammer", "Screwdriver"]


@pytest.mark.asyncio
async def test_get_item(item_controller: ItemController, item_service_mock: AsyncMock, workspace: WorkspaceContext):
    item = _item(name="Saw")
    item_service_mock.get_item.return_value = item

    resp = await _call(item_controller.get_item, item_controller, item_id=item.id, item_service=item_service_mock, workspace=workspace)

    item_service_mock.get_item.assert_awaited_once_with(item.id, workspace.workspace_id)
    assert resp.name == "Saw"


@pytest.mark.asyncio
async def test_get_item_not_found(item_controller: ItemController, item_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    item_id = uuid7()
    item_service_mock.get_item.side_effect = AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)

    with pytest.raises(HTTPException, match="404"):
        await _call(item_controller.get_item, item_controller, item_id=item_id, item_service=item_service_mock, workspace=workspace)


@pytest.mark.asyncio
async def test_update_item(item_controller: ItemController, item_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    item = _item()
    item_service_mock.get_item.return_value = _item(name="Old Name")
    item_service_mock.update_item.return_value = item
    payload = ItemUpdate(name="New")

    resp = await _call(
        item_controller.update_item, item_controller, item_id=item.id, data=payload, item_service=item_service_mock, activity_service=activity_service_mock, workspace=workspace
    )

    item_service_mock.update_item.assert_awaited_once_with(item.id, payload, workspace.workspace_id)
    assert resp.name == item.name


@pytest.mark.asyncio
async def test_update_item_not_found(item_controller: ItemController, item_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    item_id = uuid7()
    item_service_mock.get_item.side_effect = AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)
    payload = ItemUpdate(name="New")

    with pytest.raises(HTTPException, match="404"):
        await _call(
            item_controller.update_item, item_controller, item_id=item_id, data=payload, item_service=item_service_mock, activity_service=activity_service_mock, workspace=workspace
        )


@pytest.mark.asyncio
async def test_delete_item_success(item_controller: ItemController, item_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    item_id = uuid7()
    item = _item(id=item_id)
    item_service_mock.get_item.return_value = item
    item_service_mock.delete_item.return_value = True

    result = await _call(
        item_controller.delete_item, item_controller, item_id=item_id, item_service=item_service_mock, activity_service=activity_service_mock, workspace=workspace
    )

    item_service_mock.delete_item.assert_awaited_once_with(item_id, workspace.workspace_id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_item_not_found(item_controller: ItemController, item_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    item_id = uuid7()
    item_service_mock.get_item.side_effect = AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)

    with pytest.raises(HTTPException, match="404"):
        await _call(
            item_controller.delete_item, item_controller, item_id=item_id, item_service=item_service_mock, activity_service=activity_service_mock, workspace=workspace
        )
