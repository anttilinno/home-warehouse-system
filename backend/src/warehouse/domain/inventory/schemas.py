"""Inventory domain schemas."""

from datetime import date, datetime
from uuid import UUID

import msgspec


class InventoryCreate(msgspec.Struct):
    """Schema for creating inventory."""

    item_id: UUID
    location_id: UUID
    quantity: int = 0
    expiration_date: date | None = None
    warranty_expires: date | None = None


class InventoryUpdate(msgspec.Struct):
    """Schema for updating inventory."""

    quantity: int | None = None
    expiration_date: date | None = None
    warranty_expires: date | None = None


class StockAdjustment(msgspec.Struct):
    """Schema for stock adjustment."""

    quantity_change: int


class InventoryResponse(msgspec.Struct):
    """Schema for inventory response."""

    id: UUID
    item_id: UUID
    location_id: UUID
    quantity: int
    expiration_date: date | None
    warranty_expires: date | None
    created_at: datetime
    updated_at: datetime

