"""Dashboard domain controllers."""

from litestar import get
from litestar.controller import Controller
from litestar.di import Provide
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.dashboard.schemas import DashboardStats
from warehouse.domain.dashboard.service import DashboardService


def get_dashboard_service(db_session: AsyncSession) -> DashboardService:
    """Dependency for dashboard service."""
    return DashboardService(db_session)


class DashboardController(Controller):
    """Dashboard controller."""

    path = "/dashboard"
    dependencies = {"dashboard_service": Provide(get_dashboard_service, sync_to_thread=False)}

    @get("/stats")
    async def get_stats(self, dashboard_service: DashboardService) -> DashboardStats:
        """Get dashboard statistics."""
        return await dashboard_service.get_stats()