"""Dashboard domain schemas."""

import msgspec


class DashboardStats(msgspec.Struct):
    """Dashboard statistics response."""

    total_items: int
    total_locations: int
    active_loans: int
    total_categories: int