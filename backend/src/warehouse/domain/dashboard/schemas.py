"""Dashboard domain schemas."""

from datetime import date, datetime
from uuid import UUID

import msgspec


class DashboardStats(msgspec.Struct):
    """Dashboard statistics response."""

    total_items: int
    total_locations: int
    active_loans: int
    total_categories: int


class DashboardExtendedStats(msgspec.Struct):
    """Extended dashboard statistics with alerts."""

    total_items: int
    total_locations: int
    active_loans: int
    total_categories: int
    total_inventory_value: int  # In cents
    currency_code: str
    out_of_stock_count: int
    low_stock_count: int
    expiring_soon_count: int
    warranty_expiring_count: int
    overdue_loans_count: int


class InventorySummary(msgspec.Struct):
    """Inventory summary for dashboard lists."""

    id: UUID
    item_name: str
    item_sku: str
    location_name: str
    quantity: int
    updated_at: datetime


class InventoryAlertItem(msgspec.Struct):
    """Inventory item for alert lists (includes date fields)."""

    id: UUID
    item_name: str
    item_sku: str
    location_name: str
    quantity: int
    expiration_date: date | None = None
    warranty_expires: date | None = None


class OverdueLoan(msgspec.Struct):
    """Overdue loan summary."""

    id: UUID
    borrower_name: str
    item_name: str
    quantity: int
    due_date: date
    days_overdue: int