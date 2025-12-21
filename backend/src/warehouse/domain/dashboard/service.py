"""Dashboard domain service."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.dashboard.schemas import DashboardStats


class DashboardService:
    """Dashboard service."""

    def __init__(self, db_session: AsyncSession):
        """Initialize dashboard service."""
        self.db_session = db_session

    async def get_stats(self) -> DashboardStats:
        """Get dashboard statistics."""
        from warehouse.domain.items.models import Item, Category
        from warehouse.domain.locations.models import Location
        from warehouse.domain.loans.models import Loan

        # Count total items
        items_query = select(func.count()).select_from(Item)
        total_items_result = await self.db_session.execute(items_query)
        total_items = total_items_result.scalar() or 0

        # Count total locations
        locations_query = select(func.count()).select_from(Location)
        total_locations_result = await self.db_session.execute(locations_query)
        total_locations = total_locations_result.scalar() or 0

        # Count active loans (not returned)
        active_loans_query = select(func.count()).select_from(Loan).where(Loan.returned_at.is_(None))
        active_loans_result = await self.db_session.execute(active_loans_query)
        active_loans = active_loans_result.scalar() or 0

        # Count total categories
        categories_query = select(func.count()).select_from(Category)
        total_categories_result = await self.db_session.execute(categories_query)
        total_categories = total_categories_result.scalar() or 0

        return DashboardStats(
            total_items=total_items,
            total_locations=total_locations,
            active_loans=active_loans,
            total_categories=total_categories,
        )