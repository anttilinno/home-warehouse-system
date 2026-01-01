"""Sync domain controllers."""

from datetime import datetime

from litestar import Controller, get, post
from litestar.di import Provide
from litestar.params import Parameter
from litestar.status_codes import HTTP_200_OK
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.sync.schemas import (
    BatchRequest,
    BatchResponse,
    SyncResponse,
)
from warehouse.domain.sync.service import SyncService
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context, require_write_permission


def get_sync_service(db_session: AsyncSession) -> SyncService:
    """Dependency for sync service."""
    return SyncService(session=db_session)


class SyncController(Controller):
    """Controller for PWA offline sync operations."""

    path = "/sync"
    dependencies = {
        "sync_service": Provide(get_sync_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @get("/delta", status_code=HTTP_200_OK)
    async def get_delta(
        self,
        sync_service: SyncService,
        workspace: WorkspaceContext,
        modified_since: datetime | None = Parameter(
            default=None,
            description="ISO 8601 timestamp. Returns only records modified after this time.",
        ),
        entity_types: str | None = Parameter(
            default=None,
            description="Comma-separated list of entity types to sync (e.g., 'item,location')",
        ),
        limit: int = Parameter(
            default=500,
            ge=1,
            le=1000,
            description="Maximum number of records per entity type",
        ),
    ) -> SyncResponse:
        """Get delta changes since a timestamp.

        This endpoint returns all records modified after `modified_since`.
        For initial sync, omit `modified_since` to get all records.

        The response includes a `metadata.next_cursor` if there are more
        records. Use this value as `modified_since` in subsequent requests.

        Supported entity types: item, location, container, category, inventory, loan, borrower
        """
        types_list = entity_types.split(",") if entity_types else None

        return await sync_service.get_delta(
            workspace_id=workspace.workspace_id,
            modified_since=modified_since,
            entity_types=types_list,
            limit=limit,
        )

    @post("/batch", status_code=HTTP_200_OK)
    async def batch_operations(
        self,
        data: BatchRequest,
        sync_service: SyncService,
        workspace: WorkspaceContext,
    ) -> BatchResponse:
        """Process batch create/update/delete operations.

        Each operation includes an optional `updated_at` timestamp for
        conflict detection. If the server's record has been modified after
        this timestamp, the operation fails with a conflict error.

        Set `allow_partial: true` to continue processing even when some
        operations fail. Set to `false` to stop on first error.

        Supported operations: create, update, delete
        Supported entity types: item, location, container, category, inventory, loan, borrower
        """
        require_write_permission(workspace)

        return await sync_service.process_batch(
            workspace_id=workspace.workspace_id,
            user_id=workspace.user_id,
            request=data,
        )
