"""Notifications domain service."""

from uuid import UUID

from warehouse.domain.notifications.models import Notification, NotificationType
from warehouse.domain.notifications.repository import NotificationRepository
from warehouse.domain.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
)


class NotificationService:
    """Notification service."""

    def __init__(self, repository: NotificationRepository):
        """Initialize notification service."""
        self.repository = repository

    async def get_notifications(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        """Get notifications for a user."""
        notifications = await self.repository.get_for_user(
            user_id=user_id,
            limit=limit,
            offset=offset,
            unread_only=unread_only,
        )
        unread_count = await self.repository.count_unread(user_id)
        total_count = await self.repository.count_total(user_id)

        return NotificationListResponse(
            notifications=[
                NotificationResponse(
                    id=n.id,
                    notification_type=n.notification_type.value,
                    title=n.title,
                    message=n.message,
                    is_read=n.is_read,
                    workspace_id=n.workspace_id,
                    metadata=n.data,
                    created_at=n.created_at,
                    read_at=n.read_at,
                )
                for n in notifications
            ],
            unread_count=unread_count,
            total_count=total_count,
        )

    async def get_unread_count(self, user_id: UUID) -> int:
        """Get unread notification count for a user."""
        return await self.repository.count_unread(user_id)

    async def mark_as_read(
        self, user_id: UUID, notification_ids: list[UUID] | None = None
    ) -> int:
        """Mark notifications as read."""
        count = await self.repository.mark_as_read(user_id, notification_ids)
        await self.repository.session.commit()
        return count

    async def create_notification(
        self,
        user_id: UUID,
        notification_type: NotificationType,
        title: str,
        message: str,
        workspace_id: UUID | None = None,
        metadata: dict | None = None,
    ) -> Notification:
        """Create a notification."""
        notification = Notification(
            user_id=user_id,
            workspace_id=workspace_id,
            notification_type=notification_type,
            title=title,
            message=message,
            data=metadata,
        )
        notification = await self.repository.add(notification)
        await self.repository.session.commit()
        return notification

    async def send_workspace_invite_notification(
        self,
        user_id: UUID,
        workspace_id: UUID,
        workspace_name: str,
        role: str,
        invited_by_name: str,
    ) -> Notification:
        """Send a workspace invite notification."""
        title = f"Invited to {workspace_name}"
        message = f"{invited_by_name} invited you to join '{workspace_name}' as {role}."
        metadata = {
            "workspace_id": str(workspace_id),
            "workspace_name": workspace_name,
            "role": role,
            "invited_by": invited_by_name,
        }
        return await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.WORKSPACE_INVITE,
            title=title,
            message=message,
            workspace_id=workspace_id,
            metadata=metadata,
        )

    async def send_member_joined_notification(
        self,
        user_id: UUID,
        workspace_id: UUID,
        workspace_name: str,
        new_member_name: str,
        role: str,
    ) -> Notification:
        """Send a notification when a new member joins a workspace."""
        title = f"New member in {workspace_name}"
        message = f"{new_member_name} joined '{workspace_name}' as {role}."
        metadata = {
            "workspace_id": str(workspace_id),
            "workspace_name": workspace_name,
            "new_member": new_member_name,
            "role": role,
        }
        return await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.MEMBER_JOINED,
            title=title,
            message=message,
            workspace_id=workspace_id,
            metadata=metadata,
        )

    async def send_loan_due_notification(
        self,
        user_id: UUID,
        workspace_id: UUID,
        item_name: str,
        borrower_name: str,
        due_date: str,
    ) -> Notification:
        """Send a loan due soon notification."""
        title = "Loan Due Soon"
        message = f"'{item_name}' loaned to {borrower_name} is due on {due_date}."
        metadata = {
            "item_name": item_name,
            "borrower_name": borrower_name,
            "due_date": due_date,
        }
        return await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.LOAN_DUE_SOON,
            title=title,
            message=message,
            workspace_id=workspace_id,
            metadata=metadata,
        )

    async def send_loan_overdue_notification(
        self,
        user_id: UUID,
        workspace_id: UUID,
        item_name: str,
        borrower_name: str,
        due_date: str,
    ) -> Notification:
        """Send a loan overdue notification."""
        title = "Loan Overdue"
        message = f"'{item_name}' loaned to {borrower_name} was due on {due_date}."
        metadata = {
            "item_name": item_name,
            "borrower_name": borrower_name,
            "due_date": due_date,
        }
        return await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.LOAN_OVERDUE,
            title=title,
            message=message,
            workspace_id=workspace_id,
            metadata=metadata,
        )
