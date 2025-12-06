"""Items domain models."""

from datetime import datetime
from uuid import UUID

from advanced_alchemy.base import UUIDPrimaryKey
from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import TimestampMixin


class Category(UUIDPrimaryKey):
    """Category model."""

    __tablename__ = "categories"
    __table_args__ = {"schema": "warehouse"}

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    items: Mapped[list["Item"]] = relationship("Item", back_populates="category")


class Item(UUIDPrimaryKey, TimestampMixin):
    """Item model."""

    __tablename__ = "items"
    __table_args__ = {"schema": "warehouse"}

    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("warehouse.categories.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[Category | None] = relationship("Category", back_populates="items")

