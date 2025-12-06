"""Items domain service."""

from uuid import UUID

from warehouse.domain.items.models import Category, Item
from warehouse.domain.items.repository import CategoryRepository, ItemRepository
from warehouse.domain.items.schemas import CategoryCreate, ItemCreate, ItemUpdate


class CategoryService:
    """Category service."""

    def __init__(self, repository: CategoryRepository):
        """Initialize category service."""
        self.repository = repository

    async def create_category(self, category_data: CategoryCreate) -> Category:
        """Create a new category."""
        category = Category(name=category_data.name, description=category_data.description)
        return await self.repository.add(category)

    async def get_all_categories(self) -> list[Category]:
        """Get all categories."""
        return await self.repository.list()

    async def get_category(self, category_id: UUID) -> Category | None:
        """Get category by ID."""
        return await self.repository.get_by_id(category_id)


class ItemService:
    """Item service."""

    def __init__(self, repository: ItemRepository):
        """Initialize item service."""
        self.repository = repository

    async def create_item(self, item_data: ItemCreate) -> Item:
        """Create a new item."""
        existing = await self.repository.get_by_sku(item_data.sku)
        if existing:
            raise ValueError("SKU already exists")

        item = Item(
            sku=item_data.sku,
            name=item_data.name,
            description=item_data.description,
            category_id=item_data.category_id,
        )
        return await self.repository.add(item)

    async def get_all_items(self) -> list[Item]:
        """Get all items."""
        return await self.repository.list()

    async def get_item(self, item_id: UUID) -> Item | None:
        """Get item by ID."""
        return await self.repository.get_by_id(item_id)

    async def update_item(self, item_id: UUID, item_data: ItemUpdate) -> Item | None:
        """Update an item."""
        item = await self.repository.get_by_id(item_id)
        if not item:
            return None

        if item_data.name is not None:
            item.name = item_data.name
        if item_data.description is not None:
            item.description = item_data.description
        if item_data.category_id is not None:
            item.category_id = item_data.category_id

        return await self.repository.update(item)

    async def delete_item(self, item_id: UUID) -> bool:
        """Delete an item."""
        item = await self.repository.get_by_id(item_id)
        if not item:
            return False

        await self.repository.delete(item)
        return True

