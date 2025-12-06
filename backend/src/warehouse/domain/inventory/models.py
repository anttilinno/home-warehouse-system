"""Inventory domain models."""

from datetime import datetime
from uuid import UUID

from advanced_alchemy.base import UUIDPrimaryKey
from sqlalchemy import ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import TimestampMixin


class Inventory(UUIDPrimaryKey, TimestampMixin):
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
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships would be defined here if needed
    # item: Mapped["Item"] = relationship("Item")
    # location: Mapped["Location"] = relationship("Location")

