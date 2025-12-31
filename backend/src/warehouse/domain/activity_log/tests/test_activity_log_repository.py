"""Tests for ActivityLogRepository methods."""

from datetime import datetime, UTC
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock

import pytest

from warehouse.domain.activity_log.models import (
    ActivityAction,
    ActivityEntity,
    ActivityLog,
)
from warehouse.domain.activity_log.repository import ActivityLogRepository


@pytest.fixture
def workspace_id():
    """A sample workspace ID."""
    return uuid7()


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def mock_session():
    """Mock SQLAlchemy async session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def repository(mock_session):
    """Activity log repository with mocked session."""
    return ActivityLogRepository(session=mock_session)


class TestActivityLogRepositoryListByWorkspace:
    """Tests for list_by_workspace method."""

    async def test_list_by_workspace_returns_activities(
        self, repository, mock_session, workspace_id, user_id
    ):
        """Test listing activity logs for a workspace."""
        activity1 = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.CREATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=uuid7(),
            entity_name="Test Item",
            created_at=datetime.now(UTC),
        )
        activity2 = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.UPDATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=uuid7(),
            entity_name="Another Item",
            created_at=datetime.now(UTC),
        )
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [activity1, activity2]
        mock_session.execute.return_value = mock_result

        result = await repository.list_by_workspace(
            workspace_id=workspace_id, limit=50, offset=0
        )

        assert len(result) == 2
        assert result[0] == activity1
        mock_session.execute.assert_awaited_once()

    async def test_list_by_workspace_with_entity_type_filter(
        self, repository, mock_session, workspace_id, user_id
    ):
        """Test filtering by entity type."""
        activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.CREATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=uuid7(),
            entity_name="Test Item",
            created_at=datetime.now(UTC),
        )
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [activity]
        mock_session.execute.return_value = mock_result

        result = await repository.list_by_workspace(
            workspace_id=workspace_id,
            limit=50,
            offset=0,
            entity_type=ActivityEntity.ITEM,
        )

        assert len(result) == 1
        mock_session.execute.assert_awaited_once()

    async def test_list_by_workspace_with_action_filter(
        self, repository, mock_session, workspace_id, user_id
    ):
        """Test filtering by action."""
        activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.DELETE,
            entity_type=ActivityEntity.ITEM,
            entity_id=uuid7(),
            entity_name="Deleted Item",
            created_at=datetime.now(UTC),
        )
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [activity]
        mock_session.execute.return_value = mock_result

        result = await repository.list_by_workspace(
            workspace_id=workspace_id,
            limit=50,
            offset=0,
            action=ActivityAction.DELETE,
        )

        assert len(result) == 1
        mock_session.execute.assert_awaited_once()

    async def test_list_by_workspace_with_user_filter(
        self, repository, mock_session, workspace_id, user_id
    ):
        """Test filtering by user ID."""
        activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.UPDATE,
            entity_type=ActivityEntity.LOCATION,
            entity_id=uuid7(),
            entity_name="Location",
            created_at=datetime.now(UTC),
        )
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [activity]
        mock_session.execute.return_value = mock_result

        result = await repository.list_by_workspace(
            workspace_id=workspace_id,
            limit=50,
            offset=0,
            user_id=user_id,
        )

        assert len(result) == 1
        mock_session.execute.assert_awaited_once()

    async def test_list_by_workspace_empty_result(
        self, repository, mock_session, workspace_id
    ):
        """Test listing when no activities exist."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        result = await repository.list_by_workspace(
            workspace_id=workspace_id, limit=50, offset=0
        )

        assert result == []


class TestActivityLogRepositoryGetByEntity:
    """Tests for get_by_entity method."""

    async def test_get_by_entity_returns_activities(
        self, repository, mock_session, workspace_id, user_id
    ):
        """Test getting activity logs for a specific entity."""
        entity_id = uuid7()
        activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.UPDATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            entity_name="Test Item",
            created_at=datetime.now(UTC),
        )
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [activity]
        mock_session.execute.return_value = mock_result

        result = await repository.get_by_entity(
            workspace_id=workspace_id,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            limit=50,
        )

        assert len(result) == 1
        assert result[0].entity_id == entity_id
        mock_session.execute.assert_awaited_once()

    async def test_get_by_entity_empty_result(
        self, repository, mock_session, workspace_id
    ):
        """Test getting entity activities when none exist."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        result = await repository.get_by_entity(
            workspace_id=workspace_id,
            entity_type=ActivityEntity.CONTAINER,
            entity_id=uuid7(),
            limit=50,
        )

        assert result == []


class TestActivityLogRepositoryCountByWorkspace:
    """Tests for count_by_workspace method."""

    async def test_count_by_workspace_returns_count(
        self, repository, mock_session, workspace_id
    ):
        """Test counting activity logs."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 10
        mock_session.execute.return_value = mock_result

        result = await repository.count_by_workspace(workspace_id=workspace_id)

        assert result == 10
        mock_session.execute.assert_awaited_once()

    async def test_count_by_workspace_with_filters(
        self, repository, mock_session, workspace_id, user_id
    ):
        """Test counting with filters."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_session.execute.return_value = mock_result

        result = await repository.count_by_workspace(
            workspace_id=workspace_id,
            entity_type=ActivityEntity.ITEM,
            action=ActivityAction.CREATE,
            user_id=user_id,
        )

        assert result == 5
        mock_session.execute.assert_awaited_once()

    async def test_count_by_workspace_returns_zero_when_none(
        self, repository, mock_session, workspace_id
    ):
        """Test count returns 0 when no activities exist."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = None
        mock_session.execute.return_value = mock_result

        result = await repository.count_by_workspace(workspace_id=workspace_id)

        assert result == 0


class TestActivityLogRepositoryModelType:
    """Tests for repository model type."""

    def test_model_type_is_activity_log(self, repository):
        """Test that model_type is correctly set to ActivityLog."""
        assert repository.model_type is ActivityLog
