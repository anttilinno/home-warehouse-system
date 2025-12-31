"""Activity log domain models."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import Base, UUIDPKMixin


class ActivityAction(str, Enum):
    """Activity action enum matching database activity_action_enum."""

    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    MOVE = "MOVE"
    LOAN = "LOAN"
    RETURN = "RETURN"


class ActivityEntity(str, Enum):
    """Activity entity type enum matching database activity_entity_enum."""

    ITEM = "ITEM"
    INVENTORY = "INVENTORY"
    LOCATION = "LOCATION"
    CONTAINER = "CONTAINER"
    CATEGORY = "CATEGORY"
    LABEL = "LABEL"
    LOAN = "LOAN"
    BORROWER = "BORROWER"


class ActivityLog(Base, UUIDPKMixin):
    """Activity log model for tracking changes."""

    __tablename__ = "activity_log"
    __table_args__ = {"schema": "warehouse"}

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("auth.users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[ActivityAction] = mapped_column(
        SAEnum(
            ActivityAction,
            name="activity_action_enum",
            schema="warehouse",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    entity_type: Mapped[ActivityEntity] = mapped_column(
        SAEnum(
            ActivityEntity,
            name="activity_entity_enum",
            schema="warehouse",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    entity_id: Mapped[UUID] = mapped_column(nullable=False)
    entity_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata", JSONB, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationship to user for getting user details
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
