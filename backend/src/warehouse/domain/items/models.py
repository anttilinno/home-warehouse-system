"""Items domain models."""

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin, WorkspaceMixin


class AttachmentType(enum.Enum):
    """Attachment type enum."""

    PHOTO = "PHOTO"
    MANUAL = "MANUAL"
    RECEIPT = "RECEIPT"
    WARRANTY = "WARRANTY"
    OTHER = "OTHER"


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
    obsidian_vault_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    obsidian_note_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
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
    attachments: Mapped[list["Attachment"]] = relationship(
        "Attachment", back_populates="item", cascade="all, delete-orphan"
    )


class Attachment(Base, UUIDPKMixin):
    """Attachment model for linking files or Docspell documents to items."""

    __tablename__ = "attachments"
    __table_args__ = {"schema": "warehouse"}

    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("warehouse.items.id", ondelete="CASCADE"), nullable=False
    )
    # file_id references warehouse.files but FK is only in DB schema (no File model yet)
    file_id: Mapped[UUID | None] = mapped_column(nullable=True)
    attachment_type: Mapped[AttachmentType] = mapped_column(
        Enum(AttachmentType, schema="warehouse", name="attachment_type_enum", create_type=False),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    docspell_item_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    item: Mapped["Item"] = relationship("Item", back_populates="attachments")

