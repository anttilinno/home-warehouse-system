"""Docspell settings repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.docspell.models import WorkspaceDocspellSettings
from warehouse.lib.base import BaseRepository


class DocspellSettingsRepository(BaseRepository[WorkspaceDocspellSettings]):
    """Repository for Docspell settings."""

    model_type = WorkspaceDocspellSettings

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with session."""
        super().__init__(session=session)

    async def get_by_workspace(self, workspace_id: UUID) -> WorkspaceDocspellSettings | None:
        """Get settings for a workspace."""
        stmt = select(WorkspaceDocspellSettings).where(
            WorkspaceDocspellSettings.workspace_id == workspace_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
