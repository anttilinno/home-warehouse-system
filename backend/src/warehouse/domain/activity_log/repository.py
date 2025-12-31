"""Activity log domain repository."""

from uuid import UUID

from sqlalchemy import func, select

from warehouse.domain.activity_log.models import ActivityAction, ActivityEntity, ActivityLog
from warehouse.lib.base import BaseRepository


class ActivityLogRepository(BaseRepository[ActivityLog]):
    """Activity log repository."""

    model_type = ActivityLog

    async def list_by_workspace(
        self,
        workspace_id: UUID,
        limit: int = 50,
        offset: int = 0,
        entity_type: ActivityEntity | None = None,
        entity_id: UUID | None = None,
        user_id: UUID | None = None,
        action: ActivityAction | None = None,
    ) -> list[ActivityLog]:
        """List activity logs for a workspace with optional filters."""
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.workspace_id == workspace_id)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        if entity_type is not None:
            stmt = stmt.where(ActivityLog.entity_type == entity_type)
        if entity_id is not None:
            stmt = stmt.where(ActivityLog.entity_id == entity_id)
        if user_id is not None:
            stmt = stmt.where(ActivityLog.user_id == user_id)
        if action is not None:
            stmt = stmt.where(ActivityLog.action == action)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_entity(
        self,
        workspace_id: UUID,
        entity_type: ActivityEntity,
        entity_id: UUID,
        limit: int = 50,
    ) -> list[ActivityLog]:
        """Get activity logs for a specific entity."""
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.workspace_id == workspace_id)
            .where(ActivityLog.entity_type == entity_type)
            .where(ActivityLog.entity_id == entity_id)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_workspace(
        self,
        workspace_id: UUID,
        entity_type: ActivityEntity | None = None,
        entity_id: UUID | None = None,
        user_id: UUID | None = None,
        action: ActivityAction | None = None,
    ) -> int:
        """Count activity logs for a workspace with optional filters."""
        stmt = select(func.count(ActivityLog.id)).where(
            ActivityLog.workspace_id == workspace_id
        )

        if entity_type is not None:
            stmt = stmt.where(ActivityLog.entity_type == entity_type)
        if entity_id is not None:
            stmt = stmt.where(ActivityLog.entity_id == entity_id)
        if user_id is not None:
            stmt = stmt.where(ActivityLog.user_id == user_id)
        if action is not None:
            stmt = stmt.where(ActivityLog.action == action)

        result = await self.session.execute(stmt)
        return result.scalar() or 0
