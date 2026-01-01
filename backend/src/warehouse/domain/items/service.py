"""Items domain service."""

from urllib.parse import quote
from uuid import UUID

from warehouse.domain.items.models import Category, Item
from warehouse.domain.items.repository import CategoryRepository, ItemRepository
from warehouse.domain.items.schemas import (
    CategoryCreate,
    CategoryUpdate,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
)
from warehouse.errors import AppError, ErrorCode


def generate_obsidian_url(vault_path: str | None, note_path: str | None) -> str | None:
    """Generate an Obsidian deep link URL.

    Args:
        vault_path: Local path to the Obsidian vault
        note_path: Relative path to the note within the vault

    Returns:
        obsidian:// URL or None if either path is missing
    """
    if not vault_path or not note_path:
        return None
    # Get vault name from path (last component)
    vault_name = vault_path.rstrip("/\\").split("/")[-1].split("\\")[-1]
    # URL encode the components
    encoded_vault = quote(vault_name, safe="")
    encoded_file = quote(note_path.removesuffix(".md"), safe="")
    return f"obsidian://open?vault={encoded_vault}&file={encoded_file}"


def item_to_response(item: Item) -> ItemResponse:
    """Convert Item model to ItemResponse with generated Obsidian URL."""
    return ItemResponse(
        id=item.id,
        sku=item.sku,
        name=item.name,
        description=item.description,
        category_id=item.category_id,
        short_code=item.short_code,
        created_at=item.created_at,
        updated_at=item.updated_at,
        obsidian_vault_path=item.obsidian_vault_path,
        obsidian_note_path=item.obsidian_note_path,
        obsidian_url=generate_obsidian_url(item.obsidian_vault_path, item.obsidian_note_path),
    )


class CategoryService:
    """Category service."""

    def __init__(self, repository: CategoryRepository):
        """Initialize category service."""
        self.repository = repository

    async def create_category(
        self, category_data: CategoryCreate, workspace_id: UUID
    ) -> Category:
        """Create a new category."""
        category = Category(
            workspace_id=workspace_id,
            name=category_data.name,
            parent_category_id=category_data.parent_category_id,
            description=category_data.description,
        )
        category = await self.repository.add(category)
        await self.repository.session.commit()
        return category

    async def get_all_categories(self, workspace_id: UUID) -> list[Category]:
        """Get all categories for a workspace."""
        return await self.repository.list(workspace_id=workspace_id)

    async def get_category(
        self, category_id: UUID, workspace_id: UUID
    ) -> Category | None:
        """Get category by ID within a workspace."""
        return await self.repository.get_one_or_none(
            id=category_id, workspace_id=workspace_id
        )

    async def update_category(
        self, category_id: UUID, category_data: CategoryUpdate, workspace_id: UUID
    ) -> Category:
        """Update a category."""
        category = await self.repository.get_one_or_none(
            id=category_id, workspace_id=workspace_id
        )
        if not category:
            raise AppError(ErrorCode.CATEGORY_NOT_FOUND, status_code=404)

        if category_data.name is not None:
            category.name = category_data.name
        if category_data.description is not None:
            category.description = category_data.description
        if category_data.parent_category_id is not None:
            category.parent_category_id = category_data.parent_category_id

        category = await self.repository.update(category)
        await self.repository.session.commit()
        return category

    async def delete_category(self, category_id: UUID, workspace_id: UUID) -> bool:
        """Delete a category."""
        category = await self.repository.get_one_or_none(
            id=category_id, workspace_id=workspace_id
        )
        if not category:
            raise AppError(ErrorCode.CATEGORY_NOT_FOUND, status_code=404)
        await self.repository.session.delete(category)
        await self.repository.session.commit()
        return True


class ItemService:
    """Item service."""

    def __init__(self, repository: ItemRepository):
        """Initialize item service."""
        self.repository = repository

    async def create_item(self, item_data: ItemCreate, workspace_id: UUID) -> Item:
        """Create a new item."""
        existing = await self.repository.get_by_sku(item_data.sku, workspace_id)
        if existing:
            raise AppError(ErrorCode.ITEM_DUPLICATE_SKU, status_code=400)

        item = Item(
            workspace_id=workspace_id,
            sku=item_data.sku,
            name=item_data.name,
            description=item_data.description,
            category_id=item_data.category_id,
            obsidian_vault_path=item_data.obsidian_vault_path,
            obsidian_note_path=item_data.obsidian_note_path,
        )
        item = await self.repository.add(item)
        await self.repository.session.commit()
        return item

    async def get_all_items(self, workspace_id: UUID) -> list[Item]:
        """Get all items for a workspace."""
        return await self.repository.list(workspace_id=workspace_id)

    async def get_item(self, item_id: UUID, workspace_id: UUID) -> Item:
        """Get item by ID within a workspace."""
        item = await self.repository.get_one_or_none(
            id=item_id, workspace_id=workspace_id
        )
        if not item:
            raise AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)
        return item

    async def update_item(
        self, item_id: UUID, item_data: ItemUpdate, workspace_id: UUID
    ) -> Item:
        """Update an item."""
        item = await self.repository.get_one_or_none(
            id=item_id, workspace_id=workspace_id
        )
        if not item:
            raise AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)

        if item_data.name is not None:
            item.name = item_data.name
        if item_data.description is not None:
            item.description = item_data.description
        if item_data.category_id is not None:
            item.category_id = item_data.category_id
        if item_data.obsidian_vault_path is not None:
            item.obsidian_vault_path = item_data.obsidian_vault_path
        if item_data.obsidian_note_path is not None:
            item.obsidian_note_path = item_data.obsidian_note_path

        item = await self.repository.update(item)
        await self.repository.session.commit()
        return item

    async def delete_item(self, item_id: UUID, workspace_id: UUID) -> bool:
        """Delete an item."""
        item = await self.repository.get_one_or_none(
            id=item_id, workspace_id=workspace_id
        )
        if not item:
            raise AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)

        await self.repository.session.delete(item)
        await self.repository.session.commit()
        return True

