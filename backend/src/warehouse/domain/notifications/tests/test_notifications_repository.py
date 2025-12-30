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


class TestNotificationRepositoryGetForUser:
    """Tests for get_for_user method."""

    async def test_get_for_user_returns_notifications(
        self, repository, mock_session, user_id
    ):
        """Test getting notifications for a user."""
        notification1 = Notification(
            id=uuid7(),
            user_id=user_id,
            title="Test 1",
            message="Message 1",
            is_read=False,
            created_at=datetime.now(UTC),
        )
        notification2 = Notification(
            id=uuid7(),
            user_id=user_id,
            title="Test 2",
            message="Message 2",
            is_read=True,
            created_at=datetime.now(UTC),
        )
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [notification1, notification2]
        mock_session.execute.return_value = mock_result

        result = await repository.get_for_user(user_id, limit=50, offset=0)

        assert len(result) == 2
        assert result[0] == notification1
        mock_session.execute.assert_awaited_once()

    async def test_get_for_user_with_unread_only(
        self, repository, mock_session, user_id
    ):
        """Test getting only unread notifications."""
        notification1 = Notification(
            id=uuid7(),
            user_id=user_id,
            title="Unread",
            message="Message",
            is_read=False,
            created_at=datetime.now(UTC),
        )
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [notification1]
        mock_session.execute.return_value = mock_result

        result = await repository.get_for_user(user_id, limit=50, offset=0, unread_only=True)

        assert len(result) == 1
        mock_session.execute.assert_awaited_once()

    async def test_get_for_user_empty_list(self, repository, mock_session, user_id):
        """Test getting notifications when none exist."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        result = await repository.get_for_user(user_id, limit=50, offset=0)

        assert result == []

    async def test_get_for_user_with_pagination(
        self, repository, mock_session, user_id
    ):
        """Test getting notifications with pagination."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute.return_value = mock_result

        await repository.get_for_user(user_id, limit=10, offset=20)

        mock_session.execute.assert_awaited_once()


class TestNotificationRepositoryCountUnread:
    """Tests for count_unread method."""

    async def test_count_unread_returns_count(self, repository, mock_session, user_id):
        """Test counting unread notifications."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_session.execute.return_value = mock_result

        result = await repository.count_unread(user_id)

        assert result == 5
        mock_session.execute.assert_awaited_once()

    async def test_count_unread_returns_zero_when_none(
        self, repository, mock_session, user_id
    ):
        """Test count_unread returns 0 when no unread notifications."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = None
        mock_session.execute.return_value = mock_result

        result = await repository.count_unread(user_id)

        assert result == 0


class TestNotificationRepositoryCountTotal:
    """Tests for count_total method."""

    async def test_count_total_returns_count(self, repository, mock_session, user_id):
        """Test counting total notifications."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = 10
        mock_session.execute.return_value = mock_result

        result = await repository.count_total(user_id)

        assert result == 10
        mock_session.execute.assert_awaited_once()

    async def test_count_total_returns_zero_when_none(
        self, repository, mock_session, user_id
    ):
        """Test count_total returns 0 when no notifications."""
        mock_result = MagicMock()
        mock_result.scalar.return_value = None
        mock_session.execute.return_value = mock_result

        result = await repository.count_total(user_id)

        assert result == 0


class TestNotificationRepositoryModelType:
    """Tests for repository model type."""

    def test_model_type_is_notification(self, repository):
        """Test that model_type is correctly set to Notification."""
        assert repository.model_type is Notification
