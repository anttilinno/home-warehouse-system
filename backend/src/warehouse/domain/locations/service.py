"""Locations domain service."""

from uuid import UUID

from warehouse.domain.locations.models import Location
from warehouse.domain.locations.repository import LocationRepository
from warehouse.domain.locations.schemas import LocationCreate, LocationUpdate


class LocationService:
    """Location service."""

    def __init__(self, repository: LocationRepository):
        """Initialize location service."""
        self.repository = repository

    async def create_location(self, location_data: LocationCreate) -> Location:
        """Create a new location."""
        location = Location(
            name=location_data.name,
            zone=location_data.zone,
            shelf=location_data.shelf,
            bin=location_data.bin,
            description=location_data.description,
        )
        return await self.repository.add(location)

    async def get_all_locations(self) -> list[Location]:
        """Get all locations."""
        return await self.repository.list()

    async def get_location(self, location_id: UUID) -> Location | None:
        """Get location by ID."""
        return await self.repository.get_by_id(location_id)

    async def update_location(
        self, location_id: UUID, location_data: LocationUpdate
    ) -> Location | None:
        """Update a location."""
        location = await self.repository.get_by_id(location_id)
        if not location:
            return None

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

        return await self.repository.update(location)

    async def delete_location(self, location_id: UUID) -> bool:
        """Delete a location."""
        location = await self.repository.get_by_id(location_id)
        if not location:
            return False

        await self.repository.delete(location)
        return True

