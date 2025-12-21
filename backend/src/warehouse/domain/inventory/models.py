"""Inventory domain models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin, WorkspaceMixin


class Inventory(Base, UUIDPKMixin, WorkspaceMixin, TimestampMixin):
    """Inventory model."""

    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint("item_id", "location_id"),
        {"schema": "warehouse"},
    )

    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("warehouse.items.id"), nullable=False
    )
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("warehouse.locations.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

