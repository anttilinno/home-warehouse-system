"""Locations domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.locations.repository import LocationRepository
from warehouse.domain.locations.schemas import LocationCreate, LocationResponse, LocationUpdate
from warehouse.domain.locations.service import LocationService
from warehouse.errors import AppError
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context


def get_location_service(db_session: AsyncSession) -> LocationService:
    """Dependency for location service."""
    repository = LocationRepository(session=db_session)
    return LocationService(repository)


class LocationController(Controller):
    """Location controller."""

    path = "/locations"
    dependencies = {
        "location_service": Provide(get_location_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context, sync_to_thread=False),
    }

    @post("/", status_code=HTTP_201_CREATED)
    async def create_location(
        self,
        data: LocationCreate,
        location_service: LocationService,
        workspace: WorkspaceContext,
    ) -> LocationResponse:
        """Create a new location."""
        location = await location_service.create_location(data, workspace.workspace_id)
        return LocationResponse(
            id=location.id,
            name=location.name,
            zone=location.zone,
            shelf=location.shelf,
            bin=location.bin,
            description=location.description,
            created_at=location.created_at,
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
            location = await location_service.get_location(location_id, workspace.workspace_id)
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
        )

    @patch("/{location_id:uuid}")
    async def update_location(
        self,
        location_id: UUID,
        data: LocationUpdate,
        location_service: LocationService,
        workspace: WorkspaceContext,
    ) -> LocationResponse:
        """Update a location."""
        try:
            location = await location_service.update_location(
                location_id, data, workspace.workspace_id
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
        )

    @delete("/{location_id:uuid}")
    async def delete_location(
        self,
        location_id: UUID,
        location_service: LocationService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete a location."""
        try:
            await location_service.delete_location(location_id, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()

