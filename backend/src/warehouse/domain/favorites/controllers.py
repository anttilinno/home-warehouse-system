"""Favorites domain controllers."""

from uuid import UUID

from litestar import delete, get, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.favorites.repository import FavoriteRepository
from warehouse.domain.favorites.schemas import (
    CheckFavoriteResponse,
    FavoriteCreate,
    FavoriteResponse,
    FavoriteWithDetails,
    ToggleFavoriteResponse,
)
from warehouse.domain.favorites.service import FavoriteService
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context


def get_favorite_service(db_session: AsyncSession) -> FavoriteService:
    """Dependency for favorite service."""
    repository = FavoriteRepository(session=db_session)
    return FavoriteService(repository, db_session)


class FavoriteController(Controller):
    """Favorite controller."""

    path = "/favorites"
    dependencies = {
        "favorite_service": Provide(get_favorite_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @get("/")
    async def list_favorites(
        self,
        favorite_service: FavoriteService,
        workspace: WorkspaceContext,
    ) -> list[FavoriteWithDetails]:
        """List all favorites for current user."""
        return await favorite_service.get_favorites_with_details(
            workspace.user_id, workspace.workspace_id
        )

    @post("/", status_code=HTTP_201_CREATED)
    async def add_favorite(
        self,
        data: FavoriteCreate,
        favorite_service: FavoriteService,
        workspace: WorkspaceContext,
    ) -> FavoriteResponse:
        """Add a new favorite."""
        favorite = await favorite_service.add_favorite(
            data, workspace.user_id, workspace.workspace_id
        )
        return FavoriteResponse(
            id=favorite.id,
            favorite_type=favorite.favorite_type.value,
            item_id=favorite.item_id,
            location_id=favorite.location_id,
            container_id=favorite.container_id,
            created_at=favorite.created_at,
        )

    @post("/toggle/{favorite_type:str}/{entity_id:uuid}")
    async def toggle_favorite(
        self,
        favorite_type: str,
        entity_id: UUID,
        favorite_service: FavoriteService,
        workspace: WorkspaceContext,
    ) -> ToggleFavoriteResponse:
        """Toggle favorite status for an entity."""
        is_favorited, favorite = await favorite_service.toggle_favorite(
            favorite_type, entity_id, workspace.user_id, workspace.workspace_id
        )
        return ToggleFavoriteResponse(
            is_favorited=is_favorited,
            favorite_id=favorite.id if favorite else None,
        )

    @get("/check/{favorite_type:str}/{entity_id:uuid}")
    async def check_favorite(
        self,
        favorite_type: str,
        entity_id: UUID,
        favorite_service: FavoriteService,
        workspace: WorkspaceContext,
    ) -> CheckFavoriteResponse:
        """Check if entity is favorited."""
        is_favorited = await favorite_service.is_favorited(
            favorite_type, entity_id, workspace.user_id
        )
        return CheckFavoriteResponse(is_favorited=is_favorited)

    @delete("/{favorite_type:str}/{entity_id:uuid}")
    async def remove_favorite(
        self,
        favorite_type: str,
        entity_id: UUID,
        favorite_service: FavoriteService,
        workspace: WorkspaceContext,
    ) -> None:
        """Remove a favorite."""
        await favorite_service.remove_favorite(
            favorite_type, entity_id, workspace.user_id, workspace.workspace_id
        )
