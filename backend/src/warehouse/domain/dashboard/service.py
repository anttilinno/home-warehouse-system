"""Dashboard domain service."""

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.dashboard.schemas import (
    DashboardExtendedStats,
    DashboardStats,
    InventoryAlertItem,
    InventorySummary,
    OverdueLoan,
)


class DashboardService:
    """Dashboard service."""

    def __init__(self, db_session: AsyncSession):
        """Initialize dashboard service."""
        self.db_session = db_session

    async def get_stats(self, workspace_id: UUID | None = None) -> DashboardStats:
        """Get dashboard statistics."""
        from warehouse.domain.items.models import Category, Item
        from warehouse.domain.loans.models import Loan
        from warehouse.domain.locations.models import Location

        # Count total items
        items_query = select(func.count()).select_from(Item)
        if workspace_id:
            items_query = items_query.where(Item.workspace_id == workspace_id)
        total_items_result = await self.db_session.execute(items_query)
        total_items = total_items_result.scalar() or 0

        # Count total locations
        locations_query = select(func.count()).select_from(Location)
        if workspace_id:
            locations_query = locations_query.where(Location.workspace_id == workspace_id)
        total_locations_result = await self.db_session.execute(locations_query)
        total_locations = total_locations_result.scalar() or 0

        # Count active loans (not returned)
        active_loans_query = select(func.count()).select_from(Loan).where(
            Loan.returned_at.is_(None)
        )
        if workspace_id:
            active_loans_query = active_loans_query.where(Loan.workspace_id == workspace_id)
        active_loans_result = await self.db_session.execute(active_loans_query)
        active_loans = active_loans_result.scalar() or 0

        # Count total categories
        categories_query = select(func.count()).select_from(Category)
        if workspace_id:
            categories_query = categories_query.where(Category.workspace_id == workspace_id)
        total_categories_result = await self.db_session.execute(categories_query)
        total_categories = total_categories_result.scalar() or 0

        return DashboardStats(
            total_items=total_items,
            total_locations=total_locations,
            active_loans=active_loans,
            total_categories=total_categories,
        )

    async def get_extended_stats(self, workspace_id: UUID) -> DashboardExtendedStats:
        """Get extended dashboard statistics with alerts."""
        # Get basic stats
        basic_stats = await self.get_stats(workspace_id)

        # Total inventory value (using raw SQL for unmapped field)
        value_query = text("""
            SELECT COALESCE(SUM(purchase_price * quantity), 0) as total_value
            FROM warehouse.inventory
            WHERE workspace_id = :workspace_id AND purchase_price IS NOT NULL
        """)
        value_result = await self.db_session.execute(
            value_query, {"workspace_id": workspace_id}
        )
        total_value = value_result.scalar() or 0

        # Out of stock count
        out_of_stock_query = text("""
            SELECT COUNT(*) FROM warehouse.inventory
            WHERE workspace_id = :workspace_id AND quantity = 0
        """)
        out_of_stock_result = await self.db_session.execute(
            out_of_stock_query, {"workspace_id": workspace_id}
        )
        out_of_stock_count = out_of_stock_result.scalar() or 0

        # Low stock count (0 < quantity < 5)
        low_stock_query = text("""
            SELECT COUNT(*) FROM warehouse.inventory
            WHERE workspace_id = :workspace_id AND quantity > 0 AND quantity < 5
        """)
        low_stock_result = await self.db_session.execute(
            low_stock_query, {"workspace_id": workspace_id}
        )
        low_stock_count = low_stock_result.scalar() or 0

        # Expiring soon count (within 30 days)
        expiring_query = text("""
            SELECT COUNT(*) FROM warehouse.inventory
            WHERE workspace_id = :workspace_id
              AND expiration_date IS NOT NULL
              AND expiration_date >= CURRENT_DATE
              AND expiration_date < CURRENT_DATE + INTERVAL '30 days'
        """)
        expiring_result = await self.db_session.execute(
            expiring_query, {"workspace_id": workspace_id}
        )
        expiring_soon_count = expiring_result.scalar() or 0

        # Warranty expiring count (within 30 days)
        warranty_query = text("""
            SELECT COUNT(*) FROM warehouse.inventory
            WHERE workspace_id = :workspace_id
              AND warranty_expires IS NOT NULL
              AND warranty_expires >= CURRENT_DATE
              AND warranty_expires < CURRENT_DATE + INTERVAL '30 days'
        """)
        warranty_result = await self.db_session.execute(
            warranty_query, {"workspace_id": workspace_id}
        )
        warranty_expiring_count = warranty_result.scalar() or 0

        # Overdue loans count
        overdue_query = text("""
            SELECT COUNT(*) FROM warehouse.loans
            WHERE workspace_id = :workspace_id
              AND returned_at IS NULL
              AND due_date IS NOT NULL
              AND due_date < CURRENT_DATE
        """)
        overdue_result = await self.db_session.execute(
            overdue_query, {"workspace_id": workspace_id}
        )
        overdue_loans_count = overdue_result.scalar() or 0

        return DashboardExtendedStats(
            total_items=basic_stats.total_items,
            total_locations=basic_stats.total_locations,
            active_loans=basic_stats.active_loans,
            total_categories=basic_stats.total_categories,
            total_inventory_value=total_value,
            currency_code="EUR",
            out_of_stock_count=out_of_stock_count,
            low_stock_count=low_stock_count,
            expiring_soon_count=expiring_soon_count,
            warranty_expiring_count=warranty_expiring_count,
            overdue_loans_count=overdue_loans_count,
        )

    async def get_recently_modified(
        self, workspace_id: UUID, limit: int = 10
    ) -> list[InventorySummary]:
        """Get recently modified inventory items."""
        query = text("""
            SELECT
                i.id,
                it.name as item_name,
                it.sku as item_sku,
                l.name as location_name,
                i.quantity,
                i.updated_at
            FROM warehouse.inventory i
            JOIN warehouse.items it ON i.item_id = it.id
            JOIN warehouse.locations l ON i.location_id = l.id
            WHERE i.workspace_id = :workspace_id
            ORDER BY i.updated_at DESC
            LIMIT :limit
        """)
        result = await self.db_session.execute(
            query, {"workspace_id": workspace_id, "limit": limit}
        )
        rows = result.fetchall()
        return [
            InventorySummary(
                id=row.id,
                item_name=row.item_name,
                item_sku=row.item_sku,
                location_name=row.location_name,
                quantity=row.quantity,
                updated_at=row.updated_at,
            )
            for row in rows
        ]

    async def get_out_of_stock(
        self, workspace_id: UUID, limit: int = 10
    ) -> list[InventorySummary]:
        """Get inventory items with zero quantity."""
        query = text("""
            SELECT
                i.id,
                it.name as item_name,
                it.sku as item_sku,
                l.name as location_name,
                i.quantity,
                i.updated_at
            FROM warehouse.inventory i
            JOIN warehouse.items it ON i.item_id = it.id
            JOIN warehouse.locations l ON i.location_id = l.id
            WHERE i.workspace_id = :workspace_id AND i.quantity = 0
            ORDER BY i.updated_at DESC
            LIMIT :limit
        """)
        result = await self.db_session.execute(
            query, {"workspace_id": workspace_id, "limit": limit}
        )
        rows = result.fetchall()
        return [
            InventorySummary(
                id=row.id,
                item_name=row.item_name,
                item_sku=row.item_sku,
                location_name=row.location_name,
                quantity=row.quantity,
                updated_at=row.updated_at,
            )
            for row in rows
        ]

    async def get_low_stock(
        self, workspace_id: UUID, limit: int = 10
    ) -> list[InventorySummary]:
        """Get inventory items with low quantity (0 < qty < 5)."""
        query = text("""
            SELECT
                i.id,
                it.name as item_name,
                it.sku as item_sku,
                l.name as location_name,
                i.quantity,
                i.updated_at
            FROM warehouse.inventory i
            JOIN warehouse.items it ON i.item_id = it.id
            JOIN warehouse.locations l ON i.location_id = l.id
            WHERE i.workspace_id = :workspace_id
              AND i.quantity > 0
              AND i.quantity < 5
            ORDER BY i.quantity ASC, i.updated_at DESC
            LIMIT :limit
        """)
        result = await self.db_session.execute(
            query, {"workspace_id": workspace_id, "limit": limit}
        )
        rows = result.fetchall()
        return [
            InventorySummary(
                id=row.id,
                item_name=row.item_name,
                item_sku=row.item_sku,
                location_name=row.location_name,
                quantity=row.quantity,
                updated_at=row.updated_at,
            )
            for row in rows
        ]

    async def get_expiring_soon(
        self, workspace_id: UUID, limit: int = 10
    ) -> list[InventoryAlertItem]:
        """Get inventory items expiring within 30 days."""
        query = text("""
            SELECT
                i.id,
                it.name as item_name,
                it.sku as item_sku,
                l.name as location_name,
                i.quantity,
                i.expiration_date
            FROM warehouse.inventory i
            JOIN warehouse.items it ON i.item_id = it.id
            JOIN warehouse.locations l ON i.location_id = l.id
            WHERE i.workspace_id = :workspace_id
              AND i.expiration_date IS NOT NULL
              AND i.expiration_date >= CURRENT_DATE
              AND i.expiration_date < CURRENT_DATE + INTERVAL '30 days'
            ORDER BY i.expiration_date ASC
            LIMIT :limit
        """)
        result = await self.db_session.execute(
            query, {"workspace_id": workspace_id, "limit": limit}
        )
        rows = result.fetchall()
        return [
            InventoryAlertItem(
                id=row.id,
                item_name=row.item_name,
                item_sku=row.item_sku,
                location_name=row.location_name,
                quantity=row.quantity,
                expiration_date=row.expiration_date,
            )
            for row in rows
        ]

    async def get_warranty_expiring(
        self, workspace_id: UUID, limit: int = 10
    ) -> list[InventoryAlertItem]:
        """Get inventory items with warranty expiring within 30 days."""
        query = text("""
            SELECT
                i.id,
                it.name as item_name,
                it.sku as item_sku,
                l.name as location_name,
                i.quantity,
                i.warranty_expires
            FROM warehouse.inventory i
            JOIN warehouse.items it ON i.item_id = it.id
            JOIN warehouse.locations l ON i.location_id = l.id
            WHERE i.workspace_id = :workspace_id
              AND i.warranty_expires IS NOT NULL
              AND i.warranty_expires >= CURRENT_DATE
              AND i.warranty_expires < CURRENT_DATE + INTERVAL '30 days'
            ORDER BY i.warranty_expires ASC
            LIMIT :limit
        """)
        result = await self.db_session.execute(
            query, {"workspace_id": workspace_id, "limit": limit}
        )
        rows = result.fetchall()
        return [
            InventoryAlertItem(
                id=row.id,
                item_name=row.item_name,
                item_sku=row.item_sku,
                location_name=row.location_name,
                quantity=row.quantity,
                warranty_expires=row.warranty_expires,
            )
            for row in rows
        ]

    async def get_overdue_loans(
        self, workspace_id: UUID, limit: int = 10
    ) -> list[OverdueLoan]:
        """Get overdue loans with borrower and item details."""
        query = text("""
            SELECT
                lo.id,
                b.name as borrower_name,
                it.name as item_name,
                lo.quantity,
                lo.due_date,
                (CURRENT_DATE - lo.due_date) as days_overdue
            FROM warehouse.loans lo
            JOIN warehouse.borrowers b ON lo.borrower_id = b.id
            JOIN warehouse.inventory inv ON lo.inventory_id = inv.id
            JOIN warehouse.items it ON inv.item_id = it.id
            WHERE lo.workspace_id = :workspace_id
              AND lo.returned_at IS NULL
              AND lo.due_date IS NOT NULL
              AND lo.due_date < CURRENT_DATE
            ORDER BY lo.due_date ASC
            LIMIT :limit
        """)
        result = await self.db_session.execute(
            query, {"workspace_id": workspace_id, "limit": limit}
        )
        rows = result.fetchall()
        return [
            OverdueLoan(
                id=row.id,
                borrower_name=row.borrower_name,
                item_name=row.item_name,
                quantity=row.quantity,
                due_date=row.due_date,
                days_overdue=row.days_overdue,
            )
            for row in rows
        ]