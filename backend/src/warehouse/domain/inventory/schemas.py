"""Inventory domain schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class InventoryCreate(msgspec.Struct):
    """Schema for creating inventory."""

    item_id: UUID
    location_id: UUID
    quantity: int = 0


class InventoryUpdate(msgspec.Struct):
    """Schema for updating inventory."""

    quantity: int


class StockAdjustment(msgspec.Struct):
    """Schema for stock adjustment."""

    quantity_change: int


class InventoryResponse(msgspec.Struct):
    """Schema for inventory response."""

    id: UUID
    item_id: UUID
    location_id: UUID
    quantity: int
    created_at: datetime
    updated_at: datetime

