"""Tests for the favorites domain repository."""

from uuid import uuid7
from unittest.mock import AsyncMock

import pytest

from warehouse.domain.favorites.models import Favorite, FavoriteType
from warehouse.domain.favorites.repository import FavoriteRepository


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def workspace_id():
    """A sample workspace ID."""
    return uuid7()


@pytest.fixture
def session_mock():
    """Mock database session."""
    return AsyncMock()


@pytest.fixture
def repository(session_mock):
    """Favorite repository with mocked session."""
    repo = FavoriteRepository(session=session_mock)
    repo.get_one_or_none = AsyncMock()
    repo.list = AsyncMock()
    return repo


class TestFavoriteRepositoryGetByUserAndEntity:
    """Tests for get_by_user_and_entity method."""

    async def test_get_by_user_and_entity_item(self, repository, user_id):
        """Test get_by_user_and_entity for ITEM type."""
        item_id = uuid7()
        expected_favorite = AsyncMock(spec=Favorite)
        repository.get_one_or_none.return_value = expected_favorite

        result = await repository.get_by_user_and_entity(user_id, "ITEM", item_id)

        repository.get_one_or_none.assert_called_once_with(user_id=user_id, item_id=item_id)
        assert result == expected_favorite

    async def test_get_by_user_and_entity_location(self, repository, user_id):
        """Test get_by_user_and_entity for LOCATION type."""
        location_id = uuid7()
        expected_favorite = AsyncMock(spec=Favorite)
        repository.get_one_or_none.return_value = expected_favorite

        result = await repository.get_by_user_and_entity(user_id, "LOCATION", location_id)

        repository.get_one_or_none.assert_called_once_with(user_id=user_id, location_id=location_id)
        assert result == expected_favorite

    async def test_get_by_user_and_entity_container(self, repository, user_id):
        """Test get_by_user_and_entity for CONTAINER type."""
        container_id = uuid7()
        expected_favorite = AsyncMock(spec=Favorite)
        repository.get_one_or_none.return_value = expected_favorite

        result = await repository.get_by_user_and_entity(user_id, "CONTAINER", container_id)

        repository.get_one_or_none.assert_called_once_with(user_id=user_id, container_id=container_id)
        assert result == expected_favorite

    async def test_get_by_user_and_entity_unknown_type(self, repository, user_id):
        """Test get_by_user_and_entity for unknown type returns None."""
        entity_id = uuid7()

        result = await repository.get_by_user_and_entity(user_id, "UNKNOWN", entity_id)

        repository.get_one_or_none.assert_not_called()
        assert result is None


class TestFavoriteRepositoryListByUserAndWorkspace:
    """Tests for list_by_user_and_workspace method."""

    async def test_list_by_user_and_workspace(self, repository, user_id, workspace_id):
        """Test list_by_user_and_workspace returns favorites."""
        expected_favorites = [AsyncMock(spec=Favorite), AsyncMock(spec=Favorite)]
        repository.list.return_value = expected_favorites

        result = await repository.list_by_user_and_workspace(user_id, workspace_id)

        repository.list.assert_called_once_with(user_id=user_id, workspace_id=workspace_id)
        assert result == expected_favorites

    async def test_list_by_user_and_workspace_empty(self, repository, user_id, workspace_id):
        """Test list_by_user_and_workspace returns empty list."""
        repository.list.return_value = []

        result = await repository.list_by_user_and_workspace(user_id, workspace_id)

        repository.list.assert_called_once_with(user_id=user_id, workspace_id=workspace_id)
        assert result == []
