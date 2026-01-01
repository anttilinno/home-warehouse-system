"""Tests for the items domain services and schemas."""

import datetime
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest

from conftest import TEST_ITEM_HAMMER, TEST_NOTE_PATH, TEST_VAULT_PATH
from warehouse.domain.items.models import Category, Item
from warehouse.domain.items.schemas import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
)
from warehouse.domain.items.service import CategoryService, ItemService


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def category_repository_mock():
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.list = AsyncMock()
    repo.get_by_id = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.update = AsyncMock()
    repo.session = AsyncMock()
    repo.session.commit = AsyncMock()
    repo.session.delete = AsyncMock()
    return repo


@pytest.fixture
def item_repository_mock():
    repo = AsyncMock()
    repo.get_by_sku = AsyncMock()
    repo.add = AsyncMock()
    repo.list = AsyncMock()
    repo.get_by_id = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    return repo


@pytest.fixture
def category_service(category_repository_mock: AsyncMock) -> CategoryService:
    return CategoryService(repository=category_repository_mock)


@pytest.fixture
def item_service(item_repository_mock: AsyncMock) -> ItemService:
    return ItemService(repository=item_repository_mock)


@pytest.fixture
def sample_category(workspace_id: UUID) -> Category:
    return Category(
        id=uuid7(),
        workspace_id=workspace_id,
        name="Tools",
        parent_category_id=None,
        description="Tooling",
        created_at=datetime.datetime(2024, 1, 1, 0, 0, 0),
    )


@pytest.fixture
def sample_item(sample_category: Category, workspace_id: UUID) -> Item:
    return Item(
        id=uuid7(),
        workspace_id=workspace_id,
        sku="SKU-1",
        name="Hammer",
        description=TEST_ITEM_HAMMER,
        category_id=sample_category.id,
        created_at=datetime.datetime(2024, 1, 2, 0, 0, 0),
        updated_at=datetime.datetime(2024, 1, 3, 0, 0, 0),
        obsidian_vault_path=None,
        obsidian_note_path=None,
    )


@pytest.mark.asyncio
async def test_create_category(category_service: CategoryService, category_repository_mock: AsyncMock, workspace_id: UUID):
    parent_id = uuid7()
    category_repository_mock.add.return_value = category = Category(
        id=uuid7(),
        workspace_id=workspace_id,
        name="Supplies",
        parent_category_id=parent_id,
        description=None,
        created_at=datetime.datetime(2024, 1, 1, 0, 0, 0),
    )
    data = CategoryCreate(name="Supplies", parent_category_id=parent_id, description=None)

    result = await category_service.create_category(data, workspace_id)

    category_repository_mock.add.assert_awaited_once()
    category_repository_mock.session.commit.assert_awaited_once()
    sent = category_repository_mock.add.await_args.args[0]
    assert sent.name == "Supplies"
    assert sent.parent_category_id == parent_id
    assert sent.workspace_id == workspace_id
    assert result is category


@pytest.mark.asyncio
async def test_get_all_categories(category_service: CategoryService, category_repository_mock: AsyncMock, sample_category: Category, workspace_id: UUID):
    category_repository_mock.list.return_value = [sample_category]

    result = await category_service.get_all_categories(workspace_id)

    category_repository_mock.list.assert_awaited_once_with(workspace_id=workspace_id)
    assert result == [sample_category]


@pytest.mark.asyncio
async def test_get_category(category_service: CategoryService, category_repository_mock: AsyncMock, sample_category: Category, workspace_id: UUID):
    category_repository_mock.get_one_or_none.return_value = sample_category

    result = await category_service.get_category(sample_category.id, workspace_id)

    category_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_category.id, workspace_id=workspace_id)
    assert result is sample_category


@pytest.mark.asyncio
async def test_get_category_not_found(category_service: CategoryService, category_repository_mock: AsyncMock, workspace_id: UUID):
    missing_id = uuid7()
    category_repository_mock.get_one_or_none.return_value = None

    result = await category_service.get_category(missing_id, workspace_id)

    category_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_category(category_service: CategoryService, category_repository_mock: AsyncMock, sample_category: Category, workspace_id: UUID):
    category_repository_mock.get_one_or_none.return_value = sample_category

    result = await category_service.delete_category(sample_category.id, workspace_id)

    category_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_category.id, workspace_id=workspace_id)
    category_repository_mock.session.delete.assert_awaited_once_with(sample_category)
    category_repository_mock.session.commit.assert_awaited_once()
    assert result is True


@pytest.mark.asyncio
async def test_delete_category_not_found(category_service: CategoryService, category_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    category_repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await category_service.delete_category(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.CATEGORY_NOT_FOUND
    category_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    category_repository_mock.session.delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_category(category_service: CategoryService, category_repository_mock: AsyncMock, sample_category: Category, workspace_id: UUID):
    category_repository_mock.get_one_or_none.return_value = sample_category
    category_repository_mock.update.return_value = sample_category
    new_parent_id = uuid7()
    data = CategoryUpdate(name="Updated Tools", description="New description", parent_category_id=new_parent_id)

    result = await category_service.update_category(sample_category.id, data, workspace_id)

    category_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_category.id, workspace_id=workspace_id)
    category_repository_mock.update.assert_awaited_once_with(sample_category)
    category_repository_mock.session.commit.assert_awaited_once()
    assert sample_category.name == "Updated Tools"
    assert sample_category.description == "New description"
    assert sample_category.parent_category_id == new_parent_id
    assert result is sample_category


@pytest.mark.asyncio
async def test_update_category_partial(category_service: CategoryService, category_repository_mock: AsyncMock, sample_category: Category, workspace_id: UUID):
    """Test that partial updates only modify specified fields."""
    original_description = sample_category.description
    original_parent = sample_category.parent_category_id
    category_repository_mock.get_one_or_none.return_value = sample_category
    category_repository_mock.update.return_value = sample_category
    data = CategoryUpdate(name="Only Name Changed")

    result = await category_service.update_category(sample_category.id, data, workspace_id)

    category_repository_mock.update.assert_awaited_once_with(sample_category)
    assert sample_category.name == "Only Name Changed"
    # These should remain unchanged since they were None in the update
    assert sample_category.description == original_description
    assert sample_category.parent_category_id == original_parent
    assert result is sample_category


@pytest.mark.asyncio
async def test_update_category_not_found(category_service: CategoryService, category_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    category_repository_mock.get_one_or_none.return_value = None
    data = CategoryUpdate(name="New Name")

    with pytest.raises(AppError) as exc_info:
        await category_service.update_category(missing_id, data, workspace_id)

    assert exc_info.value.code == ErrorCode.CATEGORY_NOT_FOUND
    category_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    category_repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_item(item_service: ItemService, item_repository_mock: AsyncMock, sample_category: Category, workspace_id: UUID):
    item_repository_mock.get_by_sku.return_value = None
    created = Item(
        id=uuid7(),
        workspace_id=workspace_id,
        sku="SKU-1",
        name="Hammer",
        description=TEST_ITEM_HAMMER,
        category_id=sample_category.id,
        created_at=datetime.datetime(2024, 1, 2, 0, 0, 0),
        updated_at=datetime.datetime(2024, 1, 3, 0, 0, 0),
    )
    item_repository_mock.add.return_value = created
    data = ItemCreate(sku="SKU-1", name="Hammer", description=TEST_ITEM_HAMMER, category_id=sample_category.id)

    result = await item_service.create_item(data, workspace_id)

    item_repository_mock.get_by_sku.assert_awaited_once_with("SKU-1", workspace_id)
    item_repository_mock.add.assert_awaited_once()
    sent = item_repository_mock.add.await_args.args[0]
    assert sent.sku == "SKU-1"
    assert sent.name == "Hammer"
    assert sent.category_id == sample_category.id
    assert sent.workspace_id == workspace_id
    assert result is created


@pytest.mark.asyncio
async def test_create_item_duplicate_sku(item_service: ItemService, item_repository_mock: AsyncMock, sample_item: Item, workspace_id: UUID):
    item_repository_mock.get_by_sku.return_value = sample_item
    data = ItemCreate(sku="SKU-1", name="Hammer", description=TEST_ITEM_HAMMER, category_id=sample_item.category_id)

    from warehouse.errors import AppError, ErrorCode

    with pytest.raises(AppError) as exc_info:
        await item_service.create_item(data, workspace_id)

    assert exc_info.value.code == ErrorCode.ITEM_DUPLICATE_SKU

    item_repository_mock.add.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_all_items(item_service: ItemService, item_repository_mock: AsyncMock, sample_item: Item, workspace_id: UUID):
    another = Item(
        id=uuid7(),
        workspace_id=workspace_id,
        sku="SKU-2",
        name="Screwdriver",
        description=None,
        category_id=None,
        created_at=datetime.datetime(2024, 1, 4, 0, 0, 0),
        updated_at=datetime.datetime(2024, 1, 5, 0, 0, 0),
    )
    item_repository_mock.list.return_value = [sample_item, another]

    result = await item_service.get_all_items(workspace_id)

    item_repository_mock.list.assert_awaited_once_with(workspace_id=workspace_id)
    assert result == [sample_item, another]


@pytest.mark.asyncio
async def test_get_item(item_service: ItemService, item_repository_mock: AsyncMock, sample_item: Item, workspace_id: UUID):
    item_repository_mock.get_one_or_none.return_value = sample_item

    result = await item_service.get_item(sample_item.id, workspace_id)

    item_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_item.id, workspace_id=workspace_id)
    assert result is sample_item


@pytest.mark.asyncio
async def test_get_item_not_found(item_service: ItemService, item_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    item_repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await item_service.get_item(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.ITEM_NOT_FOUND
    item_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_update_item(item_service: ItemService, item_repository_mock: AsyncMock, sample_item: Item, workspace_id: UUID):
    item_repository_mock.get_one_or_none.return_value = sample_item
    item_repository_mock.update.return_value = sample_item
    data = ItemUpdate(name="New Name", description="New Desc")

    result = await item_service.update_item(sample_item.id, data, workspace_id)

    item_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_item.id, workspace_id=workspace_id)
    item_repository_mock.update.assert_awaited_once_with(sample_item)
    assert sample_item.name == "New Name"
    assert sample_item.description == "New Desc"
    assert result is sample_item


@pytest.mark.asyncio
async def test_update_item_not_found(item_service: ItemService, item_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    item_repository_mock.get_one_or_none.return_value = None
    data = ItemUpdate(name="New Name")

    with pytest.raises(AppError) as exc_info:
        await item_service.update_item(missing_id, data, workspace_id)

    assert exc_info.value.code == ErrorCode.ITEM_NOT_FOUND
    item_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    item_repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_item(item_service: ItemService, item_repository_mock: AsyncMock, sample_item: Item, workspace_id: UUID):
    item_repository_mock.get_one_or_none.return_value = sample_item

    result = await item_service.delete_item(sample_item.id, workspace_id)

    item_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_item.id, workspace_id=workspace_id)
    item_repository_mock.session.delete.assert_awaited_once_with(sample_item)
    assert result is True


@pytest.mark.asyncio
async def test_delete_item_not_found(item_service: ItemService, item_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    item_repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await item_service.delete_item(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.ITEM_NOT_FOUND
    item_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    item_repository_mock.session.delete.assert_not_awaited()


def test_item_and_category_schemas():
    cat_id = uuid7()
    parent_id = uuid7()
    item_id = uuid7()
    created = datetime.datetime(2024, 1, 1, 0, 0, 0)
    updated = datetime.datetime(2024, 1, 2, 0, 0, 0)

    cat_create = CategoryCreate(name="Tools", parent_category_id=parent_id)
    item_create = ItemCreate(sku="SKU", name="Name", description=None, category_id=cat_id)
    item_update = ItemUpdate(name="New")
    cat_response = CategoryResponse(
        id=cat_id,
        name="Tools",
        parent_category_id=parent_id,
        description=None,
        created_at=created,
        updated_at=updated,
    )
    item_response = ItemResponse(
        id=item_id,
        sku="SKU",
        name="Name",
        description=None,
        category_id=cat_id,
        short_code=None,
        created_at=created,
        updated_at=updated,
    )

    assert cat_create.parent_category_id == parent_id
    assert item_create.category_id == cat_id
    assert item_update.name == "New"
    assert cat_response.id == cat_id
    assert item_response.updated_at == updated

    with pytest.raises(TypeError):
        ItemCreate()  # type: ignore[call-arg]


@pytest.mark.asyncio
async def test_update_item_updates_category_and_description(item_service: ItemService, item_repository_mock: AsyncMock, sample_item: Item, workspace_id: UUID):
    item_repository_mock.get_one_or_none.return_value = sample_item
    item_repository_mock.update.return_value = sample_item
    new_category = uuid7()
    payload = ItemUpdate(category_id=new_category, description="Updated desc")

    result = await item_service.update_item(sample_item.id, payload, workspace_id)

    item_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_item.id, workspace_id=workspace_id)
    item_repository_mock.update.assert_awaited_once_with(sample_item)
    assert sample_item.category_id == new_category
    assert sample_item.description == "Updated desc"
    assert result is sample_item


@pytest.mark.asyncio
async def test_update_item_updates_obsidian_paths(
    item_service: ItemService,
    item_repository_mock: AsyncMock,
    sample_item: Item,
    workspace_id: UUID,
):
    """Test updating obsidian vault and note paths."""
    item_repository_mock.get_one_or_none.return_value = sample_item
    item_repository_mock.update.return_value = sample_item
    payload = ItemUpdate(
        obsidian_vault_path=TEST_VAULT_PATH,
        obsidian_note_path=TEST_NOTE_PATH,
    )

    result = await item_service.update_item(sample_item.id, payload, workspace_id)

    assert sample_item.obsidian_vault_path == TEST_VAULT_PATH
    assert sample_item.obsidian_note_path == TEST_NOTE_PATH
    assert result is sample_item


class TestGenerateObsidianUrl:
    """Tests for generate_obsidian_url function."""

    def test_generate_obsidian_url_valid_paths(self):
        """Test generating Obsidian URL with valid paths."""
        from warehouse.domain.items.service import generate_obsidian_url

        result = generate_obsidian_url(
            vault_path="/Users/test/Documents/MyVault",
            note_path="items/hammer.md",
        )

        assert result == "obsidian://open?vault=MyVault&file=items%2Fhammer"

    def test_generate_obsidian_url_windows_path(self):
        """Test generating Obsidian URL with Windows-style paths."""
        from warehouse.domain.items.service import generate_obsidian_url

        result = generate_obsidian_url(
            vault_path="C:\\Users\\test\\Documents\\MyVault",
            note_path="items/hammer.md",
        )

        assert result == "obsidian://open?vault=MyVault&file=items%2Fhammer"

    def test_generate_obsidian_url_trailing_slash(self):
        """Test generating Obsidian URL with trailing slash."""
        from warehouse.domain.items.service import generate_obsidian_url

        result = generate_obsidian_url(
            vault_path="/path/to/vault/",
            note_path="notes/test.md",
        )

        assert result == "obsidian://open?vault=vault&file=notes%2Ftest"

    def test_generate_obsidian_url_special_characters(self):
        """Test generating Obsidian URL with special characters in paths."""
        from warehouse.domain.items.service import generate_obsidian_url

        result = generate_obsidian_url(
            vault_path="/path/My Vault",
            note_path="items & tools/hammer.md",
        )

        assert "vault=My%20Vault" in result
        assert "file=items%20%26%20tools%2Fhammer" in result

    def test_generate_obsidian_url_missing_vault_path(self):
        """Test generate_obsidian_url returns None when vault_path is missing."""
        from warehouse.domain.items.service import generate_obsidian_url

        result = generate_obsidian_url(vault_path=None, note_path="items/hammer.md")

        assert result is None

    def test_generate_obsidian_url_missing_note_path(self):
        """Test generate_obsidian_url returns None when note_path is missing."""
        from warehouse.domain.items.service import generate_obsidian_url

        result = generate_obsidian_url(vault_path="/path/to/vault", note_path=None)

        assert result is None

    def test_generate_obsidian_url_both_paths_missing(self):
        """Test generate_obsidian_url returns None when both paths are missing."""
        from warehouse.domain.items.service import generate_obsidian_url

        result = generate_obsidian_url(vault_path=None, note_path=None)

        assert result is None
