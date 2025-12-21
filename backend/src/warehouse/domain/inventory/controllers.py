"""Inventory domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.inventory.repository import InventoryRepository
from warehouse.domain.inventory.schemas import (
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate,
    StockAdjustment,
)
from warehouse.domain.inventory.service import InventoryService
from warehouse.errors import AppError
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context


def get_inventory_service(db_session: AsyncSession) -> InventoryService:
    """Dependency for inventory service."""
    repository = InventoryRepository(session=db_session)
    return InventoryService(repository)


class InventoryController(Controller):
    """Inventory controller."""

    path = "/inventory"
    dependencies = {
        "inventory_service": Provide(get_inventory_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context, sync_to_thread=False),
    }

    @post("/", status_code=HTTP_201_CREATED)
    async def create_inventory(
        self,
        data: InventoryCreate,
        inventory_service: InventoryService,
        workspace: WorkspaceContext,
    ) -> InventoryResponse:
        """Create a new inventory record."""
        try:
            inventory = await inventory_service.create_inventory(
                data, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()
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
        self,
        inventory_service: InventoryService,
        workspace: WorkspaceContext,
    ) -> list[InventoryResponse]:
        """List all inventory records."""
        inventory_records = await inventory_service.get_all_inventory(
            workspace.workspace_id
        )
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
        self,
        inventory_id: UUID,
        inventory_service: InventoryService,
        workspace: WorkspaceContext,
    ) -> InventoryResponse:
        """Get inventory by ID."""
        try:
            inventory = await inventory_service.get_inventory(
                inventory_id, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()
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
        self,
        inventory_id: UUID,
        data: InventoryUpdate,
        inventory_service: InventoryService,
        workspace: WorkspaceContext,
    ) -> InventoryResponse:
        """Update inventory quantity."""
        try:
            inventory = await inventory_service.update_inventory(
                inventory_id, data, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()
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
        self,
        inventory_id: UUID,
        data: StockAdjustment,
        inventory_service: InventoryService,
        workspace: WorkspaceContext,
    ) -> InventoryResponse:
        """Adjust stock quantity."""
        try:
            inventory = await inventory_service.adjust_stock(
                inventory_id, data, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()
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
        self,
        inventory_id: UUID,
        inventory_service: InventoryService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete an inventory record."""
        try:
            await inventory_service.delete_inventory(inventory_id, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()

