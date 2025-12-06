"""Locations domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.exceptions import NotFoundException
from litestar.status_codes import HTTP_201_CREATED

from warehouse.domain.locations.repository import LocationRepository
from warehouse.domain.locations.schemas import LocationCreate, LocationResponse, LocationUpdate
from warehouse.domain.locations.service import LocationService


def get_location_service(repository: LocationRepository) -> LocationService:
    """Dependency for location service."""
    return LocationService(repository)


class LocationController(Controller):
    """Location controller."""

    path = "/locations"
    dependencies = {"location_service": Provide(get_location_service)}

    @post("/", status_code=HTTP_201_CREATED)
    async def create_location(
        self, data: LocationCreate, location_service: LocationService
    ) -> LocationResponse:
        """Create a new location."""
        location = await location_service.create_location(data)
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
        self, location_service: LocationService
    ) -> list[LocationResponse]:
        """List all locations."""
        locations = await location_service.get_all_locations()
        return [
            LocationResponse(
                id=l.id,
                name=l.name,
                zone=l.zone,
                shelf=l.shelf,
                bin=l.bin,
                description=l.description,
                created_at=l.created_at,
            )
            for l in locations
        ]

    @get("/{location_id:uuid}")
    async def get_location(
        self, location_id: UUID, location_service: LocationService
    ) -> LocationResponse:
        """Get location by ID."""
        location = await location_service.get_location(location_id)
        if not location:
            raise NotFoundException("Location not found")
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
        self, location_id: UUID, data: LocationUpdate, location_service: LocationService
    ) -> LocationResponse:
        """Update a location."""
        location = await location_service.update_location(location_id, data)
        if not location:
            raise NotFoundException("Location not found")
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
        self, location_id: UUID, location_service: LocationService
    ) -> None:
        """Delete a location."""
        deleted = await location_service.delete_location(location_id)
        if not deleted:
            raise NotFoundException("Location not found")

