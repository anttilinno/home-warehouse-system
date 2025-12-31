"""Activity log domain schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

import msgspec


class ActivityLogResponse(msgspec.Struct):
    """Schema for activity log response."""

    id: UUID
    action: str
    entity_type: str
    entity_id: UUID
    entity_name: str | None
    changes: dict[str, Any] | None
    metadata: dict[str, Any] | None
    user_id: UUID | None
    user_name: str | None
    created_at: datetime


class ActivityListResponse(msgspec.Struct):
    """Schema for activity list response with pagination."""

    items: list[ActivityLogResponse]
    total: int
    limit: int
    offset: int
