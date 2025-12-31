"""Locations domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.activity_log.models import ActivityAction, ActivityEntity
from warehouse.domain.activity_log.repository import ActivityLogRepository
from warehouse.domain.activity_log.service import ActivityLogService
from warehouse.domain.locations.repository import LocationRepository
from warehouse.domain.locations.schemas import (
    BreadcrumbItem,
    LocationCreate,
    LocationResponse,
    LocationUpdate,
)
from warehouse.domain.locations.service import LocationService
from warehouse.errors import AppError
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context, require_write_permission


def get_location_service(db_session: AsyncSession) -> LocationService:
    """Dependency for location service."""
    repository = LocationRepository(session=db_session)
    return LocationService(repository)


def get_activity_log_service(db_session: AsyncSession) -> ActivityLogService:
    """Dependency for activity log service."""
    repository = ActivityLogRepository(session=db_session)
    return ActivityLogService(repository)


class LocationController(Controller):
    """Location controller."""

    path = "/locations"
    dependencies = {
        "location_service": Provide(get_location_service, sync_to_thread=False),
        "activity_service": Provide(get_activity_log_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @post("/", status_code=HTTP_201_CREATED)
    async def create_location(
        self,
        data: LocationCreate,
        location_service: LocationService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> LocationResponse:
        """Create a new location."""
        require_write_permission(workspace)
        location = await location_service.create_location(data, workspace.workspace_id)

        await activity_service.log_action(
            workspace_id=workspace.workspace_id,
            user_id=workspace.user_id,
            action=ActivityAction.CREATE,
            entity_type=ActivityEntity.LOCATION,
            entity_id=location.id,
            entity_name=location.name,
        )

        return LocationResponse(
            id=location.id,
            name=location.name,
            zone=location.zone,
            shelf=location.shelf,
            bin=location.bin,
            description=location.description,
            created_at=location.created_at,
            parent_location_id=location.parent_location_id,
        )

    @get("/")
    async def list_locations(
        self,
        location_service: LocationService,
        workspace: WorkspaceContext,
    ) -> list[LocationResponse]:
        """List all locations."""
        locations = await location_service.get_all_locations(workspace.workspace_id)
        return [
            LocationResponse(
                id=loc.id,
                name=loc.name,
                zone=loc.zone,
                shelf=loc.shelf,
                bin=loc.bin,
                description=loc.description,
                created_at=loc.created_at,
                parent_location_id=loc.parent_location_id,
            )
            for loc in locations
        ]

    @get("/{location_id:uuid}")
    async def get_location(
        self,
        location_id: UUID,
        location_service: LocationService,
        workspace: WorkspaceContext,
    ) -> LocationResponse:
        """Get location by ID."""
        try:
            location = await location_service.get_location(
                location_id, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()
        return LocationResponse(
            id=location.id,
            name=location.name,
            zone=location.zone,
            shelf=location.shelf,
            bin=location.bin,
            description=location.description,
            created_at=location.created_at,
            parent_location_id=location.parent_location_id,
        )

    @get("/{location_id:uuid}/breadcrumb")
    async def get_location_breadcrumb(
        self,
        location_id: UUID,
        location_service: LocationService,
        workspace: WorkspaceContext,
    ) -> list[BreadcrumbItem]:
        """Get location breadcrumb path."""
        try:
            return await location_service.get_location_breadcrumb(
                location_id, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()

    @patch("/{location_id:uuid}")
    async def update_location(
        self,
        location_id: UUID,
        data: LocationUpdate,
        location_service: LocationService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> LocationResponse:
        """Update a location."""
        require_write_permission(workspace)
        try:
            # Get old values for change tracking
            old_location = await location_service.get_location(
                location_id, workspace.workspace_id
            )
            old_name = old_location.name

            location = await location_service.update_location(
                location_id, data, workspace.workspace_id
            )

            # Track changes
            changes = {}
            if data.name is not None and data.name != old_name:
                changes["name"] = {"old": old_name, "new": data.name}

            await activity_service.log_action(
                workspace_id=workspace.workspace_id,
                user_id=workspace.user_id,
                action=ActivityAction.UPDATE,
                entity_type=ActivityEntity.LOCATION,
                entity_id=location.id,
                entity_name=location.name,
                changes=changes if changes else None,
            )
        except AppError as exc:
            raise exc.to_http_exception()
        return LocationResponse(
            id=location.id,
            name=location.name,
            zone=location.zone,
            shelf=location.shelf,
            bin=location.bin,
            description=location.description,
            created_at=location.created_at,
            parent_location_id=location.parent_location_id,
        )

    @delete("/{location_id:uuid}")
    async def delete_location(
        self,
        location_id: UUID,
        location_service: LocationService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete a location."""
        require_write_permission(workspace)
        try:
            # Get location details before deletion
            location = await location_service.get_location(
                location_id, workspace.workspace_id
            )
            location_name = location.name

            await location_service.delete_location(location_id, workspace.workspace_id)

            await activity_service.log_action(
                workspace_id=workspace.workspace_id,
                user_id=workspace.user_id,
                action=ActivityAction.DELETE,
                entity_type=ActivityEntity.LOCATION,
                entity_id=location_id,
                entity_name=location_name,
            )
        except AppError as exc:
            raise exc.to_http_exception()

