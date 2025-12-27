"""Inventory domain service."""

from datetime import UTC, datetime
from uuid import UUID

from warehouse.domain.inventory.models import Inventory
from warehouse.domain.inventory.repository import InventoryRepository
from warehouse.domain.inventory.schemas import InventoryCreate, InventoryUpdate, StockAdjustment
from warehouse.errors import AppError, ErrorCode


class InventoryService:
    """Inventory service."""

    def __init__(self, repository: InventoryRepository):
        """Initialize inventory service."""
        self.repository = repository

    async def create_inventory(
        self, inventory_data: InventoryCreate, workspace_id: UUID
    ) -> Inventory:
        """Create a new inventory record."""
        existing = await self.repository.get_by_item_and_location(
            inventory_data.item_id, inventory_data.location_id, workspace_id
        )
        if existing:
            raise AppError(ErrorCode.INVENTORY_DUPLICATE, status_code=400)

        inventory = Inventory(
            workspace_id=workspace_id,
            item_id=inventory_data.item_id,
            location_id=inventory_data.location_id,
            quantity=inventory_data.quantity,
            expiration_date=inventory_data.expiration_date,
            warranty_expires=inventory_data.warranty_expires,
        )
        inventory = await self.repository.add(inventory)
        await self.repository.session.commit()
        return inventory

    async def get_all_inventory(self, workspace_id: UUID) -> list[Inventory]:
        """Get all inventory records for a workspace."""
        return await self.repository.list(workspace_id=workspace_id)

    async def get_inventory(
        self, inventory_id: UUID, workspace_id: UUID
    ) -> Inventory:
        """Get inventory by ID within a workspace."""
        inventory = await self.repository.get_one_or_none(
            id=inventory_id, workspace_id=workspace_id
        )
        if not inventory:
            raise AppError(ErrorCode.INVENTORY_NOT_FOUND, status_code=404)
        return inventory

    async def get_by_item_and_location(
        self, item_id: UUID, location_id: UUID, workspace_id: UUID
    ) -> Inventory | None:
        """Get inventory by item and location."""
        return await self.repository.get_by_item_and_location(
            item_id, location_id, workspace_id
        )

    async def update_inventory(
        self, inventory_id: UUID, inventory_data: InventoryUpdate, workspace_id: UUID
    ) -> Inventory:
        """Update inventory quantity."""
        inventory = await self.repository.get_one_or_none(
            id=inventory_id, workspace_id=workspace_id
        )
        if not inventory:
            raise AppError(ErrorCode.INVENTORY_NOT_FOUND, status_code=404)

        if inventory_data.quantity is not None:
            inventory.quantity = inventory_data.quantity
        if inventory_data.expiration_date is not None:
            inventory.expiration_date = inventory_data.expiration_date
        if inventory_data.warranty_expires is not None:
            inventory.warranty_expires = inventory_data.warranty_expires
        inventory.updated_at = datetime.now(UTC)
        inventory = await self.repository.update(inventory)
        await self.repository.session.commit()
        return inventory

    async def adjust_stock(
        self, inventory_id: UUID, adjustment: StockAdjustment, workspace_id: UUID
    ) -> Inventory:
        """Adjust stock quantity."""
        inventory = await self.repository.get_one_or_none(
            id=inventory_id, workspace_id=workspace_id
        )
        if not inventory:
            raise AppError(ErrorCode.INVENTORY_NOT_FOUND, status_code=404)

        inventory.quantity += adjustment.quantity_change
        if inventory.quantity < 0:
            raise AppError(ErrorCode.INVENTORY_STOCK_NEGATIVE, status_code=400)

        inventory.updated_at = datetime.now(UTC)
        inventory = await self.repository.update(inventory)
        await self.repository.session.commit()
        return inventory

    async def delete_inventory(self, inventory_id: UUID, workspace_id: UUID) -> bool:
        """Delete an inventory record."""
        inventory = await self.repository.get_one_or_none(
            id=inventory_id, workspace_id=workspace_id
        )
        if not inventory:
            raise AppError(ErrorCode.INVENTORY_NOT_FOUND, status_code=404)

        await self.repository.session.delete(inventory)
        await self.repository.session.commit()
        return True

