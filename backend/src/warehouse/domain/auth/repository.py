"""Authentication domain repository."""

from advanced_alchemy.repository import SQLAlchemyAsyncRepository

from warehouse.domain.auth.models import User
from warehouse.lib.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """User repository."""

    model_type = User

    async def get_by_username(self, username: str) -> User | None:
        """Get user by username."""
        return await self.get_one(username=username)

    async def get_by_email(self, email: str) -> User | None:
        """Get user by email."""
        return await self.get_one(email=email)

