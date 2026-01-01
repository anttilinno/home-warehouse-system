"""Base classes for models and repositories."""

from datetime import datetime
from typing import Generic, Sequence, TypeVar
from uuid import UUID

from advanced_alchemy.repository import SQLAlchemyAsyncRepository
from sqlalchemy import ForeignKey, select, text
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

    async def list_modified_since(
        self,
        workspace_id: UUID,
        modified_since: datetime | None = None,
        limit: int = 1000,
    ) -> Sequence[ModelType]:
        """Get entities modified since a timestamp for delta sync.

        Requires model to have `workspace_id` and `updated_at` columns.
        """
        stmt = select(self.model_type).where(
            self.model_type.workspace_id == workspace_id
        )

        if modified_since is not None:
            stmt = stmt.where(self.model_type.updated_at > modified_since)

        stmt = stmt.order_by(self.model_type.updated_at.asc()).limit(limit)

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_for_update(
        self,
        id: UUID,
        workspace_id: UUID,
        expected_updated_at: datetime | None = None,
    ) -> tuple[ModelType | None, bool]:
        """Get entity with optimistic locking check.

        Returns:
            Tuple of (entity, conflict) where conflict is True if
            expected_updated_at doesn't match.
        """
        entity = await self.get_one_or_none(id=id, workspace_id=workspace_id)

        if entity is None:
            return None, False

        if expected_updated_at is not None and hasattr(entity, "updated_at"):
            if entity.updated_at > expected_updated_at:
                return entity, True  # Conflict detected

        return entity, False


