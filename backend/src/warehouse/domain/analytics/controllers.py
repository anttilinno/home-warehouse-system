"""Analytics domain controllers."""

from litestar import get
from litestar.controller import Controller
from litestar.di import Provide
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.analytics.schemas import AnalyticsResponse
from warehouse.domain.analytics.service import AnalyticsService
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context


def get_analytics_service(db_session: AsyncSession) -> AnalyticsService:
    """Dependency for analytics service."""
    return AnalyticsService(db_session)


class AnalyticsController(Controller):
    """Analytics controller."""

    path = "/analytics"
    dependencies = {
        "analytics_service": Provide(get_analytics_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context, sync_to_thread=False),
    }

    @get("/")
    async def get_analytics(
        self,
        analytics_service: AnalyticsService,
        workspace: WorkspaceContext,
    ) -> AnalyticsResponse:
        """Get analytics data for the current workspace."""
        return await analytics_service.get_analytics(workspace.workspace_id)
