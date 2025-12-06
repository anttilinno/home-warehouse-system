"""Locations domain repository."""

from advanced_alchemy.repository import SQLAlchemyAsyncRepository

from warehouse.domain.locations.models import Location
from warehouse.lib.base import BaseRepository


class LocationRepository(BaseRepository[Location]):
    """Location repository."""

    model_type = Location

