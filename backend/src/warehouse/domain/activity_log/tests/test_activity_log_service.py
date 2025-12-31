"""Tests for the activity_log domain service."""

from datetime import datetime, UTC
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock

import pytest

from warehouse.domain.activity_log.models import (
    ActivityAction,
    ActivityEntity,
    ActivityLog,
)
from warehouse.domain.activity_log.service import ActivityLogService


@pytest.fixture
def workspace_id():
    """A sample workspace ID."""
    return uuid7()


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def activity_log_repository_mock():
    """Mock activity log repository."""
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.list_by_workspace = AsyncMock()
    repo.get_by_entity = AsyncMock()
    repo.count_by_workspace = AsyncMock()
    repo.session = AsyncMock()
    repo.session.commit = AsyncMock()
    return repo


@pytest.fixture
def service(activity_log_repository_mock):
    """Activity log service with mocked repository."""
    return ActivityLogService(repository=activity_log_repository_mock)


@pytest.fixture
def sample_activity(workspace_id, user_id):
    """A sample activity log entry."""
    mock_user = MagicMock()
    mock_user.full_name = "Test User"
    activity = ActivityLog(
        id=uuid7(),
        workspace_id=workspace_id,
        user_id=user_id,
        action=ActivityAction.CREATE,
        entity_type=ActivityEntity.ITEM,
        entity_id=uuid7(),
        entity_name="Test Item",
        changes={"name": {"old": None, "new": "Test Item"}},
        extra_data={"source": "test"},
        created_at=datetime.now(UTC),
    )
    activity.user = mock_user
    return activity


class TestActivityLogServiceLogAction:
    """Tests for log_action method."""

    async def test_log_action_success(
        self, service, activity_log_repository_mock, workspace_id, user_id
    ):
        """Test logging an action."""
        entity_id = uuid7()
        expected_activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.CREATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            entity_name="New Item",
            changes=None,
            extra_data=None,
            created_at=datetime.now(UTC),
        )
        activity_log_repository_mock.add.return_value = expected_activity

        result = await service.log_action(
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.CREATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            entity_name="New Item",
        )

        assert result == expected_activity
        activity_log_repository_mock.add.assert_awaited_once()
        activity_log_repository_mock.session.commit.assert_awaited_once()

        # Verify the activity passed to add has correct attributes
        added_activity = activity_log_repository_mock.add.call_args[0][0]
        assert added_activity.workspace_id == workspace_id
        assert added_activity.user_id == user_id
        assert added_activity.action == ActivityAction.CREATE
        assert added_activity.entity_type == ActivityEntity.ITEM
        assert added_activity.entity_id == entity_id
        assert added_activity.entity_name == "New Item"

    async def test_log_action_with_changes(
        self, service, activity_log_repository_mock, workspace_id, user_id
    ):
        """Test logging an action with changes."""
        entity_id = uuid7()
        changes = {"name": {"old": "Old Name", "new": "New Name"}}
        expected_activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.UPDATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            entity_name="Item",
            changes=changes,
            created_at=datetime.now(UTC),
        )
        activity_log_repository_mock.add.return_value = expected_activity

        result = await service.log_action(
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.UPDATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            entity_name="Item",
            changes=changes,
        )

        added_activity = activity_log_repository_mock.add.call_args[0][0]
        assert added_activity.changes == changes

    async def test_log_action_with_extra_data(
        self, service, activity_log_repository_mock, workspace_id, user_id
    ):
        """Test logging an action with extra data."""
        entity_id = uuid7()
        extra_data = {"previous_location": "Shelf A", "new_location": "Shelf B"}
        expected_activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.MOVE,
            entity_type=ActivityEntity.INVENTORY,
            entity_id=entity_id,
            entity_name="Item Instance",
            extra_data=extra_data,
            created_at=datetime.now(UTC),
        )
        activity_log_repository_mock.add.return_value = expected_activity

        await service.log_action(
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.MOVE,
            entity_type=ActivityEntity.INVENTORY,
            entity_id=entity_id,
            entity_name="Item Instance",
            extra_data=extra_data,
        )

        added_activity = activity_log_repository_mock.add.call_args[0][0]
        assert added_activity.extra_data == extra_data

    async def test_log_action_without_user(
        self, service, activity_log_repository_mock, workspace_id
    ):
        """Test logging an action without a user (system action)."""
        entity_id = uuid7()
        expected_activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=None,
            action=ActivityAction.DELETE,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            entity_name="Deleted Item",
            created_at=datetime.now(UTC),
        )
        activity_log_repository_mock.add.return_value = expected_activity

        await service.log_action(
            workspace_id=workspace_id,
            user_id=None,
            action=ActivityAction.DELETE,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            entity_name="Deleted Item",
        )

        added_activity = activity_log_repository_mock.add.call_args[0][0]
        assert added_activity.user_id is None


class TestActivityLogServiceGetActivity:
    """Tests for get_activity method."""

    async def test_get_activity_success(
        self, service, activity_log_repository_mock, sample_activity, workspace_id
    ):
        """Test getting activity logs for a workspace."""
        activity_log_repository_mock.list_by_workspace.return_value = [sample_activity]
        activity_log_repository_mock.count_by_workspace.return_value = 1

        result = await service.get_activity(
            workspace_id=workspace_id, limit=50, offset=0
        )

        activity_log_repository_mock.list_by_workspace.assert_awaited_once()
        activity_log_repository_mock.count_by_workspace.assert_awaited_once()
        assert result.total == 1
        assert result.limit == 50
        assert result.offset == 0
        assert len(result.items) == 1
        assert result.items[0].action == "CREATE"
        assert result.items[0].entity_type == "ITEM"
        assert result.items[0].user_name == "Test User"

    async def test_get_activity_empty(
        self, service, activity_log_repository_mock, workspace_id
    ):
        """Test getting activity when none exist."""
        activity_log_repository_mock.list_by_workspace.return_value = []
        activity_log_repository_mock.count_by_workspace.return_value = 0

        result = await service.get_activity(
            workspace_id=workspace_id, limit=50, offset=0
        )

        assert result.total == 0
        assert len(result.items) == 0

    async def test_get_activity_with_entity_type_filter(
        self, service, activity_log_repository_mock, sample_activity, workspace_id
    ):
        """Test getting activity with entity type filter."""
        activity_log_repository_mock.list_by_workspace.return_value = [sample_activity]
        activity_log_repository_mock.count_by_workspace.return_value = 1

        await service.get_activity(
            workspace_id=workspace_id, limit=50, offset=0, entity_type="ITEM"
        )

        call_args = activity_log_repository_mock.list_by_workspace.call_args
        assert call_args.kwargs["entity_type"] == ActivityEntity.ITEM

    async def test_get_activity_with_action_filter(
        self, service, activity_log_repository_mock, sample_activity, workspace_id
    ):
        """Test getting activity with action filter."""
        activity_log_repository_mock.list_by_workspace.return_value = [sample_activity]
        activity_log_repository_mock.count_by_workspace.return_value = 1

        await service.get_activity(
            workspace_id=workspace_id, limit=50, offset=0, action="CREATE"
        )

        call_args = activity_log_repository_mock.list_by_workspace.call_args
        assert call_args.kwargs["action"] == ActivityAction.CREATE

    async def test_get_activity_with_user_filter(
        self, service, activity_log_repository_mock, sample_activity, workspace_id, user_id
    ):
        """Test getting activity with user filter."""
        activity_log_repository_mock.list_by_workspace.return_value = [sample_activity]
        activity_log_repository_mock.count_by_workspace.return_value = 1

        await service.get_activity(
            workspace_id=workspace_id, limit=50, offset=0, user_id=user_id
        )

        call_args = activity_log_repository_mock.list_by_workspace.call_args
        assert call_args.kwargs["user_id"] == user_id


class TestActivityLogServiceGetEntityActivity:
    """Tests for get_entity_activity method."""

    async def test_get_entity_activity_success(
        self, service, activity_log_repository_mock, sample_activity, workspace_id
    ):
        """Test getting activity for a specific entity."""
        activity_log_repository_mock.get_by_entity.return_value = [sample_activity]

        result = await service.get_entity_activity(
            workspace_id=workspace_id,
            entity_type="ITEM",
            entity_id=sample_activity.entity_id,
            limit=50,
        )

        activity_log_repository_mock.get_by_entity.assert_awaited_once()
        assert len(result) == 1
        assert result[0].action == "CREATE"
        assert result[0].entity_type == "ITEM"

    async def test_get_entity_activity_empty(
        self, service, activity_log_repository_mock, workspace_id
    ):
        """Test getting entity activity when none exist."""
        activity_log_repository_mock.get_by_entity.return_value = []

        result = await service.get_entity_activity(
            workspace_id=workspace_id,
            entity_type="CONTAINER",
            entity_id=uuid7(),
            limit=50,
        )

        assert result == []

    async def test_get_entity_activity_user_name_none_when_no_user(
        self, service, activity_log_repository_mock, workspace_id
    ):
        """Test that user_name is None when activity has no user."""
        activity = ActivityLog(
            id=uuid7(),
            workspace_id=workspace_id,
            user_id=None,
            action=ActivityAction.DELETE,
            entity_type=ActivityEntity.ITEM,
            entity_id=uuid7(),
            entity_name="System Deleted Item",
            created_at=datetime.now(UTC),
        )
        activity.user = None
        activity_log_repository_mock.get_by_entity.return_value = [activity]

        result = await service.get_entity_activity(
            workspace_id=workspace_id,
            entity_type="ITEM",
            entity_id=activity.entity_id,
            limit=50,
        )

        assert result[0].user_name is None
