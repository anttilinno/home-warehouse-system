"""Containers domain schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class ContainerCreate(msgspec.Struct):
    """Schema for creating a container."""

    name: str
    location_id: UUID
    description: str | None = None
    capacity: str | None = None
    short_code: str | None = None


class ContainerUpdate(msgspec.Struct):
    """Schema for updating a container."""

    name: str | None = None
    location_id: UUID | None = None
    description: str | None = None
    capacity: str | None = None
    short_code: str | None = None


class ContainerResponse(msgspec.Struct):
    """Schema for container response."""

    id: UUID
    name: str
    location_id: UUID
    location_name: str | None
    description: str | None
    capacity: str | None
    short_code: str | None
    created_at: datetime
    updated_at: datetime
