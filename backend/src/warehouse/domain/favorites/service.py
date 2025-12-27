"""Favorites domain service."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.favorites.models import Favorite, FavoriteType
from warehouse.domain.favorites.repository import FavoriteRepository
from warehouse.domain.favorites.schemas import FavoriteCreate, FavoriteWithDetails
from warehouse.errors import AppError, ErrorCode


class FavoriteService:
    """Favorite service."""

    def __init__(self, repository: FavoriteRepository, db_session: AsyncSession):
        """Initialize favorite service."""
        self.repository = repository
        self.db_session = db_session

    async def add_favorite(
        self, data: FavoriteCreate, user_id: UUID, workspace_id: UUID
    ) -> Favorite:
        """Add a new favorite."""
        # Determine entity_id based on type
        if data.favorite_type == "ITEM":
            entity_id = data.item_id
        elif data.favorite_type == "LOCATION":
            entity_id = data.location_id
        elif data.favorite_type == "CONTAINER":
            entity_id = data.container_id
        else:
            raise AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=400)

        if not entity_id:
            raise AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=400)

        # Check if already favorited
        existing = await self.repository.get_by_user_and_entity(
            user_id, data.favorite_type, entity_id
        )
        if existing:
            return existing  # Already favorited, return existing

        favorite = Favorite(
            user_id=user_id,
            workspace_id=workspace_id,
            favorite_type=FavoriteType(data.favorite_type),
            item_id=data.item_id,
            location_id=data.location_id,
            container_id=data.container_id,
        )
        favorite = await self.repository.add(favorite)
        await self.repository.session.commit()
        return favorite

    async def remove_favorite(
        self, favorite_type: str, entity_id: UUID, user_id: UUID, workspace_id: UUID
    ) -> bool:
        """Remove a favorite."""
        favorite = await self.repository.get_by_user_and_entity(
            user_id, favorite_type, entity_id
        )
        if not favorite or favorite.workspace_id != workspace_id:
            return False

        await self.repository.delete(favorite.id)
        await self.repository.session.commit()
        return True

    async def toggle_favorite(
        self, favorite_type: str, entity_id: UUID, user_id: UUID, workspace_id: UUID
    ) -> tuple[bool, Favorite | None]:
        """Toggle favorite status. Returns (is_now_favorited, favorite_or_none)."""
        existing = await self.repository.get_by_user_and_entity(
            user_id, favorite_type, entity_id
        )
        if existing and existing.workspace_id == workspace_id:
            await self.repository.delete(existing.id)
            await self.repository.session.commit()
            return (False, None)
        else:
            # Create FavoriteCreate based on type
            data = FavoriteCreate(
                favorite_type=favorite_type,
                item_id=entity_id if favorite_type == "ITEM" else None,
                location_id=entity_id if favorite_type == "LOCATION" else None,
                container_id=entity_id if favorite_type == "CONTAINER" else None,
            )
            favorite = await self.add_favorite(data, user_id, workspace_id)
            return (True, favorite)

    async def list_favorites(
        self, user_id: UUID, workspace_id: UUID
    ) -> list[Favorite]:
        """Get all favorites for a user in a workspace."""
        return await self.repository.list_by_user_and_workspace(user_id, workspace_id)

    async def is_favorited(
        self, favorite_type: str, entity_id: UUID, user_id: UUID
    ) -> bool:
        """Check if an entity is favorited by the user."""
        existing = await self.repository.get_by_user_and_entity(
            user_id, favorite_type, entity_id
        )
        return existing is not None

    async def get_favorites_with_details(
        self, user_id: UUID, workspace_id: UUID
    ) -> list[FavoriteWithDetails]:
        """Get favorites with entity details using raw SQL."""
        query = text("""
            SELECT
                f.id,
                f.favorite_type,
                COALESCE(f.item_id, f.location_id, f.container_id) as entity_id,
                COALESCE(i.name, l.name, c.name) as entity_name,
                COALESCE(i.description, l.description, c.description) as entity_description,
                f.created_at
            FROM warehouse.favorites f
            LEFT JOIN warehouse.items i ON f.item_id = i.id
            LEFT JOIN warehouse.locations l ON f.location_id = l.id
            LEFT JOIN warehouse.containers c ON f.container_id = c.id
            WHERE f.user_id = :user_id AND f.workspace_id = :workspace_id
            ORDER BY f.created_at DESC
        """)
        result = await self.db_session.execute(
            query, {"user_id": user_id, "workspace_id": workspace_id}
        )
        rows = result.fetchall()
        return [
            FavoriteWithDetails(
                id=row.id,
                favorite_type=row.favorite_type,
                entity_id=row.entity_id,
                entity_name=row.entity_name or "Unknown",
                entity_description=row.entity_description,
                created_at=row.created_at,
            )
            for row in rows
        ]
