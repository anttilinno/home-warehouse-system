"""Containers domain models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin, WorkspaceMixin


class Container(Base, UUIDPKMixin, WorkspaceMixin, TimestampMixin):
    """Container model."""

    __tablename__ = "containers"
    __table_args__ = {"schema": "warehouse"}

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location_id: Mapped[UUID] = mapped_column(
        ForeignKey("warehouse.locations.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    capacity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    short_code: Mapped[str | None] = mapped_column(String(8), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location: Mapped["Location"] = relationship("Location", lazy="selectin")


# Import Location for relationship typing
from warehouse.domain.locations.models import Location
