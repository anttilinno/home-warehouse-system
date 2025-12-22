"""Notifications domain repository."""

from datetime import datetime, UTC
from uuid import UUID

from sqlalchemy import select, update, func

from warehouse.domain.notifications.models import Notification
from warehouse.lib.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    """Notification repository."""

    model_type = Notification

    async def get_for_user(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> list[Notification]:
        """Get notifications for a user."""
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if unread_only:
            stmt = stmt.where(Notification.is_read == False)  # noqa: E712
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_unread(self, user_id: UUID) -> int:
        """Count unread notifications for a user."""
        stmt = (
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == False)  # noqa: E712
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def count_total(self, user_id: UUID) -> int:
        """Count total notifications for a user."""
        stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id
        )
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def mark_as_read(
        self, user_id: UUID, notification_ids: list[UUID] | None = None
    ) -> int:
        """Mark notifications as read. If notification_ids is None, mark all as read."""
        # TODO: Fix timezone mismatch - datetime.now(UTC) returns timezone-aware datetime
        # but read_at column is TIMESTAMP WITHOUT TIME ZONE. Use datetime.utcnow() or
        # change the column to TIMESTAMP WITH TIME ZONE.
        now = datetime.now(UTC)
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == False)  # noqa: E712
            .values(is_read=True, read_at=now)
        )
        if notification_ids:
            stmt = stmt.where(Notification.id.in_(notification_ids))
        result = await self.session.execute(stmt)
        return result.rowcount

    async def delete_old_read(self, user_id: UUID, days: int = 30) -> int:
        """Delete read notifications older than specified days."""
        from sqlalchemy import delete
        from datetime import timedelta

        cutoff = datetime.now(UTC) - timedelta(days=days)
        stmt = (
            delete(Notification)
            .where(Notification.user_id == user_id)
            .where(Notification.is_read == True)  # noqa: E712
            .where(Notification.created_at < cutoff)
        )
        result = await self.session.execute(stmt)
        return result.rowcount
