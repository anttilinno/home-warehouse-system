"""Analytics domain service."""

from datetime import date
from uuid import UUID

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.analytics.schemas import (
    AnalyticsResponse,
    AssetValueSummary,
    CategoryBreakdown,
    InventoryByCondition,
    InventoryByStatus,
    LoanStats,
    LocationBreakdown,
    TopBorrower,
)


class AnalyticsService:
    """Analytics service for aggregating warehouse data."""

    def __init__(self, db_session: AsyncSession):
        """Initialize analytics service."""
        self.db_session = db_session

    async def get_analytics(self, workspace_id: UUID) -> AnalyticsResponse:
        """Get complete analytics for a workspace."""
        from warehouse.domain.containers.models import Container
        from warehouse.domain.inventory.models import Inventory
        from warehouse.domain.items.models import Category, Item
        from warehouse.domain.loans.models import Borrower, Loan
        from warehouse.domain.locations.models import Location

        # 1. Inventory by status (using raw SQL since column isn't in model)
        status_query = text("""
            SELECT
                COALESCE(status::text, 'UNKNOWN') as status,
                COUNT(*) as count,
                COALESCE(SUM(quantity), 0) as quantity
            FROM warehouse.inventory
            WHERE workspace_id = :workspace_id
            GROUP BY status
        """)
        status_result = await self.db_session.execute(
            status_query, {"workspace_id": workspace_id}
        )
        inventory_by_status = [
            InventoryByStatus(
                status=row.status or "UNKNOWN",
                count=row.count,
                quantity=int(row.quantity),
            )
            for row in status_result.all()
        ]

        # 2. Inventory by condition (using raw SQL since column isn't in model)
        condition_query = text("""
            SELECT
                COALESCE(condition::text, 'UNKNOWN') as condition,
                COUNT(*) as count,
                COALESCE(SUM(quantity), 0) as quantity
            FROM warehouse.inventory
            WHERE workspace_id = :workspace_id
            GROUP BY condition
        """)
        condition_result = await self.db_session.execute(
            condition_query, {"workspace_id": workspace_id}
        )
        inventory_by_condition = [
            InventoryByCondition(
                condition=row.condition or "UNKNOWN",
                count=row.count,
                quantity=int(row.quantity),
            )
            for row in condition_result.all()
        ]

        # 3. Category breakdown
        category_query = (
            select(
                Category.id,
                Category.name,
                func.count(Item.id.distinct()).label("item_count"),
                func.count(Inventory.id).label("inventory_count"),
            )
            .outerjoin(Item, Item.category_id == Category.id)
            .outerjoin(Inventory, Inventory.item_id == Item.id)
            .where(Category.workspace_id == workspace_id)
            .group_by(Category.id, Category.name)
            .order_by(func.count(Item.id.distinct()).desc())
            .limit(10)
        )
        category_result = await self.db_session.execute(category_query)
        category_breakdown = [
            CategoryBreakdown(
                category_id=str(row.id),
                category_name=row.name,
                item_count=row.item_count,
                inventory_count=row.inventory_count,
            )
            for row in category_result.all()
        ]

        # Also count uncategorized items
        uncategorized_query = (
            select(
                func.count(Item.id.distinct()).label("item_count"),
                func.count(Inventory.id).label("inventory_count"),
            )
            .outerjoin(Inventory, Inventory.item_id == Item.id)
            .where(Item.workspace_id == workspace_id)
            .where(Item.category_id.is_(None))
        )
        uncategorized_result = await self.db_session.execute(uncategorized_query)
        uncategorized = uncategorized_result.one()
        if uncategorized.item_count > 0:
            category_breakdown.append(
                CategoryBreakdown(
                    category_id=None,
                    category_name="Uncategorized",
                    item_count=uncategorized.item_count,
                    inventory_count=uncategorized.inventory_count,
                )
            )

        # 4. Location breakdown
        location_query = (
            select(
                Location.id,
                Location.name,
                func.count(Inventory.id).label("inventory_count"),
                func.coalesce(func.sum(Inventory.quantity), 0).label("total_quantity"),
            )
            .outerjoin(Inventory, Inventory.location_id == Location.id)
            .where(Location.workspace_id == workspace_id)
            .group_by(Location.id, Location.name)
            .order_by(func.count(Inventory.id).desc())
            .limit(10)
        )
        location_result = await self.db_session.execute(location_query)
        location_breakdown = [
            LocationBreakdown(
                location_id=str(row.id),
                location_name=row.name,
                inventory_count=row.inventory_count,
                total_quantity=int(row.total_quantity),
            )
            for row in location_result.all()
        ]

        # 5. Loan statistics
        today = date.today()
        loan_stats_query = (
            select(
                func.count(Loan.id).label("total_loans"),
                func.count(case((Loan.returned_at.is_(None), 1))).label("active_loans"),
                func.count(case((Loan.returned_at.isnot(None), 1))).label(
                    "returned_loans"
                ),
                func.count(
                    case(
                        (
                            (Loan.returned_at.is_(None)) & (Loan.due_date < today),
                            1,
                        )
                    )
                ).label("overdue_loans"),
            ).where(Loan.workspace_id == workspace_id)
        )
        loan_result = await self.db_session.execute(loan_stats_query)
        loan_row = loan_result.one()
        loan_stats = LoanStats(
            total_loans=loan_row.total_loans,
            active_loans=loan_row.active_loans,
            returned_loans=loan_row.returned_loans,
            overdue_loans=loan_row.overdue_loans,
        )

        # 6. Asset value (using raw SQL for purchase_price column)
        asset_query = text("""
            SELECT
                COALESCE(SUM(purchase_price * quantity), 0) as total_value,
                COUNT(*) as item_count
            FROM warehouse.inventory
            WHERE workspace_id = :workspace_id AND purchase_price IS NOT NULL
        """)
        asset_result = await self.db_session.execute(
            asset_query, {"workspace_id": workspace_id}
        )
        asset_row = asset_result.one()
        asset_value = AssetValueSummary(
            total_value=int(asset_row.total_value or 0),
            currency_code="EUR",
            item_count=asset_row.item_count,
        )

        # 7. Top borrowers
        top_borrowers_query = (
            select(
                Borrower.id,
                Borrower.name,
                func.count(case((Loan.returned_at.is_(None), 1))).label("active_loans"),
                func.count(Loan.id).label("total_loans"),
            )
            .join(Loan, Loan.borrower_id == Borrower.id)
            .where(Borrower.workspace_id == workspace_id)
            .group_by(Borrower.id, Borrower.name)
            .order_by(func.count(case((Loan.returned_at.is_(None), 1))).desc())
            .limit(5)
        )
        borrowers_result = await self.db_session.execute(top_borrowers_query)
        top_borrowers = [
            TopBorrower(
                borrower_id=str(row.id),
                borrower_name=row.name,
                active_loans=row.active_loans,
                total_loans=row.total_loans,
            )
            for row in borrowers_result.all()
        ]

        # 8. Summary counts
        total_items = await self._count(Item, workspace_id)
        total_inventory = await self._count(Inventory, workspace_id)
        total_locations = await self._count(Location, workspace_id)
        total_containers = await self._count(Container, workspace_id)

        return AnalyticsResponse(
            inventory_by_status=inventory_by_status,
            inventory_by_condition=inventory_by_condition,
            category_breakdown=category_breakdown,
            location_breakdown=location_breakdown,
            loan_stats=loan_stats,
            asset_value=asset_value,
            top_borrowers=top_borrowers,
            total_items=total_items,
            total_inventory_records=total_inventory,
            total_locations=total_locations,
            total_containers=total_containers,
        )

    async def _count(self, model: type, workspace_id: UUID) -> int:
        """Count records for a model in workspace."""
        query = (
            select(func.count())
            .select_from(model)
            .where(model.workspace_id == workspace_id)
        )
        result = await self.db_session.execute(query)
        return result.scalar() or 0
