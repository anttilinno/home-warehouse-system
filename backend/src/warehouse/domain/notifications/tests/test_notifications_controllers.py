"""Controller tests for notifications domain."""

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid7
from unittest.mock import AsyncMock, Mock

import pytest

from warehouse.domain.notifications.controllers import NotificationController
from warehouse.domain.notifications.schemas import NotificationMarkReadRequest, NotificationListResponse
from warehouse.errors import AppError, ErrorCode


@pytest.fixture
def auth_service_mock() -> AsyncMock:
    """Mocked auth service."""
    service = AsyncMock()
    service.get_current_user = AsyncMock()
    return service


@pytest.fixture
def notification_service_mock() -> AsyncMock:
    """Mocked notification service."""
    service = AsyncMock()
    service.get_notifications = AsyncMock()
    service.get_unread_count = AsyncMock()
    service.mark_as_read = AsyncMock()
    return service


@pytest.fixture
def controller() -> NotificationController:
    """Notification controller instance."""
    return NotificationController(owner=None)


def _make_request_mock(token: str = "valid-token"):
    """Create a mock request with Authorization header."""
    request = Mock()
    request.headers = {"Authorization": f"Bearer {token}"}
    return request


def _make_user_response():
    """Create a mock user for testing."""
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid7(),
        email="alice@example.com",
        full_name="Alice Smith",
        is_active=True,
        created_at=now,
        updated_at=now,
    )


async def _call(handler, controller: NotificationController, **kwargs):
    """Invoke the underlying handler function directly."""
    return await handler.fn(controller, **kwargs)


class TestGetNotifications:
    """Tests for get_notifications endpoint."""

    @pytest.mark.asyncio
    async def test_get_notifications_success(
        self, controller, auth_service_mock, notification_service_mock
    ):
        """Test successful retrieval of notifications."""
        user = _make_user_response()
        auth_service_mock.get_current_user.return_value = user
        notification_service_mock.get_notifications.return_value = NotificationListResponse(
            notifications=[], total_count=0, unread_count=0
        )
        request = _make_request_mock()

        resp = await _call(
            controller.get_notifications,
            controller,
            request=request,
            notification_service=notification_service_mock,
            auth_service=auth_service_mock,
            limit=50,
            offset=0,
            unread_only=False,
        )

        auth_service_mock.get_current_user.assert_awaited_once_with("valid-token")
        notification_service_mock.get_notifications.assert_awaited_once_with(
            user_id=user.id, limit=50, offset=0, unread_only=False
        )
        assert resp.total_count == 0

    @pytest.mark.asyncio
    async def test_get_notifications_auth_error(
        self, controller, auth_service_mock, notification_service_mock
    ):
        """Test get_notifications raises AppError on auth error."""
        auth_service_mock.get_current_user.side_effect = AppError(
            ErrorCode.AUTH_INVALID_TOKEN, status_code=401
        )
        request = _make_request_mock()

        with pytest.raises(AppError) as exc_info:
            await _call(
                controller.get_notifications,
                controller,
                request=request,
                notification_service=notification_service_mock,
                auth_service=auth_service_mock,
                limit=50,
                offset=0,
                unread_only=False,
            )

        assert exc_info.value.status_code == 401


class TestGetUnreadCount:
    """Tests for get_unread_count endpoint."""

    @pytest.mark.asyncio
    async def test_get_unread_count_success(
        self, controller, auth_service_mock, notification_service_mock
    ):
        """Test successful retrieval of unread count."""
        user = _make_user_response()
        auth_service_mock.get_current_user.return_value = user
        notification_service_mock.get_unread_count.return_value = 5
        request = _make_request_mock()

        resp = await _call(
            controller.get_unread_count,
            controller,
            request=request,
            notification_service=notification_service_mock,
            auth_service=auth_service_mock,
        )

        auth_service_mock.get_current_user.assert_awaited_once_with("valid-token")
        notification_service_mock.get_unread_count.assert_awaited_once_with(user.id)
        assert resp == {"unread_count": 5}

    @pytest.mark.asyncio
    async def test_get_unread_count_auth_error(
        self, controller, auth_service_mock, notification_service_mock
    ):
        """Test get_unread_count raises AppError on auth error."""
        auth_service_mock.get_current_user.side_effect = AppError(
            ErrorCode.AUTH_INVALID_TOKEN, status_code=401
        )
        request = _make_request_mock()

        with pytest.raises(AppError) as exc_info:
            await _call(
                controller.get_unread_count,
                controller,
                request=request,
                notification_service=notification_service_mock,
                auth_service=auth_service_mock,
            )

        assert exc_info.value.status_code == 401


class TestMarkAsRead:
    """Tests for mark_as_read endpoint."""

    @pytest.mark.asyncio
    async def test_mark_as_read_success(
        self, controller, auth_service_mock, notification_service_mock
    ):
        """Test successful marking of notifications as read."""
        user = _make_user_response()
        auth_service_mock.get_current_user.return_value = user
        notification_service_mock.mark_as_read.return_value = 3
        request = _make_request_mock()
        notification_ids = [uuid7(), uuid7(), uuid7()]
        data = NotificationMarkReadRequest(notification_ids=notification_ids)

        resp = await _call(
            controller.mark_as_read,
            controller,
            request=request,
            data=data,
            notification_service=notification_service_mock,
            auth_service=auth_service_mock,
        )

        auth_service_mock.get_current_user.assert_awaited_once_with("valid-token")
        notification_service_mock.mark_as_read.assert_awaited_once_with(
            user_id=user.id, notification_ids=notification_ids
        )
        assert resp == {"marked_count": 3}

    @pytest.mark.asyncio
    async def test_mark_as_read_all(
        self, controller, auth_service_mock, notification_service_mock
    ):
        """Test marking all notifications as read."""
        user = _make_user_response()
        auth_service_mock.get_current_user.return_value = user
        notification_service_mock.mark_as_read.return_value = 10
        request = _make_request_mock()
        data = NotificationMarkReadRequest(notification_ids=None)

        resp = await _call(
            controller.mark_as_read,
            controller,
            request=request,
            data=data,
            notification_service=notification_service_mock,
            auth_service=auth_service_mock,
        )

        notification_service_mock.mark_as_read.assert_awaited_once_with(
            user_id=user.id, notification_ids=None
        )
        assert resp == {"marked_count": 10}

    @pytest.mark.asyncio
    async def test_mark_as_read_auth_error(
        self, controller, auth_service_mock, notification_service_mock
    ):
        """Test mark_as_read raises AppError on auth error."""
        auth_service_mock.get_current_user.side_effect = AppError(
            ErrorCode.AUTH_INVALID_TOKEN, status_code=401
        )
        request = _make_request_mock()
        data = NotificationMarkReadRequest(notification_ids=None)

        with pytest.raises(AppError) as exc_info:
            await _call(
                controller.mark_as_read,
                controller,
                request=request,
                data=data,
                notification_service=notification_service_mock,
                auth_service=auth_service_mock,
            )

        assert exc_info.value.status_code == 401


class TestExtractToken:
    """Tests for _extract_token method."""

    @pytest.mark.asyncio
    async def test_missing_token_raises(
        self, controller, auth_service_mock, notification_service_mock
    ):
        """Test missing Authorization header raises AppError."""
        request = Mock()
        request.headers = {}

        with pytest.raises(AppError) as exc_info:
            await _call(
                controller.get_notifications,
                controller,
                request=request,
                notification_service=notification_service_mock,
                auth_service=auth_service_mock,
                limit=50,
                offset=0,
                unread_only=False,
            )

        assert exc_info.value.status_code == 401
