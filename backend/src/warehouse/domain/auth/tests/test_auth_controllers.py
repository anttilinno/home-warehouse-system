"""Controller tests for auth domain."""

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid7
from unittest.mock import AsyncMock, Mock

import pytest
from litestar.exceptions import NotAuthorizedException, HTTPException

from warehouse.domain.auth.controllers import AuthController
from warehouse.domain.auth.schemas import (
    LoginRequest,
    PasswordChange,
    ProfileUpdate,
    UserCreate,
    WorkspaceCreate,
    WorkspaceMemberInvite,
    WorkspaceMemberResponse,
    WorkspaceResponse,
)
from warehouse.errors import AppError, ErrorCode


@pytest.fixture
def auth_service_mock() -> AsyncMock:
    service = AsyncMock()
    service.create_user = AsyncMock()
    service.authenticate = AsyncMock()
    service.create_access_token = Mock(return_value="token")
    return service


@pytest.fixture
def controller() -> AuthController:
    return AuthController(owner=None)


async def _call(handler, controller: AuthController, **kwargs):
    """Invoke the underlying handler function directly."""
    return await handler.fn(controller, **kwargs)


@pytest.mark.asyncio
async def test_register_maps_response(controller: AuthController, auth_service_mock: AsyncMock):
    now = datetime.now(UTC)
    user = SimpleNamespace(
        id=uuid7(),
        email="alice@example.com",
        full_name="Alice Smith",
        is_active=True,
        date_format="DD.MM.YYYY HH:mm",
        language="en",
        theme="system",
        created_at=now,
        updated_at=now,
    )
    auth_service_mock.create_user.return_value = user
    payload = UserCreate(email="alice@example.com", full_name="Alice Smith", password="pw")

    resp = await _call(controller.register, controller, data=payload, auth_service=auth_service_mock)

    auth_service_mock.create_user.assert_awaited_once_with(payload)
    assert resp.id == user.id
    assert resp.email == "alice@example.com"
    assert resp.full_name == "Alice Smith"
    assert resp.is_active is True
    assert resp.created_at == now
    assert resp.updated_at == now


@pytest.mark.asyncio
async def test_login_success(controller: AuthController, auth_service_mock: AsyncMock):
    now = datetime.now(UTC)
    user = SimpleNamespace(
        id=uuid7(),
        email="alice@example.com",
        full_name="Alice Smith",
        is_active=True,
        date_format="DD.MM.YYYY HH:mm",
        language="en",
        theme="system",
        created_at=now,
        updated_at=now,
    )
    auth_service_mock.authenticate.return_value = user
    auth_service_mock.create_access_token.return_value = "token"
    payload = LoginRequest(email="alice@example.com", password="pw")

    resp = await _call(controller.login, controller, data=payload, auth_service=auth_service_mock)

    auth_service_mock.authenticate.assert_awaited_once_with(payload)
    auth_service_mock.create_access_token.assert_called_once_with(user.id)
    assert resp.access_token == "token"
    assert resp.token_type == "bearer"
    assert resp.user.email == "alice@example.com"


@pytest.mark.asyncio
async def test_login_invalid_credentials_raises(controller: AuthController, auth_service_mock: AsyncMock):
    auth_service_mock.authenticate.side_effect = AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, status_code=401)
    payload = LoginRequest(email="alice@example.com", password="wrong")

    with pytest.raises(HTTPException, match="401"):
        await _call(controller.login, controller, data=payload, auth_service=auth_service_mock)

    auth_service_mock.create_access_token.assert_not_called()


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
        date_format="DD.MM.YYYY HH:mm",
        language="en",
        theme="system",
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_get_me_success(controller: AuthController, auth_service_mock: AsyncMock):
    """Test get_me returns current user."""
    user = _make_user_response()
    auth_service_mock.get_current_user.return_value = user
    request = _make_request_mock()

    resp = await _call(controller.get_me, controller, request=request, auth_service=auth_service_mock)

    auth_service_mock.get_current_user.assert_awaited_once_with("valid-token")
    assert resp.id == user.id
    assert resp.email == "alice@example.com"


@pytest.mark.asyncio
async def test_get_me_missing_token_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test get_me raises when no token provided."""
    request = Mock()
    request.headers = {}

    with pytest.raises(HTTPException) as exc_info:
        await _call(controller.get_me, controller, request=request, auth_service=auth_service_mock)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_update_me_success(controller: AuthController, auth_service_mock: AsyncMock):
    """Test update_me updates user profile."""
    user = _make_user_response()
    updated_user = _make_user_response()
    updated_user.full_name = "Alice Johnson"
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.update_profile.return_value = updated_user
    request = _make_request_mock()
    data = ProfileUpdate(full_name="Alice Johnson", email=None)

    resp = await _call(
        controller.update_me, controller, request=request, data=data, auth_service=auth_service_mock
    )

    auth_service_mock.update_profile.assert_awaited_once_with(
        user.id, full_name="Alice Johnson", email=None, date_format=None, language=None, theme=None
    )
    assert resp.full_name == "Alice Johnson"


@pytest.mark.asyncio
async def test_change_password_success(controller: AuthController, auth_service_mock: AsyncMock):
    """Test change_password endpoint."""
    user = _make_user_response()
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.change_password.return_value = user
    request = _make_request_mock()
    data = PasswordChange(current_password="old", new_password="new")

    resp = await _call(
        controller.change_password, controller, request=request, data=data, auth_service=auth_service_mock
    )

    auth_service_mock.change_password.assert_awaited_once_with(user.id, "old", "new")
    assert resp.id == user.id


@pytest.mark.asyncio
async def test_create_workspace_success(controller: AuthController, auth_service_mock: AsyncMock):
    """Test create_workspace endpoint."""
    user = _make_user_response()
    workspace = WorkspaceResponse(
        id=uuid7(),
        name="Test Workspace",
        slug="test-workspace",
        description="A test workspace",
        role="owner",
    )
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.create_workspace.return_value = workspace
    request = _make_request_mock()
    data = WorkspaceCreate(name="Test Workspace", description="A test workspace")

    resp = await _call(
        controller.create_workspace, controller, request=request, data=data, auth_service=auth_service_mock
    )

    auth_service_mock.create_workspace.assert_awaited_once_with(user.id, data)
    assert resp.name == "Test Workspace"
    assert resp.role == "owner"


@pytest.mark.asyncio
async def test_get_workspace_members_success(controller: AuthController, auth_service_mock: AsyncMock):
    """Test get_workspace_members endpoint."""
    user = _make_user_response()
    workspace_id = uuid7()
    members = [
        WorkspaceMemberResponse(
            id=uuid7(),
            user_id=user.id,
            email="alice@example.com",
            full_name="Alice Smith",
            role="owner",
            created_at=datetime.now(UTC),
        )
    ]
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.get_workspace_members.return_value = members
    request = _make_request_mock()

    resp = await _call(
        controller.get_workspace_members,
        controller,
        request=request,
        workspace_id=workspace_id,
        auth_service=auth_service_mock,
    )

    auth_service_mock.get_workspace_members.assert_awaited_once_with(workspace_id, user.id)
    assert len(resp) == 1
    assert resp[0].email == "alice@example.com"


@pytest.mark.asyncio
async def test_search_users_success(controller: AuthController, auth_service_mock: AsyncMock):
    """Test search_users endpoint."""
    user = _make_user_response()
    search_results = [
        {"id": str(uuid7()), "email": "bob@example.com", "full_name": "Bob Jones"}
    ]
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.search_users.return_value = search_results
    request = _make_request_mock()

    resp = await _call(
        controller.search_users,
        controller,
        request=request,
        auth_service=auth_service_mock,
        q="bob",
        workspace_id=None,
    )

    auth_service_mock.search_users.assert_awaited_once_with("bob", None)
    assert len(resp) == 1
    assert resp[0].email == "bob@example.com"


@pytest.mark.asyncio
async def test_invite_member_success(controller: AuthController, auth_service_mock: AsyncMock):
    """Test invite_member endpoint."""
    inviter = _make_user_response()
    workspace_id = uuid7()
    now = datetime.now(UTC)
    invited_member = WorkspaceMemberResponse(
        id=uuid7(),
        user_id=uuid7(),
        email="bob@example.com",
        full_name="Bob Jones",
        role="member",
        created_at=now,
    )

    auth_service_mock.get_current_user.return_value = inviter
    auth_service_mock.invite_member.return_value = invited_member
    auth_service_mock.workspace_repository = None  # Skip notification for simplicity

    notification_service_mock = AsyncMock()
    email_service_mock = AsyncMock()
    request = _make_request_mock()
    data = WorkspaceMemberInvite(email="bob@example.com", role="member")

    resp = await _call(
        controller.invite_member,
        controller,
        request=request,
        workspace_id=workspace_id,
        data=data,
        auth_service=auth_service_mock,
        notification_service=notification_service_mock,
        email_service=email_service_mock,
    )

    auth_service_mock.invite_member.assert_awaited_once_with(workspace_id, inviter.id, data)
    assert resp.email == "bob@example.com"
    assert resp.role == "member"


@pytest.mark.asyncio
async def test_invite_member_sends_notification(controller: AuthController, auth_service_mock: AsyncMock):
    """Test invite_member sends notification and email when workspace found."""
    inviter = _make_user_response()
    workspace_id = uuid7()
    now = datetime.now(UTC)
    invited_member = WorkspaceMemberResponse(
        id=uuid7(),
        user_id=uuid7(),
        email="bob@example.com",
        full_name="Bob Jones",
        role="admin",
        created_at=now,
    )
    workspace = SimpleNamespace(id=workspace_id, name="Test Workspace")

    auth_service_mock.get_current_user.return_value = inviter
    auth_service_mock.invite_member.return_value = invited_member
    auth_service_mock.workspace_repository = AsyncMock()
    auth_service_mock.workspace_repository.get_one_or_none.return_value = workspace

    notification_service_mock = AsyncMock()
    email_service_mock = AsyncMock()
    request = _make_request_mock()
    data = WorkspaceMemberInvite(email="bob@example.com", role="admin")

    resp = await _call(
        controller.invite_member,
        controller,
        request=request,
        workspace_id=workspace_id,
        data=data,
        auth_service=auth_service_mock,
        notification_service=notification_service_mock,
        email_service=email_service_mock,
    )

    notification_service_mock.send_workspace_invite_notification.assert_awaited_once()
    call_kwargs = notification_service_mock.send_workspace_invite_notification.call_args.kwargs
    assert call_kwargs["user_id"] == invited_member.user_id
    assert call_kwargs["workspace_name"] == "Test Workspace"
    assert call_kwargs["role"] == "admin"

    # Also verify email was sent
    email_service_mock.send_workspace_invite.assert_awaited_once_with(
        to="bob@example.com",
        inviter_name=inviter.full_name,
        workspace_name="Test Workspace",
        role="admin",
    )


# Error path tests for exception handling coverage


@pytest.mark.asyncio
async def test_register_email_exists_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test register raises HTTPException when email already exists."""
    auth_service_mock.create_user.side_effect = AppError(ErrorCode.AUTH_EMAIL_EXISTS, status_code=400)
    payload = UserCreate(email="existing@example.com", full_name="Test", password="pw")

    with pytest.raises(HTTPException) as exc_info:
        await _call(controller.register, controller, data=payload, auth_service=auth_service_mock)

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_get_me_invalid_token_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test get_me raises HTTPException when token is invalid."""
    auth_service_mock.get_current_user.side_effect = AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401)
    request = _make_request_mock()

    with pytest.raises(HTTPException) as exc_info:
        await _call(controller.get_me, controller, request=request, auth_service=auth_service_mock)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_update_me_error_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test update_me raises HTTPException on profile update error."""
    user = _make_user_response()
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.update_profile.side_effect = AppError(ErrorCode.AUTH_EMAIL_EXISTS, status_code=400)
    request = _make_request_mock()
    data = ProfileUpdate(full_name=None, email="taken@example.com")

    with pytest.raises(HTTPException) as exc_info:
        await _call(controller.update_me, controller, request=request, data=data, auth_service=auth_service_mock)

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_change_password_error_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test change_password raises HTTPException on wrong current password."""
    user = _make_user_response()
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.change_password.side_effect = AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, status_code=400)
    request = _make_request_mock()
    data = PasswordChange(current_password="wrong", new_password="new")

    with pytest.raises(HTTPException) as exc_info:
        await _call(controller.change_password, controller, request=request, data=data, auth_service=auth_service_mock)

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_create_workspace_error_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test create_workspace raises HTTPException on error."""
    user = _make_user_response()
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.create_workspace.side_effect = AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=500)
    request = _make_request_mock()
    data = WorkspaceCreate(name="Test", description=None)

    with pytest.raises(HTTPException) as exc_info:
        await _call(controller.create_workspace, controller, request=request, data=data, auth_service=auth_service_mock)

    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_get_workspace_members_error_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test get_workspace_members raises HTTPException when not found."""
    user = _make_user_response()
    auth_service_mock.get_current_user.return_value = user
    auth_service_mock.get_workspace_members.side_effect = AppError(ErrorCode.WORKSPACE_NOT_FOUND, status_code=404)
    request = _make_request_mock()
    workspace_id = uuid7()

    with pytest.raises(HTTPException) as exc_info:
        await _call(
            controller.get_workspace_members,
            controller,
            request=request,
            workspace_id=workspace_id,
            auth_service=auth_service_mock,
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_search_users_error_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test search_users raises HTTPException on auth error."""
    auth_service_mock.get_current_user.side_effect = AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401)
    request = _make_request_mock()

    with pytest.raises(HTTPException) as exc_info:
        await _call(
            controller.search_users,
            controller,
            request=request,
            auth_service=auth_service_mock,
            q="test",
            workspace_id=None,
        )

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_invite_member_error_raises(controller: AuthController, auth_service_mock: AsyncMock):
    """Test invite_member raises HTTPException on permission denied."""
    inviter = _make_user_response()
    auth_service_mock.get_current_user.return_value = inviter
    auth_service_mock.invite_member.side_effect = AppError(ErrorCode.WORKSPACE_PERMISSION_DENIED, status_code=403)
    notification_service_mock = AsyncMock()
    email_service_mock = AsyncMock()
    request = _make_request_mock()
    workspace_id = uuid7()
    data = WorkspaceMemberInvite(email="bob@example.com", role="member")

    with pytest.raises(HTTPException) as exc_info:
        await _call(
            controller.invite_member,
            controller,
            request=request,
            workspace_id=workspace_id,
            data=data,
            auth_service=auth_service_mock,
            notification_service=notification_service_mock,
            email_service=email_service_mock,
        )

    assert exc_info.value.status_code == 403
