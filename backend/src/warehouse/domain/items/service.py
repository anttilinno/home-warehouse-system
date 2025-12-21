"""Items domain service."""

from uuid import UUID

from warehouse.domain.items.models import Category, Item
from warehouse.domain.items.repository import CategoryRepository, ItemRepository
from warehouse.domain.items.schemas import CategoryCreate, CategoryUpdate, ItemCreate, ItemUpdate
from warehouse.errors import AppError, ErrorCode


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

