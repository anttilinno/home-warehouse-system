"""Inventory domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.activity_log.models import ActivityAction, ActivityEntity
from warehouse.domain.activity_log.repository import ActivityLogRepository
from warehouse.domain.activity_log.service import ActivityLogService
from warehouse.domain.inventory.repository import InventoryRepository
from warehouse.domain.inventory.schemas import (
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate,
    StockAdjustment,
)
from warehouse.domain.inventory.service import InventoryService
from warehouse.errors import AppError
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context, require_write_permission


def get_inventory_service(db_session: AsyncSession) -> InventoryService:
    """Dependency for inventory service."""
    repository = InventoryRepository(session=db_session)
    return InventoryService(repository)


def get_activity_log_service(db_session: AsyncSession) -> ActivityLogService:
    """Dependency for activity log service."""
    repository = ActivityLogRepository(session=db_session)
    return ActivityLogService(repository)


class InventoryController(Controller):
    """Inventory controller."""

    path = "/inventory"
    dependencies = {
        "inventory_service": Provide(get_inventory_service, sync_to_thread=False),
        "activity_service": Provide(get_activity_log_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @post("/", status_code=HTTP_201_CREATED)
    async def create_inventory(
        self,
        data: InventoryCreate,
        inventory_service: InventoryService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> InventoryResponse:
        """Create a new inventory record."""
        require_write_permission(workspace)
        try:
            inventory = await inventory_service.create_inventory(
                data, workspace.workspace_id
            )

            await activity_service.log_action(
                workspace_id=workspace.workspace_id,
                user_id=workspace.user_id,
                action=ActivityAction.CREATE,
                entity_type=ActivityEntity.INVENTORY,
                entity_id=inventory.id,
                extra_data={
                    "item_id": str(inventory.item_id),
                    "location_id": str(inventory.location_id) if inventory.location_id else None,
                    "quantity": inventory.quantity,
                },
            )
        except AppError as exc:
            raise exc.to_http_exception()
        return InventoryResponse(
            id=inventory.id,
            item_id=inventory.item_id,
            location_id=inventory.location_id,
            quantity=inventory.quantity,
            expiration_date=inventory.expiration_date,
            warranty_expires=inventory.warranty_expires,
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
                expiration_date=i.expiration_date,
                warranty_expires=i.warranty_expires,
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
            expiration_date=inventory.expiration_date,
            warranty_expires=inventory.warranty_expires,
            created_at=inventory.created_at,
            updated_at=inventory.updated_at,
        )

    @patch("/{inventory_id:uuid}")
    async def update_inventory(
        self,
        inventory_id: UUID,
        data: InventoryUpdate,
        inventory_service: InventoryService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> InventoryResponse:
        """Update inventory quantity."""
        require_write_permission(workspace)
        try:
            # Get old values for change tracking
            old_inventory = await inventory_service.get_inventory(
                inventory_id, workspace.workspace_id
            )
            old_quantity = old_inventory.quantity

            inventory = await inventory_service.update_inventory(
                inventory_id, data, workspace.workspace_id
            )

            # Track changes
            changes = {}
            if data.quantity is not None and data.quantity != old_quantity:
                changes["quantity"] = {"old": old_quantity, "new": data.quantity}

            await activity_service.log_action(
                workspace_id=workspace.workspace_id,
                user_id=workspace.user_id,
                action=ActivityAction.UPDATE,
                entity_type=ActivityEntity.INVENTORY,
                entity_id=inventory.id,
                changes=changes if changes else None,
            )
        except AppError as exc:
            raise exc.to_http_exception()
        return InventoryResponse(
            id=inventory.id,
            item_id=inventory.item_id,
            location_id=inventory.location_id,
            quantity=inventory.quantity,
            expiration_date=inventory.expiration_date,
            warranty_expires=inventory.warranty_expires,
            created_at=inventory.created_at,
            updated_at=inventory.updated_at,
        )

    @patch("/{inventory_id:uuid}/adjust")
    async def adjust_stock(
        self,
        inventory_id: UUID,
        data: StockAdjustment,
        inventory_service: InventoryService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> InventoryResponse:
        """Adjust stock quantity."""
        require_write_permission(workspace)
        try:
            # Get old quantity for change tracking
            old_inventory = await inventory_service.get_inventory(
                inventory_id, workspace.workspace_id
            )
            old_quantity = old_inventory.quantity

            inventory = await inventory_service.adjust_stock(
                inventory_id, data, workspace.workspace_id
            )

            await activity_service.log_action(
                workspace_id=workspace.workspace_id,
                user_id=workspace.user_id,
                action=ActivityAction.UPDATE,
                entity_type=ActivityEntity.INVENTORY,
                entity_id=inventory.id,
                changes={
                    "quantity": {"old": old_quantity, "new": inventory.quantity},
                },
                extra_data={
                    "quantity_change": data.quantity_change,
                },
            )
        except AppError as exc:
            raise exc.to_http_exception()
        return InventoryResponse(
            id=inventory.id,
            item_id=inventory.item_id,
            location_id=inventory.location_id,
            quantity=inventory.quantity,
            expiration_date=inventory.expiration_date,
            warranty_expires=inventory.warranty_expires,
            created_at=inventory.created_at,
            updated_at=inventory.updated_at,
        )

    @delete("/{inventory_id:uuid}")
    async def delete_inventory(
        self,
        inventory_id: UUID,
        inventory_service: InventoryService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete an inventory record."""
        require_write_permission(workspace)
        try:
            # Get inventory details before deletion
            inventory = await inventory_service.get_inventory(
                inventory_id, workspace.workspace_id
            )

            await inventory_service.delete_inventory(inventory_id, workspace.workspace_id)

            await activity_service.log_action(
                workspace_id=workspace.workspace_id,
                user_id=workspace.user_id,
                action=ActivityAction.DELETE,
                entity_type=ActivityEntity.INVENTORY,
                entity_id=inventory_id,
                extra_data={
                    "item_id": str(inventory.item_id),
                    "location_id": str(inventory.location_id) if inventory.location_id else None,
                },
            )
        except AppError as exc:
            raise exc.to_http_exception()

