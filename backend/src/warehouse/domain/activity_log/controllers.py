"""Activity log domain controllers."""

from uuid import UUID

from litestar import get, Request
from litestar.controller import Controller
from litestar.di import Provide
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.config import Config
from warehouse.domain.activity_log.repository import ActivityLogRepository
from warehouse.domain.activity_log.schemas import ActivityListResponse, ActivityLogResponse
from warehouse.domain.activity_log.service import ActivityLogService
from warehouse.lib.workspace import get_workspace_context


def get_activity_log_service(db_session: AsyncSession) -> ActivityLogService:
    """Dependency for activity log service."""
    repository = ActivityLogRepository(session=db_session)
    return ActivityLogService(repository)


class ActivityLogController(Controller):
    """Activity log controller."""

    path = "/activity"
    dependencies = {
        "activity_service": Provide(get_activity_log_service, sync_to_thread=False),
    }

    @get("/")
    async def get_activity(
        self,
        request: Request,
        activity_service: ActivityLogService,
        db_session: AsyncSession,
        config: Config,
        limit: int = 50,
        offset: int = 0,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        user_id: UUID | None = None,
        action: str | None = None,
    ) -> ActivityListResponse:
        """Get activity logs for the current workspace."""
        ctx = await get_workspace_context(request, db_session, config)

        return await activity_service.get_activity(
            workspace_id=ctx.workspace_id,
            limit=limit,
            offset=offset,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            action=action,
        )

    @get("/{activity_id:uuid}")
    async def get_activity_by_id(
        self,
        request: Request,
        activity_id: UUID,
        activity_service: ActivityLogService,
        db_session: AsyncSession,
        config: Config,
    ) -> ActivityLogResponse:
        """Get a single activity log entry."""
        ctx = await get_workspace_context(request, db_session, config)

        activity = await activity_service.repository.get_one_or_none(
            id=activity_id,
            workspace_id=ctx.workspace_id,
        )

        if not activity:
            from warehouse.errors import AppError, ErrorCode
            raise AppError(ErrorCode.ACTIVITY_NOT_FOUND, status_code=404)

        return ActivityLogResponse(
            id=activity.id,
            action=activity.action.value,
            entity_type=activity.entity_type.value,
            entity_id=activity.entity_id,
            entity_name=activity.entity_name,
            changes=activity.changes,
            metadata=activity.extra_data,
            user_id=activity.user_id,
            user_name=activity.user.full_name if activity.user else None,
            created_at=activity.created_at,
        )

    @get("/entity/{entity_type:str}/{entity_id:uuid}")
    async def get_entity_activity(
        self,
        request: Request,
        entity_type: str,
        entity_id: UUID,
        activity_service: ActivityLogService,
        db_session: AsyncSession,
        config: Config,
        limit: int = 50,
    ) -> list[ActivityLogResponse]:
        """Get activity logs for a specific entity."""
        ctx = await get_workspace_context(request, db_session, config)

        return await activity_service.get_entity_activity(
            workspace_id=ctx.workspace_id,
            entity_type=entity_type,
            entity_id=entity_id,
            limit=limit,
        )
