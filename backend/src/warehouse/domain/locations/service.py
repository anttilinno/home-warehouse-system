"""Locations domain service."""

from uuid import UUID

from warehouse.domain.locations.models import Location
from warehouse.domain.locations.repository import LocationRepository
from warehouse.domain.locations.schemas import LocationCreate, LocationUpdate
from warehouse.errors import AppError, ErrorCode


class LocationService:
    """Location service."""

    def __init__(self, repository: LocationRepository):
        """Initialize location service."""
        self.repository = repository

    async def create_location(
        self, location_data: LocationCreate, workspace_id: UUID
    ) -> Location:
        """Create a new location."""
        location = Location(
            workspace_id=workspace_id,
            name=location_data.name,
            zone=location_data.zone,
            shelf=location_data.shelf,
            bin=location_data.bin,
            description=location_data.description,
        )
        location = await self.repository.add(location)
        await self.repository.session.commit()
        return location

    async def get_all_locations(self, workspace_id: UUID) -> list[Location]:
        """Get all locations for a workspace."""
        return await self.repository.list(workspace_id=workspace_id)

    async def get_location(self, location_id: UUID, workspace_id: UUID) -> Location:
        """Get location by ID within a workspace."""
        location = await self.repository.get_one_or_none(
            id=location_id, workspace_id=workspace_id
        )
        if not location:
            raise AppError(ErrorCode.LOCATION_NOT_FOUND, status_code=404)
        return location

    async def update_location(
        self, location_id: UUID, location_data: LocationUpdate, workspace_id: UUID
    ) -> Location:
        """Update a location."""
        location = await self.repository.get_one_or_none(
            id=location_id, workspace_id=workspace_id
        )
        if not location:
            raise AppError(ErrorCode.LOCATION_NOT_FOUND, status_code=404)

        if location_data.name is not None:
            location.name = location_data.name
        if location_data.zone is not None:
            location.zone = location_data.zone
        if location_data.shelf is not None:
            location.shelf = location_data.shelf
        if location_data.bin is not None:
            location.bin = location_data.bin
        if location_data.description is not None:
            location.description = location_data.description

        location = await self.repository.update(location)
        await self.repository.session.commit()
        return location

    async def delete_location(self, location_id: UUID, workspace_id: UUID) -> bool:
        """Delete a location."""
        location = await self.repository.get_one_or_none(
            id=location_id, workspace_id=workspace_id
        )
        if not location:
            raise AppError(ErrorCode.LOCATION_NOT_FOUND, status_code=404)

        await self.repository.session.delete(location)
        await self.repository.session.commit()
        return True

