"""Inventory domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.exceptions import NotFoundException
from litestar.status_codes import HTTP_201_CREATED

from warehouse.domain.inventory.repository import InventoryRepository
from warehouse.domain.inventory.schemas import (
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate,
    StockAdjustment,
)
from warehouse.domain.inventory.service import InventoryService


def get_inventory_service(repository: InventoryRepository) -> InventoryService:
    """Dependency for inventory service."""
    return InventoryService(repository)


class InventoryController(Controller):
    """Inventory controller."""

    path = "/inventory"
    dependencies = {"inventory_service": Provide(get_inventory_service)}

    @post("/", status_code=HTTP_201_CREATED)
    async def create_inventory(
        self, data: InventoryCreate, inventory_service: InventoryService
    ) -> InventoryResponse:
        """Create a new inventory record."""
        inventory = await inventory_service.create_inventory(data)
        return InventoryResponse(
            id=inventory.id,
            item_id=inventory.item_id,
            location_id=inventory.location_id,
            quantity=inventory.quantity,
            created_at=inventory.created_at,
            updated_at=inventory.updated_at,
        )

    @get("/")
    async def list_inventory(
        self, inventory_service: InventoryService
    ) -> list[InventoryResponse]:
        """List all inventory records."""
        inventory_records = await inventory_service.get_all_inventory()
        return [
            InventoryResponse(
                id=i.id,
                item_id=i.item_id,
                location_id=i.location_id,
                quantity=i.quantity,
                created_at=i.created_at,
                updated_at=i.updated_at,
            )
            for i in inventory_records
        ]

    @get("/{inventory_id:uuid}")
    async def get_inventory(
        self, inventory_id: UUID, inventory_service: InventoryService
    ) -> InventoryResponse:
        """Get inventory by ID."""
        inventory = await inventory_service.get_inventory(inventory_id)
        if not inventory:
            raise NotFoundException("Inventory not found")
        return InventoryResponse(
            id=inventory.id,
            item_id=inventory.item_id,
            location_id=inventory.location_id,
            quantity=inventory.quantity,
            created_at=inventory.created_at,
            updated_at=inventory.updated_at,
        )

    @patch("/{inventory_id:uuid}")
    async def update_inventory(
        self, inventory_id: UUID, data: InventoryUpdate, inventory_service: InventoryService
    ) -> InventoryResponse:
        """Update inventory quantity."""
        inventory = await inventory_service.update_inventory(inventory_id, data)
        if not inventory:
            raise NotFoundException("Inventory not found")
        return InventoryResponse(
            id=inventory.id,
            item_id=inventory.item_id,
            location_id=inventory.location_id,
            quantity=inventory.quantity,
            created_at=inventory.created_at,
            updated_at=inventory.updated_at,
        )

    @patch("/{inventory_id:uuid}/adjust")
    async def adjust_stock(
        self, inventory_id: UUID, data: StockAdjustment, inventory_service: InventoryService
    ) -> InventoryResponse:
        """Adjust stock quantity."""
        inventory = await inventory_service.adjust_stock(inventory_id, data)
        if not inventory:
            raise NotFoundException("Inventory not found")
        return InventoryResponse(
            id=inventory.id,
            item_id=inventory.item_id,
            location_id=inventory.location_id,
            quantity=inventory.quantity,
            created_at=inventory.created_at,
            updated_at=inventory.updated_at,
        )

    @delete("/{inventory_id:uuid}")
    async def delete_inventory(
        self, inventory_id: UUID, inventory_service: InventoryService
    ) -> None:
        """Delete an inventory record."""
        deleted = await inventory_service.delete_inventory(inventory_id)
        if not deleted:
            raise NotFoundException("Inventory not found")

