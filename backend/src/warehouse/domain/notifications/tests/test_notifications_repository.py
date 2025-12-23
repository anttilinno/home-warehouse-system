"""Tests for NotificationRepository methods."""

from datetime import datetime, UTC
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock

import pytest

from warehouse.domain.notifications.models import Notification
from warehouse.domain.notifications.repository import NotificationRepository


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
    """Notification repository with mocked session."""
    return NotificationRepository(session=mock_session)


class TestNotificationRepositoryMarkAsRead:
    """Tests for mark_as_read method."""

    async def test_mark_as_read_all_unread(self, repository, mock_session, user_id):
        """Test marking all unread notifications as read."""
        mock_result = MagicMock()
        mock_result.rowcount = 5
        mock_session.execute.return_value = mock_result

        result = await repository.mark_as_read(user_id, notification_ids=None)

        assert result == 5
        mock_session.execute.assert_awaited_once()
        # Verify the statement was an UPDATE
        call_args = mock_session.execute.call_args[0][0]
        # The statement should be an update statement
        assert "UPDATE" in str(call_args).upper() or hasattr(call_args, "is_update")

    async def test_mark_as_read_specific_ids(self, repository, mock_session, user_id):
        """Test marking specific notifications as read."""
        notification_ids = [uuid7(), uuid7()]
        mock_result = MagicMock()
        mock_result.rowcount = 2
        mock_session.execute.return_value = mock_result

        result = await repository.mark_as_read(user_id, notification_ids=notification_ids)

        assert result == 2
        mock_session.execute.assert_awaited_once()

    async def test_mark_as_read_returns_zero_when_none_updated(
        self, repository, mock_session, user_id
    ):
        """Test mark_as_read returns 0 when no notifications were updated."""
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_session.execute.return_value = mock_result

        result = await repository.mark_as_read(user_id, notification_ids=None)

        assert result == 0


class TestNotificationRepositoryDeleteOldRead:
    """Tests for delete_old_read method."""

    async def test_delete_old_read_success(self, repository, mock_session, user_id):
        """Test deleting old read notifications."""
        mock_result = MagicMock()
        mock_result.rowcount = 10
        mock_session.execute.return_value = mock_result

        result = await repository.delete_old_read(user_id, days=30)

        assert result == 10
        mock_session.execute.assert_awaited_once()

    async def test_delete_old_read_custom_days(self, repository, mock_session, user_id):
        """Test deleting with custom retention period."""
        mock_result = MagicMock()
        mock_result.rowcount = 5
        mock_session.execute.return_value = mock_result

        result = await repository.delete_old_read(user_id, days=7)

        assert result == 5
        mock_session.execute.assert_awaited_once()

    async def test_delete_old_read_returns_zero_when_none_deleted(
        self, repository, mock_session, user_id
    ):
        """Test delete_old_read returns 0 when no notifications were deleted."""
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_session.execute.return_value = mock_result

        result = await repository.delete_old_read(user_id, days=30)

        assert result == 0


class TestNotificationRepositoryModelType:
    """Tests for repository model type."""

    def test_model_type_is_notification(self, repository):
        """Test that model_type is correctly set to Notification."""
        assert repository.model_type is Notification
