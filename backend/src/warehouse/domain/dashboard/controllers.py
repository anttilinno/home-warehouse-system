"""Dashboard domain controllers."""

from litestar import get
from litestar.controller import Controller
from litestar.di import Provide
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.dashboard.schemas import (
    DashboardExtendedStats,
    DashboardStats,
    InventoryAlertItem,
    InventorySummary,
    OverdueLoan,
)
from warehouse.domain.dashboard.service import DashboardService
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context


def get_dashboard_service(db_session: AsyncSession) -> DashboardService:
    """Dependency for dashboard service."""
    return DashboardService(db_session)


class DashboardController(Controller):
    """Dashboard controller."""

    path = "/dashboard"
    dependencies = {
        "dashboard_service": Provide(get_dashboard_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @get("/stats")
    async def get_stats(
        self,
        dashboard_service: DashboardService,
        workspace: WorkspaceContext,
    ) -> DashboardStats:
        """Get dashboard statistics."""
        return await dashboard_service.get_stats(workspace.workspace_id)

    @get("/stats/extended")
    async def get_extended_stats(
        self,
        dashboard_service: DashboardService,
        workspace: WorkspaceContext,
    ) -> DashboardExtendedStats:
        """Get extended dashboard statistics with alerts."""
        return await dashboard_service.get_extended_stats(workspace.workspace_id)

    @get("/recent")
    async def get_recently_modified(
        self,
        dashboard_service: DashboardService,
        workspace: WorkspaceContext,
        limit: int = 10,
    ) -> list[InventorySummary]:
        """Get recently modified inventory items."""
        return await dashboard_service.get_recently_modified(
            workspace.workspace_id, limit
        )

    @get("/alerts/out-of-stock")
    async def get_out_of_stock(
        self,
        dashboard_service: DashboardService,
        workspace: WorkspaceContext,
        limit: int = 10,
    ) -> list[InventorySummary]:
        """Get out of stock inventory items."""
        return await dashboard_service.get_out_of_stock(workspace.workspace_id, limit)

    @get("/alerts/low-stock")
    async def get_low_stock(
        self,
        dashboard_service: DashboardService,
        workspace: WorkspaceContext,
        limit: int = 10,
    ) -> list[InventorySummary]:
        """Get low stock inventory items."""
        return await dashboard_service.get_low_stock(workspace.workspace_id, limit)

    @get("/alerts/expiring")
    async def get_expiring_soon(
        self,
        dashboard_service: DashboardService,
        workspace: WorkspaceContext,
        limit: int = 10,
    ) -> list[InventoryAlertItem]:
        """Get inventory items expiring soon."""
        return await dashboard_service.get_expiring_soon(workspace.workspace_id, limit)

    @get("/alerts/warranty-expiring")
    async def get_warranty_expiring(
        self,
        dashboard_service: DashboardService,
        workspace: WorkspaceContext,
        limit: int = 10,
    ) -> list[InventoryAlertItem]:
        """Get inventory items with warranty expiring soon."""
        return await dashboard_service.get_warranty_expiring(
            workspace.workspace_id, limit
        )

    @get("/alerts/overdue-loans")
    async def get_overdue_loans(
        self,
        dashboard_service: DashboardService,
        workspace: WorkspaceContext,
        limit: int = 10,
    ) -> list[OverdueLoan]:
        """Get overdue loans."""
        return await dashboard_service.get_overdue_loans(workspace.workspace_id, limit)