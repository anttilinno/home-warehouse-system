"""Notifications domain schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

import msgspec


class NotificationResponse(msgspec.Struct):
    """Schema for notification response."""

    id: UUID
    notification_type: str
    title: str
    message: str
    is_read: bool
    workspace_id: UUID | None
    metadata: dict[str, Any] | None
    created_at: datetime
    read_at: datetime | None = None


class NotificationListResponse(msgspec.Struct):
    """Schema for notification list response."""

    notifications: list[NotificationResponse]
    unread_count: int
    total_count: int


class NotificationMarkReadRequest(msgspec.Struct):
    """Schema for marking notifications as read."""

    notification_ids: list[UUID] | None = None  # None means mark all as read
