"""Tests for the notifications domain service."""

from uuid import uuid7
from unittest.mock import AsyncMock

import pytest

from conftest import TEST_USER_JANE_DOE, TEST_USER_JOHN_DOE, TEST_WORKSPACE_NAME
from warehouse.domain.notifications.models import Notification, NotificationType
from warehouse.domain.notifications.service import NotificationService

# Test constants
_TEST_NOTIFICATION_TITLE = "Test Notification"
_TEST_NOTIFICATION_MESSAGE = "This is a test notification"


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def workspace_id():
    """A sample workspace ID."""
    return uuid7()


@pytest.fixture
def notification_repository_mock():
    """Mock notification repository."""
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.mark_as_read = AsyncMock()
    repo.delete_old_read = AsyncMock()
    repo.session = AsyncMock()
    repo.session.commit = AsyncMock()
    return repo


@pytest.fixture
def service(notification_repository_mock):
    """Notification service with mocked repository."""
    return NotificationService(repository=notification_repository_mock)


@pytest.fixture
def sample_notification(user_id, workspace_id):
    """A sample notification."""
    return Notification(
        id=uuid7(),
        user_id=user_id,
        workspace_id=workspace_id,
        notification_type=NotificationType.SYSTEM,
        title=_TEST_NOTIFICATION_TITLE,
        message=_TEST_NOTIFICATION_MESSAGE,
        is_read=False,
        data=None,
    )


class TestNotificationServiceGetNotifications:
    """Tests for get_notifications method."""

    async def test_get_notifications_success(
        self, service, notification_repository_mock, sample_notification, user_id
    ):
        """Test getting notifications for a user."""
        notification_repository_mock.get_for_user = AsyncMock(return_value=[sample_notification])
        notification_repository_mock.count_unread = AsyncMock(return_value=1)
        notification_repository_mock.count_total = AsyncMock(return_value=1)

        result = await service.get_notifications(user_id, limit=50, offset=0, unread_only=False)

        notification_repository_mock.get_for_user.assert_awaited_once_with(
            user_id=user_id, limit=50, offset=0, unread_only=False
        )
        notification_repository_mock.count_unread.assert_awaited_once_with(user_id)
        notification_repository_mock.count_total.assert_awaited_once_with(user_id)
        assert result.total_count == 1
        assert result.unread_count == 1
        assert len(result.notifications) == 1
        assert result.notifications[0].title == _TEST_NOTIFICATION_TITLE

    async def test_get_notifications_empty(
        self, service, notification_repository_mock, user_id
    ):
        """Test getting notifications when none exist."""
        notification_repository_mock.get_for_user = AsyncMock(return_value=[])
        notification_repository_mock.count_unread = AsyncMock(return_value=0)
        notification_repository_mock.count_total = AsyncMock(return_value=0)

        result = await service.get_notifications(user_id, limit=50, offset=0, unread_only=False)

        assert result.total_count == 0
        assert result.unread_count == 0
        assert len(result.notifications) == 0

    async def test_get_notifications_unread_only(
        self, service, notification_repository_mock, sample_notification, user_id
    ):
        """Test getting only unread notifications."""
        notification_repository_mock.get_for_user = AsyncMock(return_value=[sample_notification])
        notification_repository_mock.count_unread = AsyncMock(return_value=1)
        notification_repository_mock.count_total = AsyncMock(return_value=5)

        result = await service.get_notifications(user_id, limit=50, offset=0, unread_only=True)

        notification_repository_mock.get_for_user.assert_awaited_once_with(
            user_id=user_id, limit=50, offset=0, unread_only=True
        )
        assert result.unread_count == 1
        assert result.total_count == 5


class TestNotificationServiceGetUnreadCount:
    """Tests for get_unread_count method."""

    async def test_get_unread_count(self, service, notification_repository_mock, user_id):
        """Test getting unread notification count."""
        notification_repository_mock.count_unread = AsyncMock(return_value=3)

        result = await service.get_unread_count(user_id)

        assert result == 3
        notification_repository_mock.count_unread.assert_awaited_once_with(user_id)

    async def test_get_unread_count_zero(self, service, notification_repository_mock, user_id):
        """Test getting unread count when no unread notifications."""
        notification_repository_mock.count_unread = AsyncMock(return_value=0)

        result = await service.get_unread_count(user_id)

        assert result == 0


class TestNotificationServiceMarkAsRead:
    """Tests for mark_as_read method."""

    async def test_mark_as_read_all(self, service, notification_repository_mock, user_id):
        """Test marking all notifications as read."""
        notification_repository_mock.mark_as_read.return_value = 5

        result = await service.mark_as_read(user_id, notification_ids=None)

        assert result == 5
        notification_repository_mock.mark_as_read.assert_awaited_once_with(user_id, None)
        notification_repository_mock.session.commit.assert_awaited_once()

    async def test_mark_as_read_specific_ids(
        self, service, notification_repository_mock, user_id
    ):
        """Test marking specific notifications as read."""
        notification_ids = [uuid7(), uuid7()]
        notification_repository_mock.mark_as_read.return_value = 2

        result = await service.mark_as_read(user_id, notification_ids=notification_ids)

        assert result == 2
        notification_repository_mock.mark_as_read.assert_awaited_once_with(
            user_id, notification_ids
        )
        notification_repository_mock.session.commit.assert_awaited_once()


class TestNotificationServiceCreate:
    """Tests for create_notification method."""

    async def test_create_notification_success(
        self, service, notification_repository_mock, user_id, workspace_id
    ):
        """Test creating a notification."""
        expected_notification = Notification(
            id=uuid7(),
            user_id=user_id,
            workspace_id=workspace_id,
            notification_type=NotificationType.SYSTEM,
            title="Test",
            message="Test message",
            data={"key": "value"},
        )
        notification_repository_mock.add.return_value = expected_notification

        result = await service.create_notification(
            user_id=user_id,
            notification_type=NotificationType.SYSTEM,
            title="Test",
            message="Test message",
            workspace_id=workspace_id,
            metadata={"key": "value"},
        )

        assert result == expected_notification
        notification_repository_mock.add.assert_awaited_once()
        notification_repository_mock.session.commit.assert_awaited_once()

        # Verify the notification passed to add has correct attributes
        added_notification = notification_repository_mock.add.call_args[0][0]
        assert added_notification.user_id == user_id
        assert added_notification.workspace_id == workspace_id
        assert added_notification.notification_type == NotificationType.SYSTEM
        assert added_notification.title == "Test"
        assert added_notification.message == "Test message"
        assert added_notification.data == {"key": "value"}


class TestNotificationServiceSpecializedMethods:
    """Tests for specialized notification creation methods."""

    async def test_send_workspace_invite_notification(
        self, service, notification_repository_mock, user_id, workspace_id
    ):
        """Test sending workspace invite notification."""
        notification_repository_mock.add.return_value = Notification(
            id=uuid7(),
            user_id=user_id,
            workspace_id=workspace_id,
            notification_type=NotificationType.WORKSPACE_INVITE,
            title=f"Invited to {TEST_WORKSPACE_NAME}",
            message=f"{TEST_USER_JOHN_DOE} invited you to join '{TEST_WORKSPACE_NAME}' as admin.",
            data={
                "workspace_id": str(workspace_id),
                "workspace_name": TEST_WORKSPACE_NAME,
                "role": "admin",
                "invited_by": TEST_USER_JOHN_DOE,
            },
        )

        await service.send_workspace_invite_notification(
            user_id=user_id,
            workspace_id=workspace_id,
            workspace_name=TEST_WORKSPACE_NAME,
            role="admin",
            invited_by_name=TEST_USER_JOHN_DOE,
        )

        notification_repository_mock.add.assert_awaited_once()
        added = notification_repository_mock.add.call_args[0][0]
        assert added.notification_type == NotificationType.WORKSPACE_INVITE
        assert f"Invited to {TEST_WORKSPACE_NAME}" in added.title
        assert TEST_USER_JOHN_DOE in added.message
        assert added.data["role"] == "admin"

    async def test_send_member_joined_notification(
        self, service, notification_repository_mock, user_id, workspace_id
    ):
        """Test sending member joined notification."""
        notification_repository_mock.add.return_value = Notification(
            id=uuid7(),
            user_id=user_id,
            workspace_id=workspace_id,
            notification_type=NotificationType.MEMBER_JOINED,
            title=f"New member in {TEST_WORKSPACE_NAME}",
            message=f"{TEST_USER_JANE_DOE} joined '{TEST_WORKSPACE_NAME}' as member.",
            data={
                "workspace_id": str(workspace_id),
                "workspace_name": TEST_WORKSPACE_NAME,
                "new_member": TEST_USER_JANE_DOE,
                "role": "member",
            },
        )

        await service.send_member_joined_notification(
            user_id=user_id,
            workspace_id=workspace_id,
            workspace_name=TEST_WORKSPACE_NAME,
            new_member_name=TEST_USER_JANE_DOE,
            role="member",
        )

        notification_repository_mock.add.assert_awaited_once()
        added = notification_repository_mock.add.call_args[0][0]
        assert added.notification_type == NotificationType.MEMBER_JOINED
        assert "New member" in added.title
        assert TEST_USER_JANE_DOE in added.message

    async def test_send_loan_due_notification(
        self, service, notification_repository_mock, user_id, workspace_id
    ):
        """Test sending loan due notification."""
        notification_repository_mock.add.return_value = Notification(
            id=uuid7(),
            user_id=user_id,
            workspace_id=workspace_id,
            notification_type=NotificationType.LOAN_DUE_SOON,
            title="Loan Due Soon",
            message="'Hammer' loaned to Bob is due on 2024-12-25.",
            data={
                "item_name": "Hammer",
                "borrower_name": "Bob",
                "due_date": "2024-12-25",
            },
        )

        await service.send_loan_due_notification(
            user_id=user_id,
            workspace_id=workspace_id,
            item_name="Hammer",
            borrower_name="Bob",
            due_date="2024-12-25",
        )

        notification_repository_mock.add.assert_awaited_once()
        added = notification_repository_mock.add.call_args[0][0]
        assert added.notification_type == NotificationType.LOAN_DUE_SOON
        assert added.title == "Loan Due Soon"
        assert "Hammer" in added.message
        assert "Bob" in added.message

    async def test_send_loan_overdue_notification(
        self, service, notification_repository_mock, user_id, workspace_id
    ):
        """Test sending loan overdue notification."""
        notification_repository_mock.add.return_value = Notification(
            id=uuid7(),
            user_id=user_id,
            workspace_id=workspace_id,
            notification_type=NotificationType.LOAN_OVERDUE,
            title="Loan Overdue",
            message="'Drill' loaned to Alice was due on 2024-12-20.",
            data={
                "item_name": "Drill",
                "borrower_name": "Alice",
                "due_date": "2024-12-20",
            },
        )

        await service.send_loan_overdue_notification(
            user_id=user_id,
            workspace_id=workspace_id,
            item_name="Drill",
            borrower_name="Alice",
            due_date="2024-12-20",
        )

        notification_repository_mock.add.assert_awaited_once()
        added = notification_repository_mock.add.call_args[0][0]
        assert added.notification_type == NotificationType.LOAN_OVERDUE
        assert added.title == "Loan Overdue"
        assert "was due on" in added.message
