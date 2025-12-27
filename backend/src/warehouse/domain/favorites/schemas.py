"""Favorites domain schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class FavoriteCreate(msgspec.Struct):
    """Schema for creating a favorite."""

    favorite_type: str  # "ITEM", "LOCATION", or "CONTAINER"
    item_id: UUID | None = None
    location_id: UUID | None = None
    container_id: UUID | None = None


class FavoriteResponse(msgspec.Struct):
    """Schema for favorite response."""

    id: UUID
    favorite_type: str
    item_id: UUID | None
    location_id: UUID | None
    container_id: UUID | None
    created_at: datetime


class FavoriteWithDetails(msgspec.Struct):
    """Schema for favorite with entity details."""

    id: UUID
    favorite_type: str
    entity_id: UUID
    entity_name: str
    entity_description: str | None
    created_at: datetime


class ToggleFavoriteResponse(msgspec.Struct):
    """Schema for toggle favorite response."""

    is_favorited: bool
    favorite_id: UUID | None


class CheckFavoriteResponse(msgspec.Struct):
    """Schema for check favorite response."""

    is_favorited: bool
