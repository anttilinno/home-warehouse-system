"""Locations domain models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin, WorkspaceMixin


class Location(Base, UUIDPKMixin, WorkspaceMixin, TimestampMixin):
    """Location model."""

    __tablename__ = "locations"
    __table_args__ = {"schema": "warehouse"}

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_location_id: Mapped[UUID | None] = mapped_column(
        "parent_location",
        ForeignKey("warehouse.locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    zone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shelf: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    short_code: Mapped[str | None] = mapped_column(String(8), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

