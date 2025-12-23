"""Tests for workspace context."""

from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from litestar.exceptions import HTTPException

from warehouse.config import Config
from warehouse.domain.auth.models import WorkspaceRole, WorkspaceMember
from warehouse.lib.workspace import (
    get_workspace_context,
    require_write_permission,
    WorkspaceContext,
)


@pytest.fixture
def mock_request():
    """Create a mock request object."""
    request = MagicMock()
    request.headers = {}
    return request


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    return AsyncMock()


@pytest.fixture
def mock_config():
    """Create a mock config."""
    return Config(
        database_url="postgresql+asyncpg://test:test@localhost/test",
        redis_url="redis://localhost:6379",
        secret_key="test-secret-key",
        jwt_algorithm="HS256",
    )


def _make_membership(workspace_id, user_id, role: WorkspaceRole) -> MagicMock:
    """Helper to create a mock WorkspaceMember."""
    membership = MagicMock(spec=WorkspaceMember)
    membership.workspace_id = workspace_id
    membership.user_id = user_id
    membership.role = role
    return membership


class TestWorkspaceContextCanWrite:
    """Tests for WorkspaceContext.can_write method."""

    def test_can_write_owner(self):
        """Test owner can write."""
        context = WorkspaceContext(
            workspace_id=uuid7(),
            user_id=uuid7(),
            user_role=WorkspaceRole.OWNER,
        )
        assert context.can_write() is True

    def test_can_write_admin(self):
        """Test admin can write."""
        context = WorkspaceContext(
            workspace_id=uuid7(),
            user_id=uuid7(),
            user_role=WorkspaceRole.ADMIN,
        )
        assert context.can_write() is True

    def test_can_write_member(self):
        """Test member can write."""
        context = WorkspaceContext(
            workspace_id=uuid7(),
            user_id=uuid7(),
            user_role=WorkspaceRole.MEMBER,
        )
        assert context.can_write() is True

    def test_can_write_viewer(self):
        """Test viewer cannot write."""
        context = WorkspaceContext(
            workspace_id=uuid7(),
            user_id=uuid7(),
            user_role=WorkspaceRole.VIEWER,
        )
        assert context.can_write() is False


class TestRequireWritePermission:
    """Tests for require_write_permission function."""

    def test_require_write_permission_owner_passes(self):
        """Test owner passes permission check."""
        context = WorkspaceContext(
            workspace_id=uuid7(),
            user_id=uuid7(),
            user_role=WorkspaceRole.OWNER,
        )
        # Should not raise
        require_write_permission(context)

    def test_require_write_permission_admin_passes(self):
        """Test admin passes permission check."""
        context = WorkspaceContext(
            workspace_id=uuid7(),
            user_id=uuid7(),
            user_role=WorkspaceRole.ADMIN,
        )
        # Should not raise
        require_write_permission(context)

    def test_require_write_permission_member_passes(self):
        """Test member passes permission check."""
        context = WorkspaceContext(
            workspace_id=uuid7(),
            user_id=uuid7(),
            user_role=WorkspaceRole.MEMBER,
        )
        # Should not raise
        require_write_permission(context)

    def test_require_write_permission_viewer_fails(self):
        """Test viewer fails permission check with 403."""
        context = WorkspaceContext(
            workspace_id=uuid7(),
            user_id=uuid7(),
            user_role=WorkspaceRole.VIEWER,
        )
        with pytest.raises(HTTPException) as exc_info:
            require_write_permission(context)

        assert exc_info.value.status_code == 403
        assert "Permission denied" in str(exc_info.value.detail)


class TestGetWorkspaceContext:
    """Tests for get_workspace_context function."""

    @pytest.mark.asyncio
    async def test_get_workspace_context_missing_workspace_header(
        self, mock_request, mock_db_session, mock_config
    ):
        """Test missing workspace header raises WORKSPACE_REQUIRED error."""
        mock_request.headers = {"Authorization": "Bearer valid-token"}

        with pytest.raises(HTTPException) as exc_info:
            await get_workspace_context(mock_request, mock_db_session, mock_config)

        assert exc_info.value.status_code == 400
        assert "Workspace ID is required" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_get_workspace_context_invalid_uuid(
        self, mock_request, mock_db_session, mock_config
    ):
        """Test invalid UUID raises WORKSPACE_INVALID error."""
        mock_request.headers = {
            "X-Workspace-ID": "not-a-valid-uuid",
            "Authorization": "Bearer valid-token",
        }

        with pytest.raises(HTTPException) as exc_info:
            await get_workspace_context(mock_request, mock_db_session, mock_config)

        assert exc_info.value.status_code == 400
        assert "Invalid workspace ID" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_get_workspace_context_missing_auth_header(
        self, mock_request, mock_db_session, mock_config
    ):
        """Test missing Authorization header raises AUTH_INVALID_TOKEN error."""
        workspace_id = uuid7()
        mock_request.headers = {"X-Workspace-ID": str(workspace_id)}

        with pytest.raises(HTTPException) as exc_info:
            await get_workspace_context(mock_request, mock_db_session, mock_config)

        assert exc_info.value.status_code == 401
        assert "Invalid" in str(exc_info.value.detail) or "token" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_get_workspace_context_invalid_token(
        self, mock_request, mock_db_session, mock_config
    ):
        """Test invalid JWT raises AUTH_INVALID_TOKEN error."""
        workspace_id = uuid7()
        mock_request.headers = {
            "X-Workspace-ID": str(workspace_id),
            "Authorization": "Bearer invalid-token",
        }

        with pytest.raises(HTTPException) as exc_info:
            await get_workspace_context(mock_request, mock_db_session, mock_config)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_workspace_context_user_not_member(
        self, mock_request, mock_db_session, mock_config
    ):
        """Test user not a member raises WORKSPACE_ACCESS_DENIED error."""
        import jwt

        workspace_id = uuid7()
        user_id = uuid7()
        token = jwt.encode({"sub": str(user_id)}, mock_config.secret_key, algorithm="HS256")

        mock_request.headers = {
            "X-Workspace-ID": str(workspace_id),
            "Authorization": f"Bearer {token}",
        }

        # Mock the repository to return None (no membership)
        with patch(
            "warehouse.lib.workspace.WorkspaceMemberRepository"
        ) as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_one_or_none.return_value = None
            mock_repo_class.return_value = mock_repo

            with pytest.raises(HTTPException) as exc_info:
                await get_workspace_context(mock_request, mock_db_session, mock_config)

            assert exc_info.value.status_code == 403
            assert "Access" in str(exc_info.value.detail) or "denied" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_get_workspace_context_success(
        self, mock_request, mock_db_session, mock_config
    ):
        """Test valid request returns WorkspaceContext with user info."""
        import jwt

        workspace_id = uuid7()
        user_id = uuid7()
        token = jwt.encode({"sub": str(user_id)}, mock_config.secret_key, algorithm="HS256")

        mock_request.headers = {
            "X-Workspace-ID": str(workspace_id),
            "Authorization": f"Bearer {token}",
        }

        membership = _make_membership(workspace_id, user_id, WorkspaceRole.MEMBER)

        with patch(
            "warehouse.lib.workspace.WorkspaceMemberRepository"
        ) as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_one_or_none.return_value = membership
            mock_repo_class.return_value = mock_repo

            result = await get_workspace_context(mock_request, mock_db_session, mock_config)

            assert isinstance(result, WorkspaceContext)
            assert result.workspace_id == workspace_id
            assert result.user_id == user_id
            assert result.user_role == WorkspaceRole.MEMBER

    @pytest.mark.asyncio
    async def test_get_workspace_context_viewer_role(
        self, mock_request, mock_db_session, mock_config
    ):
        """Test viewer role is correctly set in context."""
        import jwt

        workspace_id = uuid7()
        user_id = uuid7()
        token = jwt.encode({"sub": str(user_id)}, mock_config.secret_key, algorithm="HS256")

        mock_request.headers = {
            "X-Workspace-ID": str(workspace_id),
            "Authorization": f"Bearer {token}",
        }

        membership = _make_membership(workspace_id, user_id, WorkspaceRole.VIEWER)

        with patch(
            "warehouse.lib.workspace.WorkspaceMemberRepository"
        ) as mock_repo_class:
            mock_repo = AsyncMock()
            mock_repo.get_one_or_none.return_value = membership
            mock_repo_class.return_value = mock_repo

            result = await get_workspace_context(mock_request, mock_db_session, mock_config)

            assert result.user_role == WorkspaceRole.VIEWER
            assert result.can_write() is False
