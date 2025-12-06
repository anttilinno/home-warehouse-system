"""Items domain repository."""

from advanced_alchemy.repository import SQLAlchemyAsyncRepository

from warehouse.domain.items.models import Category, Item
from warehouse.lib.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    """Category repository."""

    model_type = Category


class ItemRepository(BaseRepository[Item]):
    """Item repository."""

    model_type = Item

    async def get_by_sku(self, sku: str) -> Item | None:
        """Get item by SKU."""
        return await self.get_one(sku=sku)

