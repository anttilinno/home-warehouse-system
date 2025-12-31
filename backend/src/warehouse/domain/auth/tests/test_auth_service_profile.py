"""Tests for the auth service profile management methods."""

from uuid import uuid7
from unittest.mock import AsyncMock

import pytest

from conftest import (
    TEST_EMAIL_ALICE,
    TEST_EMAIL_ALICE_NEW,
    TEST_EMAIL_BOB,
    TEST_USER_ALICE_JOHNSON,
    TEST_USER_ALICE_SMITH,
)
from warehouse.config import Config
from warehouse.domain.auth.models import User
from warehouse.domain.auth.service import AuthService
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
    repo.session.refresh = AsyncMock()
    return repo


@pytest.fixture
def service(user_repository_mock, config):
    """Auth service for testing."""
    return AuthService(
        repository=user_repository_mock,
        config=config,
    )


def _make_user(**kwargs) -> User:
    """Helper to construct a User instance."""
    defaults = {
        "id": uuid7(),
        "email": TEST_EMAIL_ALICE,
        "full_name": TEST_USER_ALICE_SMITH,
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$test$hash",
        "is_active": True,
    }
    defaults.update(kwargs)
    return User(**defaults)


class TestUpdateProfile:
    """Tests for update_profile method."""

    async def test_update_profile_success_full_name(self, service, user_repository_mock):
        """Test updating full name only."""
        user_id = uuid7()
        user = _make_user(id=user_id, full_name=TEST_USER_ALICE_SMITH)
        user_repository_mock.get_one_or_none.return_value = user

        await service.update_profile(user_id, full_name=TEST_USER_ALICE_JOHNSON)

        assert user.full_name == TEST_USER_ALICE_JOHNSON
        user_repository_mock.session.commit.assert_awaited_once()
        user_repository_mock.session.refresh.assert_awaited_once_with(user)

    async def test_update_profile_success_email(self, service, user_repository_mock):
        """Test updating email."""
        user_id = uuid7()
        user = _make_user(id=user_id, email=TEST_EMAIL_ALICE)
        user_repository_mock.get_one_or_none.return_value = user
        user_repository_mock.get_by_email.return_value = None  # No existing user

        await service.update_profile(user_id, email=TEST_EMAIL_ALICE_NEW)

        assert user.email == TEST_EMAIL_ALICE_NEW
        user_repository_mock.get_by_email.assert_awaited_once_with(TEST_EMAIL_ALICE_NEW)
        user_repository_mock.session.commit.assert_awaited_once()

    async def test_update_profile_duplicate_email(self, service, user_repository_mock):
        """Test updating email fails when email already exists."""
        user_id = uuid7()
        user = _make_user(id=user_id, email=TEST_EMAIL_ALICE)
        existing_user = _make_user(email=TEST_EMAIL_BOB)
        user_repository_mock.get_one_or_none.return_value = user
        user_repository_mock.get_by_email.return_value = existing_user

        with pytest.raises(AppError) as exc_info:
            await service.update_profile(user_id, email=TEST_EMAIL_BOB)

        assert exc_info.value.code == ErrorCode.AUTH_EMAIL_EXISTS

    async def test_update_profile_same_email_skips_check(self, service, user_repository_mock):
        """Test updating to same email doesn't trigger duplicate check."""
        user_id = uuid7()
        user = _make_user(id=user_id, email=TEST_EMAIL_ALICE)
        user_repository_mock.get_one_or_none.return_value = user

        await service.update_profile(user_id, email=TEST_EMAIL_ALICE)

        # Should not check for duplicates when email is the same
        user_repository_mock.get_by_email.assert_not_awaited()

    async def test_update_profile_user_not_found(self, service, user_repository_mock):
        """Test update fails when user not found."""
        user_id = uuid7()
        user_repository_mock.get_one_or_none.return_value = None

        with pytest.raises(AppError) as exc_info:
            await service.update_profile(user_id, full_name="Test")

        assert exc_info.value.code == ErrorCode.AUTH_INVALID_TOKEN

    async def test_update_profile_both_fields(self, service, user_repository_mock):
        """Test updating both email and full name."""
        user_id = uuid7()
        user = _make_user(id=user_id, email=TEST_EMAIL_ALICE, full_name=TEST_USER_ALICE_SMITH)
        user_repository_mock.get_one_or_none.return_value = user
        user_repository_mock.get_by_email.return_value = None

        await service.update_profile(
            user_id, full_name=TEST_USER_ALICE_JOHNSON, email=TEST_EMAIL_ALICE_NEW
        )

        assert user.full_name == TEST_USER_ALICE_JOHNSON
        assert user.email == TEST_EMAIL_ALICE_NEW


class TestChangePassword:
    """Tests for change_password method."""

    async def test_change_password_success(self, service, user_repository_mock):
        """Test changing password with correct current password."""
        user_id = uuid7()
        # Create user with a real hashed password for verification
        original_hash = service.hash_password("oldpassword123")
        user = _make_user(id=user_id, password_hash=original_hash)
        user_repository_mock.get_one_or_none.return_value = user

        await service.change_password(user_id, "oldpassword123", "newpassword456")

        # Password hash should have changed
        assert user.password_hash != original_hash
        # New password should verify
        assert service.verify_password("newpassword456", user.password_hash)
        user_repository_mock.session.commit.assert_awaited_once()
        user_repository_mock.session.refresh.assert_awaited_once_with(user)

    async def test_change_password_wrong_current(self, service, user_repository_mock):
        """Test changing password fails with wrong current password."""
        user_id = uuid7()
        original_hash = service.hash_password("correctpassword")
        user = _make_user(id=user_id, password_hash=original_hash)
        user_repository_mock.get_one_or_none.return_value = user

        with pytest.raises(AppError) as exc_info:
            await service.change_password(user_id, "wrongpassword", "newpassword456")

        assert exc_info.value.code == ErrorCode.AUTH_INVALID_CREDENTIALS

    async def test_change_password_user_not_found(self, service, user_repository_mock):
        """Test change password fails when user not found."""
        user_id = uuid7()
        user_repository_mock.get_one_or_none.return_value = None

        with pytest.raises(AppError) as exc_info:
            await service.change_password(user_id, "current", "new")

        assert exc_info.value.code == ErrorCode.AUTH_INVALID_TOKEN
