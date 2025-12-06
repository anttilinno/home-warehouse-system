"""Inventory domain service."""

from uuid import UUID

from warehouse.domain.inventory.models import Inventory
from warehouse.domain.inventory.repository import InventoryRepository
from warehouse.domain.inventory.schemas import InventoryCreate, InventoryUpdate, StockAdjustment


class InventoryService:
    """Inventory service."""

    def __init__(self, repository: InventoryRepository):
        """Initialize inventory service."""
        self.repository = repository

    async def create_inventory(self, inventory_data: InventoryCreate) -> Inventory:
        """Create a new inventory record."""
        existing = await self.repository.get_by_item_and_location(
            inventory_data.item_id, inventory_data.location_id
        )
        if existing:
            raise ValueError("Inventory record already exists for this item and location")

        inventory = Inventory(
            item_id=inventory_data.item_id,
            location_id=inventory_data.location_id,
            quantity=inventory_data.quantity,
        )
        return await self.repository.add(inventory)

    async def get_all_inventory(self) -> list[Inventory]:
        """Get all inventory records."""
        return await self.repository.list()

    async def get_inventory(self, inventory_id: UUID) -> Inventory | None:
        """Get inventory by ID."""
        return await self.repository.get_by_id(inventory_id)

    async def get_by_item_and_location(
        self, item_id: UUID, location_id: UUID
    ) -> Inventory | None:
        """Get inventory by item and location."""
        return await self.repository.get_by_item_and_location(item_id, location_id)

    async def update_inventory(
        self, inventory_id: UUID, inventory_data: InventoryUpdate
    ) -> Inventory | None:
        """Update inventory quantity."""
        inventory = await self.repository.get_by_id(inventory_id)
        if not inventory:
            return None

        inventory.quantity = inventory_data.quantity
        return await self.repository.update(inventory)

    async def adjust_stock(
        self, inventory_id: UUID, adjustment: StockAdjustment
    ) -> Inventory | None:
        """Adjust stock quantity."""
        inventory = await self.repository.get_by_id(inventory_id)
        if not inventory:
            return None

        inventory.quantity += adjustment.quantity_change
        if inventory.quantity < 0:
            raise ValueError("Stock cannot be negative")

        return await self.repository.update(inventory)

    async def delete_inventory(self, inventory_id: UUID) -> bool:
        """Delete an inventory record."""
        inventory = await self.repository.get_by_id(inventory_id)
        if not inventory:
            return False

        await self.repository.delete(inventory)
        return True

