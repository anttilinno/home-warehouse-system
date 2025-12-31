"""Tests for the auth service workspace management methods."""

from datetime import datetime
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock

import pytest

from conftest import (
    TEST_EMAIL_ALICE,
    TEST_EMAIL_BOB,
    TEST_USER_ALICE_SMITH,
    TEST_WORKSPACE_DESC,
    TEST_WORKSPACE_NAME,
)
from warehouse.config import Config
from warehouse.domain.auth.models import User, Workspace, WorkspaceMember, WorkspaceRole
from warehouse.domain.auth.schemas import WorkspaceCreate, WorkspaceMemberInvite
from warehouse.domain.auth.service import AuthService, slugify
from warehouse.errors import AppError, ErrorCode


@pytest.fixture
def config() -> Config:
    """Minimal config for testing."""
    return Config(
        database_url="sqlite://",
        redis_url="redis://localhost:6379/0",
        secret_key="secret-key",
        jwt_algorithm="HS256",
        jwt_expiration_hours=1,
    )


@pytest.fixture
def user_repository_mock():
    """Mocked user repository."""
    repo = AsyncMock()
    repo.get_by_email = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.session = AsyncMock()
    repo.session.commit = AsyncMock()
    repo.session.execute = AsyncMock()
    return repo


@pytest.fixture
def workspace_repository_mock():
    """Mocked workspace repository."""
    repo = AsyncMock()
    repo.get_by_slug = AsyncMock()
    repo.add = AsyncMock()
    return repo


@pytest.fixture
def workspace_member_repository_mock():
    """Mocked workspace member repository."""
    repo = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.add = AsyncMock()
    return repo


@pytest.fixture
def service(
    user_repository_mock,
    config,
    workspace_repository_mock,
    workspace_member_repository_mock,
):
    """Auth service with all repositories."""
    return AuthService(
        repository=user_repository_mock,
        config=config,
        workspace_repository=workspace_repository_mock,
        workspace_member_repository=workspace_member_repository_mock,
    )


def _make_user(**kwargs) -> User:
    """Helper to construct a User instance."""
    defaults = {
        "id": uuid7(),
        "email": TEST_EMAIL_ALICE,
        "full_name": TEST_USER_ALICE_SMITH,
        "password_hash": "hashed",
        "is_active": True,
    }
    defaults.update(kwargs)
    return User(**defaults)


def _make_workspace(**kwargs) -> Workspace:
    """Helper to construct a Workspace instance."""
    defaults = {
        "id": uuid7(),
        "name": TEST_WORKSPACE_NAME,
        "slug": "test-workspace",
        "description": TEST_WORKSPACE_DESC,
    }
    defaults.update(kwargs)
    return Workspace(**defaults)


def _make_membership(**kwargs) -> WorkspaceMember:
    """Helper to construct a WorkspaceMember instance."""
    defaults = {
        "id": uuid7(),
        "workspace_id": uuid7(),
        "user_id": uuid7(),
        "role": WorkspaceRole.MEMBER,
        "created_at": datetime.now(),
    }
    defaults.update(kwargs)
    return WorkspaceMember(**defaults)


class TestSlugify:
    """Tests for slugify function."""

    def test_slugify_simple(self):
        """Test simple text slugification."""
        assert slugify("Hello World") == "hello-world"

    def test_slugify_special_chars(self):
        """Test slugify removes special characters."""
        assert slugify("Hello! World?") == "hello-world"

    def test_slugify_multiple_spaces(self):
        """Test slugify handles multiple spaces."""
        assert slugify("Hello   World") == "hello-world"


class TestCreateWorkspace:
    """Tests for create_workspace method."""

    async def test_create_workspace_success(
        self, service, user_repository_mock, workspace_repository_mock, workspace_member_repository_mock
    ):
        """Test creating a new workspace."""
        user_id = uuid7()
        workspace = _make_workspace()
        workspace_repository_mock.get_by_slug.return_value = None
        workspace_repository_mock.add.return_value = workspace

        data = WorkspaceCreate(name=TEST_WORKSPACE_NAME, description=TEST_WORKSPACE_DESC)
        result = await service.create_workspace(user_id, data)

        assert result.name == TEST_WORKSPACE_NAME
        assert result.role == "owner"
        workspace_repository_mock.add.assert_awaited_once()
        workspace_member_repository_mock.add.assert_awaited_once()

    async def test_create_workspace_generates_unique_slug(
        self, service, workspace_repository_mock, workspace_member_repository_mock
    ):
        """Test that create_workspace generates unique slug when duplicate exists."""
        user_id = uuid7()
        # First slug exists, second doesn't
        workspace_repository_mock.get_by_slug.side_effect = [
            _make_workspace(),  # "test-workspace" exists
            None,  # "test-workspace-1" doesn't exist
        ]
        workspace = _make_workspace(slug="test-workspace-1")
        workspace_repository_mock.add.return_value = workspace

        data = WorkspaceCreate(name=TEST_WORKSPACE_NAME, description=TEST_WORKSPACE_DESC)
        await service.create_workspace(user_id, data)

        assert workspace_repository_mock.get_by_slug.await_count == 2


class TestGetWorkspaceMembers:
    """Tests for get_workspace_members method."""

    async def test_get_workspace_members_success(
        self, service, user_repository_mock, workspace_member_repository_mock
    ):
        """Test getting workspace members."""
        workspace_id = uuid7()
        user_id = uuid7()

        # User is a member
        membership = _make_membership(workspace_id=workspace_id, user_id=user_id)
        workspace_member_repository_mock.get_one_or_none.return_value = membership

        # Mock members with user details
        member1 = _make_membership(workspace_id=workspace_id, role=WorkspaceRole.OWNER)
        member1.user = _make_user(id=member1.user_id)
        member2 = _make_membership(workspace_id=workspace_id, role=WorkspaceRole.MEMBER)
        member2.user = _make_user(id=member2.user_id, email=TEST_EMAIL_BOB, full_name="Bob")

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [member1, member2]
        user_repository_mock.session.execute.return_value = mock_result

        result = await service.get_workspace_members(workspace_id, user_id)

        assert len(result) == 2
        workspace_member_repository_mock.get_one_or_none.assert_awaited_once()

    async def test_get_workspace_members_not_member(
        self, service, workspace_member_repository_mock
    ):
        """Test getting members when user is not a member raises error."""
        workspace_id = uuid7()
        user_id = uuid7()
        workspace_member_repository_mock.get_one_or_none.return_value = None

        with pytest.raises(AppError) as exc_info:
            await service.get_workspace_members(workspace_id, user_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_NOT_FOUND


class TestInviteMember:
    """Tests for invite_member method."""

    async def test_invite_member_success(
        self, service, user_repository_mock, workspace_member_repository_mock
    ):
        """Test inviting a member as owner/admin."""
        workspace_id = uuid7()
        inviter_id = uuid7()
        invitee = _make_user(email=TEST_EMAIL_BOB)

        # Inviter is owner
        inviter_membership = _make_membership(
            workspace_id=workspace_id, user_id=inviter_id, role=WorkspaceRole.OWNER
        )
        workspace_member_repository_mock.get_one_or_none.side_effect = [
            inviter_membership,  # First call: get inviter membership
            None,  # Second call: check if invitee already member
        ]
        user_repository_mock.get_by_email.return_value = invitee

        new_membership = _make_membership(
            workspace_id=workspace_id,
            user_id=invitee.id,
            role=WorkspaceRole.MEMBER,
        )
        new_membership.user = invitee
        workspace_member_repository_mock.add.return_value = new_membership

        data = WorkspaceMemberInvite(email=TEST_EMAIL_BOB, role="member")
        result = await service.invite_member(workspace_id, inviter_id, data)

        assert result.email == TEST_EMAIL_BOB
        assert result.role == "member"

    async def test_invite_member_not_authorized(
        self, service, workspace_member_repository_mock
    ):
        """Test invite fails when inviter is not admin/owner."""
        workspace_id = uuid7()
        inviter_id = uuid7()

        # Inviter is only a viewer
        inviter_membership = _make_membership(
            workspace_id=workspace_id, user_id=inviter_id, role=WorkspaceRole.VIEWER
        )
        workspace_member_repository_mock.get_one_or_none.return_value = inviter_membership

        data = WorkspaceMemberInvite(email=TEST_EMAIL_BOB, role="member")

        with pytest.raises(AppError) as exc_info:
            await service.invite_member(workspace_id, inviter_id, data)

        assert exc_info.value.code == ErrorCode.WORKSPACE_PERMISSION_DENIED

    async def test_invite_member_already_exists(
        self, service, user_repository_mock, workspace_member_repository_mock
    ):
        """Test invite fails when user is already a member."""
        workspace_id = uuid7()
        inviter_id = uuid7()
        invitee = _make_user(email=TEST_EMAIL_BOB)

        inviter_membership = _make_membership(
            workspace_id=workspace_id, user_id=inviter_id, role=WorkspaceRole.OWNER
        )
        existing_membership = _make_membership(
            workspace_id=workspace_id, user_id=invitee.id
        )
        workspace_member_repository_mock.get_one_or_none.side_effect = [
            inviter_membership,
            existing_membership,  # User already member
        ]
        user_repository_mock.get_by_email.return_value = invitee

        data = WorkspaceMemberInvite(email=TEST_EMAIL_BOB, role="member")

        with pytest.raises(AppError) as exc_info:
            await service.invite_member(workspace_id, inviter_id, data)

        assert exc_info.value.code == ErrorCode.WORKSPACE_MEMBER_EXISTS

    async def test_invite_member_invalid_role(
        self, service, user_repository_mock, workspace_member_repository_mock
    ):
        """Test invite fails with invalid role."""
        workspace_id = uuid7()
        inviter_id = uuid7()
        invitee = _make_user(email=TEST_EMAIL_BOB)

        inviter_membership = _make_membership(
            workspace_id=workspace_id, user_id=inviter_id, role=WorkspaceRole.OWNER
        )
        workspace_member_repository_mock.get_one_or_none.side_effect = [
            inviter_membership,
            None,
        ]
        user_repository_mock.get_by_email.return_value = invitee

        data = WorkspaceMemberInvite(email=TEST_EMAIL_BOB, role="invalid_role")

        with pytest.raises(AppError) as exc_info:
            await service.invite_member(workspace_id, inviter_id, data)

        assert exc_info.value.code == ErrorCode.GENERAL_BAD_REQUEST

    async def test_invite_member_cannot_invite_as_owner(
        self, service, user_repository_mock, workspace_member_repository_mock
    ):
        """Test cannot invite someone as owner."""
        workspace_id = uuid7()
        inviter_id = uuid7()
        invitee = _make_user(email=TEST_EMAIL_BOB)

        inviter_membership = _make_membership(
            workspace_id=workspace_id, user_id=inviter_id, role=WorkspaceRole.OWNER
        )
        workspace_member_repository_mock.get_one_or_none.side_effect = [
            inviter_membership,
            None,
        ]
        user_repository_mock.get_by_email.return_value = invitee

        data = WorkspaceMemberInvite(email=TEST_EMAIL_BOB, role="owner")

        with pytest.raises(AppError) as exc_info:
            await service.invite_member(workspace_id, inviter_id, data)

        assert exc_info.value.code == ErrorCode.WORKSPACE_PERMISSION_DENIED


class TestSearchUsers:
    """Tests for search_users method."""

    async def test_search_users_by_email(self, service, user_repository_mock):
        """Test searching users by email."""
        users = [_make_user(email=TEST_EMAIL_ALICE)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = users
        user_repository_mock.session.execute.return_value = mock_result

        result = await service.search_users(query="alice")

        assert len(result) == 1
        assert result[0]["email"] == TEST_EMAIL_ALICE

    async def test_search_users_by_name(self, service, user_repository_mock):
        """Test searching users by name."""
        users = [_make_user(full_name=TEST_USER_ALICE_SMITH)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = users
        user_repository_mock.session.execute.return_value = mock_result

        result = await service.search_users(query="Smith")

        assert len(result) == 1
        assert result[0]["full_name"] == TEST_USER_ALICE_SMITH

    async def test_search_users_excludes_workspace_members(
        self, service, user_repository_mock, workspace_member_repository_mock
    ):
        """Test search excludes existing workspace members."""
        workspace_id = uuid7()
        users = [_make_user()]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = users
        user_repository_mock.session.execute.return_value = mock_result

        result = await service.search_users(query="alice", workspace_id=workspace_id)

        assert len(result) == 1
        user_repository_mock.session.execute.assert_awaited_once()


class TestDeleteWorkspace:
    """Tests for delete_workspace method."""

    async def test_delete_workspace_success_owner(
        self, service, workspace_repository_mock, workspace_member_repository_mock, user_repository_mock
    ):
        """Test owner can delete non-protected workspace."""
        workspace_id = uuid7()
        other_workspace_id = uuid7()
        user_id = uuid7()

        workspace = _make_workspace(id=workspace_id, is_personal=False)
        workspace_repository_mock.get_one_or_none.return_value = workspace

        membership = _make_membership(
            workspace_id=workspace_id, user_id=user_id, role=WorkspaceRole.OWNER
        )
        other_membership = _make_membership(
            workspace_id=other_workspace_id, user_id=user_id, role=WorkspaceRole.OWNER
        )
        workspace_member_repository_mock.get_one_or_none.return_value = membership
        # User has 2 workspaces so delete is allowed
        workspace_member_repository_mock.list.return_value = [membership, other_membership]

        # Mock session.execute for raw SQL delete
        user_repository_mock.session.execute = AsyncMock()
        user_repository_mock.session.commit = AsyncMock()

        await service.delete_workspace(workspace_id, user_id)

        user_repository_mock.session.execute.assert_awaited_once()

    async def test_delete_workspace_success_admin(
        self, service, workspace_repository_mock, workspace_member_repository_mock, user_repository_mock
    ):
        """Test admin can delete non-protected workspace."""
        workspace_id = uuid7()
        other_workspace_id = uuid7()
        user_id = uuid7()

        workspace = _make_workspace(id=workspace_id, is_personal=False)
        workspace_repository_mock.get_one_or_none.return_value = workspace

        membership = _make_membership(
            workspace_id=workspace_id, user_id=user_id, role=WorkspaceRole.ADMIN
        )
        other_membership = _make_membership(
            workspace_id=other_workspace_id, user_id=user_id, role=WorkspaceRole.OWNER
        )
        workspace_member_repository_mock.get_one_or_none.return_value = membership
        # User has 2 workspaces so delete is allowed
        workspace_member_repository_mock.list.return_value = [membership, other_membership]

        # Mock session.execute for raw SQL delete
        user_repository_mock.session.execute = AsyncMock()
        user_repository_mock.session.commit = AsyncMock()

        await service.delete_workspace(workspace_id, user_id)

        user_repository_mock.session.execute.assert_awaited_once()

    async def test_delete_workspace_protected_fails(
        self, service, workspace_repository_mock
    ):
        """Test personal workspace cannot be deleted."""
        workspace_id = uuid7()
        user_id = uuid7()

        workspace = _make_workspace(id=workspace_id, is_personal=True)
        workspace_repository_mock.get_one_or_none.return_value = workspace

        with pytest.raises(AppError) as exc_info:
            await service.delete_workspace(workspace_id, user_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_PROTECTED

    async def test_delete_workspace_not_found(
        self, service, workspace_repository_mock
    ):
        """Test deleting non-existent workspace fails."""
        workspace_id = uuid7()
        user_id = uuid7()

        workspace_repository_mock.get_one_or_none.return_value = None

        with pytest.raises(AppError) as exc_info:
            await service.delete_workspace(workspace_id, user_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_NOT_FOUND

    async def test_delete_workspace_member_not_authorized(
        self, service, workspace_repository_mock, workspace_member_repository_mock
    ):
        """Test member cannot delete workspace."""
        workspace_id = uuid7()
        user_id = uuid7()

        workspace = _make_workspace(id=workspace_id, is_personal=False)
        workspace_repository_mock.get_one_or_none.return_value = workspace

        membership = _make_membership(
            workspace_id=workspace_id, user_id=user_id, role=WorkspaceRole.MEMBER
        )
        workspace_member_repository_mock.get_one_or_none.return_value = membership

        with pytest.raises(AppError) as exc_info:
            await service.delete_workspace(workspace_id, user_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_PERMISSION_DENIED

    async def test_delete_workspace_viewer_not_authorized(
        self, service, workspace_repository_mock, workspace_member_repository_mock
    ):
        """Test viewer cannot delete workspace."""
        workspace_id = uuid7()
        user_id = uuid7()

        workspace = _make_workspace(id=workspace_id, is_personal=False)
        workspace_repository_mock.get_one_or_none.return_value = workspace

        membership = _make_membership(
            workspace_id=workspace_id, user_id=user_id, role=WorkspaceRole.VIEWER
        )
        workspace_member_repository_mock.get_one_or_none.return_value = membership

        with pytest.raises(AppError) as exc_info:
            await service.delete_workspace(workspace_id, user_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_PERMISSION_DENIED

    async def test_delete_workspace_non_member(
        self, service, workspace_repository_mock, workspace_member_repository_mock
    ):
        """Test non-member cannot delete workspace."""
        workspace_id = uuid7()
        user_id = uuid7()

        workspace = _make_workspace(id=workspace_id, is_personal=False)
        workspace_repository_mock.get_one_or_none.return_value = workspace
        workspace_member_repository_mock.get_one_or_none.return_value = None

        with pytest.raises(AppError) as exc_info:
            await service.delete_workspace(workspace_id, user_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_NOT_FOUND

    async def test_delete_workspace_last_workspace_fails(
        self, service, workspace_repository_mock, workspace_member_repository_mock
    ):
        """Test cannot delete last workspace."""
        workspace_id = uuid7()
        user_id = uuid7()

        workspace = _make_workspace(id=workspace_id, is_personal=False)
        workspace_repository_mock.get_one_or_none.return_value = workspace

        membership = _make_membership(
            workspace_id=workspace_id, user_id=user_id, role=WorkspaceRole.OWNER
        )
        workspace_member_repository_mock.get_one_or_none.return_value = membership
        # User has only 1 workspace - this is their last one
        workspace_member_repository_mock.list.return_value = [membership]

        with pytest.raises(AppError) as exc_info:
            await service.delete_workspace(workspace_id, user_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_LAST


class TestRemoveMember:
    """Tests for remove_member method."""

    async def test_remove_member_success_by_owner(
        self, service, user_repository_mock, workspace_member_repository_mock
    ):
        """Test owner can remove a member."""
        workspace_id = uuid7()
        owner_id = uuid7()
        member_id = uuid7()
        target_user_id = uuid7()

        owner_membership = _make_membership(
            workspace_id=workspace_id, user_id=owner_id, role=WorkspaceRole.OWNER
        )
        target_membership = _make_membership(
            id=member_id, workspace_id=workspace_id, user_id=target_user_id, role=WorkspaceRole.MEMBER
        )

        workspace_member_repository_mock.get_one_or_none.side_effect = [
            owner_membership,  # Remover lookup
            target_membership,  # Target lookup
        ]
        workspace_member_repository_mock.delete = AsyncMock()

        await service.remove_member(workspace_id, member_id, owner_id)

        workspace_member_repository_mock.delete.assert_awaited_once_with(member_id)

    async def test_remove_member_success_by_admin(
        self, service, user_repository_mock, workspace_member_repository_mock
    ):
        """Test admin can remove a member."""
        workspace_id = uuid7()
        admin_id = uuid7()
        member_id = uuid7()
        target_user_id = uuid7()

        admin_membership = _make_membership(
            workspace_id=workspace_id, user_id=admin_id, role=WorkspaceRole.ADMIN
        )
        target_membership = _make_membership(
            id=member_id, workspace_id=workspace_id, user_id=target_user_id, role=WorkspaceRole.MEMBER
        )

        workspace_member_repository_mock.get_one_or_none.side_effect = [
            admin_membership,
            target_membership,
        ]
        workspace_member_repository_mock.delete = AsyncMock()

        await service.remove_member(workspace_id, member_id, admin_id)

        workspace_member_repository_mock.delete.assert_awaited_once_with(member_id)

    async def test_remove_member_cannot_remove_owner(
        self, service, workspace_member_repository_mock
    ):
        """Test that owner cannot be removed."""
        workspace_id = uuid7()
        admin_id = uuid7()
        owner_member_id = uuid7()
        owner_user_id = uuid7()

        admin_membership = _make_membership(
            workspace_id=workspace_id, user_id=admin_id, role=WorkspaceRole.ADMIN
        )
        owner_membership = _make_membership(
            id=owner_member_id, workspace_id=workspace_id, user_id=owner_user_id, role=WorkspaceRole.OWNER
        )

        workspace_member_repository_mock.get_one_or_none.side_effect = [
            admin_membership,
            owner_membership,
        ]

        with pytest.raises(AppError) as exc_info:
            await service.remove_member(workspace_id, owner_member_id, admin_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_OWNER_CANNOT_BE_REMOVED

    async def test_remove_member_owner_cannot_remove_self(
        self, service, workspace_member_repository_mock
    ):
        """Test that owner cannot remove themselves."""
        workspace_id = uuid7()
        owner_id = uuid7()
        owner_member_id = uuid7()

        owner_membership = _make_membership(
            id=owner_member_id, workspace_id=workspace_id, user_id=owner_id, role=WorkspaceRole.OWNER
        )

        workspace_member_repository_mock.get_one_or_none.side_effect = [
            owner_membership,  # Remover lookup (owner)
            owner_membership,  # Target lookup (also owner)
        ]

        with pytest.raises(AppError) as exc_info:
            await service.remove_member(workspace_id, owner_member_id, owner_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_OWNER_CANNOT_BE_REMOVED

    async def test_remove_member_not_authorized(
        self, service, workspace_member_repository_mock
    ):
        """Test member cannot remove other members."""
        workspace_id = uuid7()
        remover_id = uuid7()
        member_id = uuid7()

        remover_membership = _make_membership(
            workspace_id=workspace_id, user_id=remover_id, role=WorkspaceRole.MEMBER
        )
        workspace_member_repository_mock.get_one_or_none.return_value = remover_membership

        with pytest.raises(AppError) as exc_info:
            await service.remove_member(workspace_id, member_id, remover_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_PERMISSION_DENIED

    async def test_remove_member_viewer_not_authorized(
        self, service, workspace_member_repository_mock
    ):
        """Test viewer cannot remove members."""
        workspace_id = uuid7()
        viewer_id = uuid7()
        member_id = uuid7()

        viewer_membership = _make_membership(
            workspace_id=workspace_id, user_id=viewer_id, role=WorkspaceRole.VIEWER
        )
        workspace_member_repository_mock.get_one_or_none.return_value = viewer_membership

        with pytest.raises(AppError) as exc_info:
            await service.remove_member(workspace_id, member_id, viewer_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_PERMISSION_DENIED

    async def test_remove_member_not_found(
        self, service, workspace_member_repository_mock
    ):
        """Test removing non-existent member fails."""
        workspace_id = uuid7()
        owner_id = uuid7()
        member_id = uuid7()

        owner_membership = _make_membership(
            workspace_id=workspace_id, user_id=owner_id, role=WorkspaceRole.OWNER
        )
        workspace_member_repository_mock.get_one_or_none.side_effect = [
            owner_membership,
            None,  # Target not found
        ]

        with pytest.raises(AppError) as exc_info:
            await service.remove_member(workspace_id, member_id, owner_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_MEMBER_NOT_FOUND

    async def test_remove_member_wrong_workspace(
        self, service, workspace_member_repository_mock
    ):
        """Test removing member from different workspace fails."""
        workspace_id = uuid7()
        other_workspace_id = uuid7()
        owner_id = uuid7()
        member_id = uuid7()

        owner_membership = _make_membership(
            workspace_id=workspace_id, user_id=owner_id, role=WorkspaceRole.OWNER
        )
        target_membership = _make_membership(
            id=member_id, workspace_id=other_workspace_id, role=WorkspaceRole.MEMBER
        )
        workspace_member_repository_mock.get_one_or_none.side_effect = [
            owner_membership,
            target_membership,  # Different workspace
        ]

        with pytest.raises(AppError) as exc_info:
            await service.remove_member(workspace_id, member_id, owner_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_MEMBER_NOT_FOUND

    async def test_remove_member_remover_not_member(
        self, service, workspace_member_repository_mock
    ):
        """Test non-member cannot remove others."""
        workspace_id = uuid7()
        non_member_id = uuid7()
        member_id = uuid7()

        workspace_member_repository_mock.get_one_or_none.return_value = None

        with pytest.raises(AppError) as exc_info:
            await service.remove_member(workspace_id, member_id, non_member_id)

        assert exc_info.value.code == ErrorCode.WORKSPACE_NOT_FOUND
