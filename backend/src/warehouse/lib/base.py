"""Base classes for models and repositories."""

from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from advanced_alchemy.repository import SQLAlchemyAsyncRepository

ModelType = TypeVar("ModelType")


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""

    created_at: datetime
    updated_at: datetime


class BaseRepository(SQLAlchemyAsyncRepository[ModelType], Generic[ModelType]):
    """Base repository with common functionality."""

    async def get_by_id(self, id: UUID) -> ModelType | None:
        """Get entity by ID."""
        return await self.get_one(id=id)


