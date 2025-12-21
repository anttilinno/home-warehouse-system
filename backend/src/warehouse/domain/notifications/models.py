"""Notifications domain models."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import Base, UUIDPKMixin


class NotificationType(str, Enum):
    """Notification type enum."""

    LOAN_DUE_SOON = "LOAN_DUE_SOON"
    LOAN_OVERDUE = "LOAN_OVERDUE"
    LOAN_RETURNED = "LOAN_RETURNED"
    LOW_STOCK = "LOW_STOCK"
    WORKSPACE_INVITE = "WORKSPACE_INVITE"
    MEMBER_JOINED = "MEMBER_JOINED"
    SYSTEM = "SYSTEM"


class Notification(Base, UUIDPKMixin):
    """Notification model."""

    __tablename__ = "notifications"
    __table_args__ = {"schema": "auth"}

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("auth.workspaces.id", ondelete="CASCADE"), nullable=True
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        SAEnum(
            NotificationType,
            name="notification_type_enum",
            schema="auth",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(nullable=True)
    data: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
