"""Sync domain models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.domain.activity_log.models import ActivityEntity
from warehouse.lib.base import Base, UUIDPKMixin


class DeletedRecord(Base, UUIDPKMixin):
    """Tombstone model for tracking deleted records for PWA offline sync."""

    __tablename__ = "deleted_records"
    __table_args__ = {"schema": "warehouse"}

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
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
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    deleted_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True
    )
