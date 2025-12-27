"""Tests for the favorites domain service."""

from datetime import datetime, timezone
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock

import pytest

from warehouse.domain.favorites.models import Favorite, FavoriteType
from warehouse.domain.favorites.schemas import FavoriteCreate
from warehouse.domain.favorites.service import FavoriteService


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def workspace_id():
    """A sample workspace ID."""
    return uuid7()


@pytest.fixture
def item_id():
    """A sample item ID."""
    return uuid7()


@pytest.fixture
def favorite_repository_mock():
    """Mock favorite repository."""
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.delete = AsyncMock()
    repo.get_by_user_and_entity = AsyncMock(return_value=None)
    repo.list_by_user_and_workspace = AsyncMock(return_value=[])
    repo.session = AsyncMock()
    repo.session.commit = AsyncMock()
    return repo


@pytest.fixture
def db_session_mock():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def service(favorite_repository_mock, db_session_mock):
    """Favorite service with mocked repository."""
    return FavoriteService(repository=favorite_repository_mock, db_session=db_session_mock)


@pytest.fixture
def sample_favorite(user_id, workspace_id, item_id):
    """A sample favorite."""
    fav = MagicMock(spec=Favorite)
    fav.id = uuid7()
    fav.user_id = user_id
    fav.workspace_id = workspace_id
    fav.favorite_type = FavoriteType.ITEM
    fav.item_id = item_id
    fav.location_id = None
    fav.container_id = None
    fav.created_at = datetime.now(timezone.utc)
    return fav


class TestFavoriteServiceAddFavorite:
    """Tests for add_favorite method."""

    async def test_add_favorite_item(
        self, service, favorite_repository_mock, user_id, workspace_id, item_id
    ):
        """Test adding an item to favorites."""
        data = FavoriteCreate(favorite_type="ITEM", item_id=item_id)

        favorite_repository_mock.add.return_value = MagicMock(
            id=uuid7(),
            user_id=user_id,
            workspace_id=workspace_id,
            favorite_type=FavoriteType.ITEM,
            item_id=item_id,
        )

        result = await service.add_favorite(data, user_id, workspace_id)

        favorite_repository_mock.add.assert_called_once()
        favorite_repository_mock.session.commit.assert_called_once()
        assert result.item_id == item_id

    async def test_add_favorite_already_exists(
        self, service, favorite_repository_mock, sample_favorite, user_id, workspace_id, item_id
    ):
        """Test adding a favorite that already exists returns existing."""
        favorite_repository_mock.get_by_user_and_entity.return_value = sample_favorite

        data = FavoriteCreate(favorite_type="ITEM", item_id=item_id)
        result = await service.add_favorite(data, user_id, workspace_id)

        # Should return existing, not add new
        favorite_repository_mock.add.assert_not_called()
        assert result == sample_favorite


class TestFavoriteServiceToggleFavorite:
    """Tests for toggle_favorite method."""

    async def test_toggle_adds_when_not_exists(
        self, service, favorite_repository_mock, user_id, workspace_id, item_id
    ):
        """Test toggle adds favorite when it doesn't exist."""
        favorite_repository_mock.get_by_user_and_entity.return_value = None
        favorite_repository_mock.add.return_value = MagicMock(
            id=uuid7(),
            favorite_type=FavoriteType.ITEM,
            item_id=item_id,
        )

        is_favorited, favorite = await service.toggle_favorite(
            "ITEM", item_id, user_id, workspace_id
        )

        assert is_favorited is True
        assert favorite is not None

    async def test_toggle_removes_when_exists(
        self, service, favorite_repository_mock, sample_favorite, user_id, workspace_id, item_id
    ):
        """Test toggle removes favorite when it exists."""
        favorite_repository_mock.get_by_user_and_entity.return_value = sample_favorite

        is_favorited, favorite = await service.toggle_favorite(
            "ITEM", item_id, user_id, workspace_id
        )

        assert is_favorited is False
        assert favorite is None
        favorite_repository_mock.delete.assert_called_once_with(sample_favorite.id)


class TestFavoriteServiceIsFavorited:
    """Tests for is_favorited method."""

    async def test_is_favorited_true(
        self, service, favorite_repository_mock, sample_favorite, user_id, item_id
    ):
        """Test is_favorited returns True when favorited."""
        favorite_repository_mock.get_by_user_and_entity.return_value = sample_favorite

        result = await service.is_favorited("ITEM", item_id, user_id)

        assert result is True

    async def test_is_favorited_false(
        self, service, favorite_repository_mock, user_id, item_id
    ):
        """Test is_favorited returns False when not favorited."""
        favorite_repository_mock.get_by_user_and_entity.return_value = None

        result = await service.is_favorited("ITEM", item_id, user_id)

        assert result is False


class TestFavoriteServiceListFavorites:
    """Tests for list_favorites method."""

    async def test_list_favorites_empty(
        self, service, favorite_repository_mock, user_id, workspace_id
    ):
        """Test list_favorites returns empty list."""
        favorite_repository_mock.list_by_user_and_workspace.return_value = []

        result = await service.list_favorites(user_id, workspace_id)

        assert result == []

    async def test_list_favorites_with_items(
        self, service, favorite_repository_mock, sample_favorite, user_id, workspace_id
    ):
        """Test list_favorites returns favorites."""
        favorite_repository_mock.list_by_user_and_workspace.return_value = [sample_favorite]

        result = await service.list_favorites(user_id, workspace_id)

        assert len(result) == 1
        assert result[0] == sample_favorite
