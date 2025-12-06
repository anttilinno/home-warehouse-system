"""Locations domain models."""

from datetime import datetime

from advanced_alchemy.base import UUIDPrimaryKey
from sqlalchemy import String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.lib.base import TimestampMixin


class Location(UUIDPrimaryKey, TimestampMixin):
    """Location model."""

    __tablename__ = "locations"
    __table_args__ = {"schema": "warehouse"}

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    zone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shelf: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

