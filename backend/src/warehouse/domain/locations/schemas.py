"""Locations domain schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class LocationCreate(msgspec.Struct):
    """Schema for creating a location."""

    name: str
    zone: str | None = None
    shelf: str | None = None
    bin: str | None = None
    description: str | None = None


class LocationUpdate(msgspec.Struct):
    """Schema for updating a location."""

    name: str | None = None
    zone: str | None = None
    shelf: str | None = None
    bin: str | None = None
    description: str | None = None


class LocationResponse(msgspec.Struct):
    """Schema for location response."""

    id: UUID
    name: str
    zone: str | None
    shelf: str | None
    bin: str | None
    description: str | None
    created_at: datetime

