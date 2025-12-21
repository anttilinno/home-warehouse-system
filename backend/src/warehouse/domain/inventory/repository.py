"""Inventory domain repository."""

from uuid import UUID

from warehouse.domain.inventory.models import Inventory
from warehouse.lib.base import BaseRepository


class InventoryRepository(BaseRepository[Inventory]):
    """Inventory repository."""

    model_type = Inventory

    async def get_by_item_and_location(
        self, item_id: UUID, location_id: UUID, workspace_id: UUID
    ) -> Inventory | None:
        """Get inventory by item and location within a workspace."""
        return await self.get_one_or_none(
            item_id=item_id, location_id=location_id, workspace_id=workspace_id
        )

