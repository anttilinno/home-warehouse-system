"""Items domain models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin, WorkspaceMixin


class Category(Base, UUIDPKMixin, WorkspaceMixin):
    """Category model for hierarchical item organization."""

    __tablename__ = "categories"
    __table_args__ = {"schema": "warehouse"}

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("warehouse.categories.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["Item"]] = relationship("Item", back_populates="category")
    parent: Mapped["Category | None"] = relationship(
        "Category", remote_side="Category.id", back_populates="children"
    )
    children: Mapped[list["Category"]] = relationship("Category", back_populates="parent")


class Item(Base, UUIDPKMixin, WorkspaceMixin, TimestampMixin):
    """Item model."""

    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("workspace_id", "sku", name="uq_items_workspace_sku"),
        {"schema": "warehouse"},
    )

    sku: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("warehouse.categories.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[Category | None] = relationship("Category", back_populates="items")

