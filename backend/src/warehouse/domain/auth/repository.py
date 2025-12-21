"""Authentication domain repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from warehouse.domain.auth.models import User, Workspace, WorkspaceMember
from warehouse.lib.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """User repository."""

    model_type = User

    async def get_by_email(self, email: str) -> User | None:
        """Get user by email."""
        return await self.get_one_or_none(email=email)

    async def get_with_workspaces(self, user_id: UUID) -> User | None:
        """Get user with their workspace memberships loaded."""
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.workspace_memberships).selectinload(WorkspaceMember.workspace))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


class WorkspaceRepository(BaseRepository[Workspace]):
    """Workspace repository."""

    model_type = Workspace

    async def get_by_slug(self, slug: str) -> Workspace | None:
        """Get workspace by slug."""
        return await self.get_one_or_none(slug=slug)


class WorkspaceMemberRepository(BaseRepository[WorkspaceMember]):
    """Workspace member repository."""

    model_type = WorkspaceMember

