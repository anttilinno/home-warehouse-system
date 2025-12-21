"""Analytics domain schemas."""

import msgspec


class InventoryByStatus(msgspec.Struct):
    """Inventory count grouped by status."""

    status: str
    count: int
    quantity: int


class InventoryByCondition(msgspec.Struct):
    """Inventory count grouped by condition."""

    condition: str
    count: int
    quantity: int


class CategoryBreakdown(msgspec.Struct):
    """Items count by category."""

    category_id: str | None
    category_name: str
    item_count: int
    inventory_count: int


class LocationBreakdown(msgspec.Struct):
    """Inventory count by location."""

    location_id: str
    location_name: str
    inventory_count: int
    total_quantity: int


class LoanStats(msgspec.Struct):
    """Loan statistics."""

    total_loans: int
    active_loans: int
    returned_loans: int
    overdue_loans: int


class AssetValueSummary(msgspec.Struct):
    """Total asset value calculation."""

    total_value: int  # In cents
    currency_code: str
    item_count: int


class TopBorrower(msgspec.Struct):
    """Top borrower by loan count."""

    borrower_id: str
    borrower_name: str
    active_loans: int
    total_loans: int


class AnalyticsResponse(msgspec.Struct):
    """Complete analytics response."""

    inventory_by_status: list[InventoryByStatus]
    inventory_by_condition: list[InventoryByCondition]
    category_breakdown: list[CategoryBreakdown]
    location_breakdown: list[LocationBreakdown]
    loan_stats: LoanStats
    asset_value: AssetValueSummary
    top_borrowers: list[TopBorrower]
    total_items: int
    total_inventory_records: int
    total_locations: int
    total_containers: int
