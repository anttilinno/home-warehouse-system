"""Items domain repository."""

from uuid import UUID

from warehouse.domain.items.models import Category, Item
from warehouse.lib.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    """Category repository."""

    model_type = Category


class ItemRepository(BaseRepository[Item]):
    """Item repository."""

    model_type = Item

    async def get_by_sku(self, sku: str, workspace_id: UUID) -> Item | None:
        """Get item by SKU within a workspace."""
        return await self.get_one_or_none(sku=sku, workspace_id=workspace_id)

