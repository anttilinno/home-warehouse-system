"""Docspell integration models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin


class WorkspaceDocspellSettings(Base, UUIDPKMixin, TimestampMixin):
    """Per-workspace Docspell configuration."""

    __tablename__ = "workspace_docspell_settings"
    __table_args__ = {"schema": "auth"}

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.workspaces.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    collective_name: Mapped[str] = mapped_column(String(100), nullable=False)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    password_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    sync_tags_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
