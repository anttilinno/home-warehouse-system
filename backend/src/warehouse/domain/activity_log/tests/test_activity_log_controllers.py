"""Controller tests for activity_log domain."""

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest

from warehouse.domain.activity_log.controllers import ActivityLogController
from warehouse.domain.activity_log.models import ActivityAction, ActivityEntity, ActivityLog
from warehouse.domain.activity_log.schemas import ActivityListResponse, ActivityLogResponse
from warehouse.errors import AppError, ErrorCode


@pytest.fixture
def config_mock() -> MagicMock:
    """Mocked config."""
    config = MagicMock()
    config.secret_key = "test-secret-key"
    return config


@pytest.fixture
def activity_service_mock() -> AsyncMock:
    """Mocked activity log service."""
    service = AsyncMock()
    service.get_activity = AsyncMock()
    service.get_entity_activity = AsyncMock()
    service.repository = AsyncMock()
    return service


@pytest.fixture
def db_session_mock() -> AsyncMock:
    """Mocked database session."""
    return AsyncMock()


@pytest.fixture
def controller() -> ActivityLogController:
    """Activity log controller instance."""
    return ActivityLogController(owner=None)


@pytest.fixture
def workspace_id():
    """A sample workspace ID."""
    return uuid7()


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


def _make_request_mock(token: str = "valid-token", workspace_id=None):
    """Create a mock request with Authorization header and workspace header."""
    request = Mock()
    headers = {"Authorization": f"Bearer {token}"}
    if workspace_id:
        headers["X-Workspace-Id"] = str(workspace_id)
    request.headers = headers
    return request


def _make_workspace_context(workspace_id, user_id):
    """Create a mock workspace context."""
    return SimpleNamespace(
        workspace_id=workspace_id,
        user_id=user_id,
    )


def _make_user_response(user_id):
    """Create a mock user for testing."""
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=user_id,
        email="alice@example.com",
        full_name="Alice Smith",
        is_active=True,
        created_at=now,
        updated_at=now,
    )


def _make_activity_log_response():
    """Create a mock activity log response."""
    return ActivityLogResponse(
        id=uuid7(),
        action="CREATE",
        entity_type="ITEM",
        entity_id=uuid7(),
        entity_name="Test Item",
        changes=None,
        metadata=None,
        user_id=uuid7(),
        user_name="Test User",
        created_at=datetime.now(UTC),
    )


async def _call(handler, controller: ActivityLogController, **kwargs):
    """Invoke the underlying handler function directly."""
    return await handler.fn(controller, **kwargs)


class TestGetActivity:
    """Tests for get_activity endpoint."""

    @pytest.mark.asyncio
    async def test_get_activity_success(
        self, controller, config_mock, activity_service_mock, db_session_mock, workspace_id, user_id
    ):
        """Test successful retrieval of activity logs."""
        request = _make_request_mock(workspace_id=workspace_id)
        activity_service_mock.get_activity.return_value = ActivityListResponse(
            items=[_make_activity_log_response()], total=1, limit=50, offset=0
        )

        # Mock workspace context resolution
        import warehouse.domain.activity_log.controllers as ctrl_module
        original_get_workspace_context = ctrl_module.get_workspace_context

        async def mock_get_workspace_context(req, db_sess, cfg):
            return _make_workspace_context(workspace_id, user_id)

        ctrl_module.get_workspace_context = mock_get_workspace_context

        try:
            resp = await _call(
                controller.get_activity,
                controller,
                request=request,
                activity_service=activity_service_mock,
                db_session=db_session_mock,
                config=config_mock,
                limit=50,
                offset=0,
            )

            activity_service_mock.get_activity.assert_awaited_once()
            assert resp.total == 1
            assert len(resp.items) == 1
        finally:
            ctrl_module.get_workspace_context = original_get_workspace_context

    @pytest.mark.asyncio
    async def test_get_activity_with_filters(
        self, controller, config_mock, activity_service_mock, db_session_mock, workspace_id, user_id
    ):
        """Test retrieval of activity logs with filters."""
        request = _make_request_mock(workspace_id=workspace_id)
        entity_id = uuid7()
        activity_service_mock.get_activity.return_value = ActivityListResponse(
            items=[], total=0, limit=50, offset=0
        )

        import warehouse.domain.activity_log.controllers as ctrl_module
        original_get_workspace_context = ctrl_module.get_workspace_context

        async def mock_get_workspace_context(req, db_sess, cfg):
            return _make_workspace_context(workspace_id, user_id)

        ctrl_module.get_workspace_context = mock_get_workspace_context

        try:
            await _call(
                controller.get_activity,
                controller,
                request=request,
                activity_service=activity_service_mock,
                db_session=db_session_mock,
                config=config_mock,
                limit=25,
                offset=10,
                entity_type="ITEM",
                entity_id=entity_id,
                user_id=user_id,
                action="CREATE",
            )

            call_kwargs = activity_service_mock.get_activity.call_args.kwargs
            assert call_kwargs["limit"] == 25
            assert call_kwargs["offset"] == 10
            assert call_kwargs["entity_type"] == "ITEM"
            assert call_kwargs["entity_id"] == entity_id
            assert call_kwargs["action"] == "CREATE"
        finally:
            ctrl_module.get_workspace_context = original_get_workspace_context


class TestGetActivityById:
    """Tests for get_activity_by_id endpoint."""

    @pytest.mark.asyncio
    async def test_get_activity_by_id_success(
        self, controller, config_mock, activity_service_mock, db_session_mock, workspace_id, user_id
    ):
        """Test successful retrieval of a single activity log."""
        request = _make_request_mock(workspace_id=workspace_id)
        activity_id = uuid7()
        entity_id = uuid7()

        mock_user = MagicMock()
        mock_user.full_name = "Test User"

        mock_activity = ActivityLog(
            id=activity_id,
            workspace_id=workspace_id,
            user_id=user_id,
            action=ActivityAction.CREATE,
            entity_type=ActivityEntity.ITEM,
            entity_id=entity_id,
            entity_name="Test Item",
            changes={"name": {"old": None, "new": "Test Item"}},
            extra_data={"source": "test"},
            created_at=datetime.now(UTC),
        )
        mock_activity.user = mock_user

        activity_service_mock.repository.get_one_or_none = AsyncMock(
            return_value=mock_activity
        )

        import warehouse.domain.activity_log.controllers as ctrl_module
        original_get_workspace_context = ctrl_module.get_workspace_context

        async def mock_get_workspace_context(req, db_sess, cfg):
            return _make_workspace_context(workspace_id, user_id)

        ctrl_module.get_workspace_context = mock_get_workspace_context

        try:
            resp = await _call(
                controller.get_activity_by_id,
                controller,
                request=request,
                activity_id=activity_id,
                activity_service=activity_service_mock,
                db_session=db_session_mock,
                config=config_mock,
            )

            assert resp.id == activity_id
            assert resp.action == "CREATE"
            assert resp.entity_type == "ITEM"
            assert resp.user_name == "Test User"
        finally:
            ctrl_module.get_workspace_context = original_get_workspace_context

    @pytest.mark.asyncio
    async def test_get_activity_by_id_not_found(
        self, controller, config_mock, activity_service_mock, db_session_mock, workspace_id, user_id
    ):
        """Test get_activity_by_id raises AppError when not found."""
        request = _make_request_mock(workspace_id=workspace_id)
        activity_id = uuid7()

        activity_service_mock.repository.get_one_or_none = AsyncMock(return_value=None)

        import warehouse.domain.activity_log.controllers as ctrl_module
        original_get_workspace_context = ctrl_module.get_workspace_context

        async def mock_get_workspace_context(req, db_sess, cfg):
            return _make_workspace_context(workspace_id, user_id)

        ctrl_module.get_workspace_context = mock_get_workspace_context

        try:
            with pytest.raises(AppError) as exc_info:
                await _call(
                    controller.get_activity_by_id,
                    controller,
                    request=request,
                    activity_id=activity_id,
                    activity_service=activity_service_mock,
                    db_session=db_session_mock,
                    config=config_mock,
                )

            assert exc_info.value.status_code == 404
        finally:
            ctrl_module.get_workspace_context = original_get_workspace_context


class TestGetEntityActivity:
    """Tests for get_entity_activity endpoint."""

    @pytest.mark.asyncio
    async def test_get_entity_activity_success(
        self, controller, config_mock, activity_service_mock, db_session_mock, workspace_id, user_id
    ):
        """Test successful retrieval of entity activity logs."""
        request = _make_request_mock(workspace_id=workspace_id)
        entity_id = uuid7()
        activity_service_mock.get_entity_activity.return_value = [
            _make_activity_log_response()
        ]

        import warehouse.domain.activity_log.controllers as ctrl_module
        original_get_workspace_context = ctrl_module.get_workspace_context

        async def mock_get_workspace_context(req, db_sess, cfg):
            return _make_workspace_context(workspace_id, user_id)

        ctrl_module.get_workspace_context = mock_get_workspace_context

        try:
            resp = await _call(
                controller.get_entity_activity,
                controller,
                request=request,
                entity_type="ITEM",
                entity_id=entity_id,
                activity_service=activity_service_mock,
                db_session=db_session_mock,
                config=config_mock,
                limit=50,
            )

            activity_service_mock.get_entity_activity.assert_awaited_once()
            assert len(resp) == 1
        finally:
            ctrl_module.get_workspace_context = original_get_workspace_context

    @pytest.mark.asyncio
    async def test_get_entity_activity_empty(
        self, controller, config_mock, activity_service_mock, db_session_mock, workspace_id, user_id
    ):
        """Test getting entity activity when none exist."""
        request = _make_request_mock(workspace_id=workspace_id)
        entity_id = uuid7()
        activity_service_mock.get_entity_activity.return_value = []

        import warehouse.domain.activity_log.controllers as ctrl_module
        original_get_workspace_context = ctrl_module.get_workspace_context

        async def mock_get_workspace_context(req, db_sess, cfg):
            return _make_workspace_context(workspace_id, user_id)

        ctrl_module.get_workspace_context = mock_get_workspace_context

        try:
            resp = await _call(
                controller.get_entity_activity,
                controller,
                request=request,
                entity_type="CONTAINER",
                entity_id=entity_id,
                activity_service=activity_service_mock,
                db_session=db_session_mock,
                config=config_mock,
                limit=50,
            )

            assert resp == []
        finally:
            ctrl_module.get_workspace_context = original_get_workspace_context
