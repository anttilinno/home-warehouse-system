"""Activity log domain service."""

from typing import Any
from uuid import UUID

from warehouse.domain.activity_log.models import ActivityAction, ActivityEntity, ActivityLog
from warehouse.domain.activity_log.repository import ActivityLogRepository
from warehouse.domain.activity_log.schemas import ActivityListResponse, ActivityLogResponse


class ActivityLogService:
    """Activity log service for tracking changes."""

    def __init__(self, repository: ActivityLogRepository):
        """Initialize activity log service."""
        self.repository = repository

    async def log_action(
        self,
        workspace_id: UUID,
        user_id: UUID | None,
        action: ActivityAction,
        entity_type: ActivityEntity,
        entity_id: UUID,
        entity_name: str | None = None,
        changes: dict[str, Any] | None = None,
        extra_data: dict[str, Any] | None = None,
    ) -> ActivityLog:
        """Log an activity action."""
        activity = ActivityLog(
            workspace_id=workspace_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            changes=changes,
            extra_data=extra_data,
        )
        activity = await self.repository.add(activity)
        await self.repository.session.commit()
        return activity

    async def get_activity(
        self,
        workspace_id: UUID,
        limit: int = 50,
        offset: int = 0,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        user_id: UUID | None = None,
        action: str | None = None,
    ) -> ActivityListResponse:
        """Get activity logs for a workspace with filters."""
        # Convert string filters to enums if provided
        entity_type_enum = ActivityEntity(entity_type) if entity_type else None
        action_enum = ActivityAction(action) if action else None

        activities = await self.repository.list_by_workspace(
            workspace_id=workspace_id,
            limit=limit,
            offset=offset,
            entity_type=entity_type_enum,
            entity_id=entity_id,
            user_id=user_id,
            action=action_enum,
        )

        total = await self.repository.count_by_workspace(
            workspace_id=workspace_id,
            entity_type=entity_type_enum,
            entity_id=entity_id,
            user_id=user_id,
            action=action_enum,
        )

        return ActivityListResponse(
            items=[
                ActivityLogResponse(
                    id=a.id,
                    action=a.action.value,
                    entity_type=a.entity_type.value,
                    entity_id=a.entity_id,
                    entity_name=a.entity_name,
                    changes=a.changes,
                    metadata=a.extra_data,
                    user_id=a.user_id,
                    user_name=a.user.full_name if a.user else None,
                    created_at=a.created_at,
                )
                for a in activities
            ],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get_entity_activity(
        self,
        workspace_id: UUID,
        entity_type: str,
        entity_id: UUID,
        limit: int = 50,
    ) -> list[ActivityLogResponse]:
        """Get activity logs for a specific entity."""
        entity_type_enum = ActivityEntity(entity_type)

        activities = await self.repository.get_by_entity(
            workspace_id=workspace_id,
            entity_type=entity_type_enum,
            entity_id=entity_id,
            limit=limit,
        )

        return [
            ActivityLogResponse(
                id=a.id,
                action=a.action.value,
                entity_type=a.entity_type.value,
                entity_id=a.entity_id,
                entity_name=a.entity_name,
                changes=a.changes,
                metadata=a.extra_data,
                user_id=a.user_id,
                user_name=a.user.full_name if a.user else None,
                created_at=a.created_at,
            )
            for a in activities
        ]
