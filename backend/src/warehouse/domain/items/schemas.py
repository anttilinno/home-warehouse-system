"""Items domain schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class CategoryCreate(msgspec.Struct):
    """Schema for creating a category."""

    name: str
    parent_category_id: UUID | None = None
    description: str | None = None


class CategoryUpdate(msgspec.Struct):
    """Schema for updating a category."""

    name: str | None = None
    parent_category_id: UUID | None = None
    description: str | None = None


class CategoryResponse(msgspec.Struct):
    """Schema for category response."""

    id: UUID
    name: str
    parent_category_id: UUID | None
    description: str | None
    created_at: datetime
    updated_at: datetime


class ItemCreate(msgspec.Struct):
    """Schema for creating an item."""

    sku: str
    name: str
    description: str | None = None
    category_id: UUID | None = None
    short_code: str | None = None
    obsidian_vault_path: str | None = None
    obsidian_note_path: str | None = None


class ItemUpdate(msgspec.Struct):
    """Schema for updating an item."""

    name: str | None = None
    description: str | None = None
    category_id: UUID | None = None
    short_code: str | None = None
    obsidian_vault_path: str | None = None
    obsidian_note_path: str | None = None


class ItemResponse(msgspec.Struct):
    """Schema for item response."""

    id: UUID
    sku: str
    name: str
    description: str | None
    category_id: UUID | None
    created_at: datetime
    updated_at: datetime
    short_code: str | None = None
    obsidian_vault_path: str | None = None
    obsidian_note_path: str | None = None
    obsidian_url: str | None = None

