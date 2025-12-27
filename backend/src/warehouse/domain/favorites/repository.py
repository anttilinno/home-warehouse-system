"""Favorites domain repository."""

from uuid import UUID

from warehouse.domain.favorites.models import Favorite
from warehouse.lib.base import BaseRepository


class FavoriteRepository(BaseRepository[Favorite]):
    """Favorite repository."""

    model_type = Favorite

    async def get_by_user_and_entity(
        self, user_id: UUID, favorite_type: str, entity_id: UUID
    ) -> Favorite | None:
        """Get favorite by user and entity."""
        if favorite_type == "ITEM":
            return await self.get_one_or_none(user_id=user_id, item_id=entity_id)
        elif favorite_type == "LOCATION":
            return await self.get_one_or_none(user_id=user_id, location_id=entity_id)
        elif favorite_type == "CONTAINER":
            return await self.get_one_or_none(user_id=user_id, container_id=entity_id)
        return None

    async def list_by_user_and_workspace(
        self, user_id: UUID, workspace_id: UUID
    ) -> list[Favorite]:
        """Get all favorites for a user in a workspace."""
        return await self.list(user_id=user_id, workspace_id=workspace_id)
