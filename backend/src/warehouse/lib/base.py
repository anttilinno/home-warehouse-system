"""Base classes for models and repositories."""

from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from advanced_alchemy.repository import SQLAlchemyAsyncRepository
from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

ModelType = TypeVar("ModelType")


class Base(DeclarativeBase):
    """Base declarative class for SQLAlchemy models."""


class UUIDPKMixin:
    """UUID primary key mixin without sentinel column."""

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("uuidv7()"),
    )


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""

    created_at: datetime
    updated_at: datetime


class WorkspaceMixin:
    """Mixin for workspace-scoped entities (multi-tenancy)."""

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class BaseRepository(SQLAlchemyAsyncRepository[ModelType], Generic[ModelType]):
    """Base repository with common functionality."""

    async def get_by_id(self, id: UUID) -> ModelType | None:
        """Get entity by ID."""
        return await self.get_one_or_none(id=id)


