"""Tests for OAuth service."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid7

import pytest

from warehouse.config import Config
from warehouse.domain.oauth.service import OAuthAccountService, create_oauth_service


@pytest.fixture
def user_id():
    """Sample user ID."""
    return uuid7()


@pytest.fixture
def account_id():
    """Sample account ID."""
    return uuid7()


@pytest.fixture
def mock_session():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def mock_repository():
    """Mock OAuth account repository."""
    repo = AsyncMock()
    repo.get_by_provider_user_id = AsyncMock(return_value=None)
    repo.get_by_user_id = AsyncMock(return_value=[])
    repo.get_by_id = AsyncMock(return_value=None)
    repo.create = AsyncMock()
    repo.delete = AsyncMock()
    return repo


@pytest.fixture
def mock_oauth_service():
    """Mock litestar-oauth OAuthService."""
    oauth_service = MagicMock()
    oauth_service.list_providers.return_value = ["google", "github"]
    oauth_service.providers = {
        "google": MagicMock(is_configured=MagicMock(return_value=True)),
        "github": MagicMock(is_configured=MagicMock(return_value=True)),
    }
    return oauth_service


@pytest.fixture
def service(mock_session, mock_repository, mock_oauth_service):
    """OAuthAccountService instance with mocked dependencies."""
    return OAuthAccountService(
        session=mock_session,
        repository=mock_repository,
        oauth_service=mock_oauth_service,
    )


@pytest.fixture
def sample_oauth_account(user_id, account_id):
    """Sample OAuth account model."""
    account = MagicMock()
    account.id = account_id
    account.user_id = user_id
    account.provider = "google"
    account.provider_user_id = "google-123"
    account.email = "user@example.com"
    account.display_name = "Test User"
    account.avatar_url = "https://example.com/avatar.jpg"
    account.created_at = datetime.now(timezone.utc)
    return account


@pytest.fixture
def mock_user_info():
    """Mock OAuthUserInfo from litestar-oauth."""
    info = MagicMock()
    info.oauth_id = "google-123"
    info.email = "user@example.com"
    info.first_name = "Test"
    info.last_name = "User"
    info.username = None
    info.avatar_url = "https://example.com/avatar.jpg"
    return info


class TestGetUserAccounts:
    """Tests for get_user_accounts method."""

    async def test_returns_empty_list_when_no_accounts(self, service, mock_repository, user_id):
        """Test returns empty list when user has no linked accounts."""
        mock_repository.get_by_user_id.return_value = []

        result = await service.get_user_accounts(user_id)

        assert result == []
        mock_repository.get_by_user_id.assert_called_once_with(user_id)

    async def test_returns_mapped_accounts(
        self, service, mock_repository, user_id, sample_oauth_account
    ):
        """Test returns mapped OAuthAccountResponse objects."""
        mock_repository.get_by_user_id.return_value = [sample_oauth_account]

        result = await service.get_user_accounts(user_id)

        assert len(result) == 1
        assert result[0].id == sample_oauth_account.id
        assert result[0].provider == "google"
        assert result[0].email == "user@example.com"


class TestUnlinkAccount:
    """Tests for unlink_account method."""

    async def test_returns_false_when_account_not_found(
        self, service, mock_repository, user_id, account_id
    ):
        """Test returns False when account doesn't exist."""
        mock_repository.get_by_id.return_value = None

        result = await service.unlink_account(user_id, account_id)

        assert result is False
        mock_repository.delete.assert_not_called()

    async def test_returns_false_when_account_belongs_to_different_user(
        self, service, mock_repository, user_id, account_id
    ):
        """Test returns False when account belongs to another user."""
        other_user_id = uuid7()
        mock_account = MagicMock()
        mock_account.user_id = other_user_id
        mock_repository.get_by_id.return_value = mock_account

        result = await service.unlink_account(user_id, account_id)

        assert result is False
        mock_repository.delete.assert_not_called()

    async def test_prevents_unlinking_last_oauth_for_passwordless_user(
        self, service, mock_session, mock_repository, user_id, account_id, sample_oauth_account
    ):
        """Test prevents unlinking last OAuth account for user without password."""
        mock_repository.get_by_id.return_value = sample_oauth_account
        mock_repository.get_by_user_id.return_value = [sample_oauth_account]

        # Mock user with empty password
        mock_user = MagicMock()
        mock_user.password_hash = ""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session.execute.return_value = mock_result

        result = await service.unlink_account(user_id, account_id)

        assert result is False
        mock_repository.delete.assert_not_called()

    async def test_allows_unlinking_when_user_has_password(
        self, service, mock_session, mock_repository, user_id, account_id, sample_oauth_account
    ):
        """Test allows unlinking when user has password set."""
        mock_repository.get_by_id.return_value = sample_oauth_account
        mock_repository.get_by_user_id.return_value = [sample_oauth_account]

        # Mock user with password
        mock_user = MagicMock()
        mock_user.password_hash = "hashed-password"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session.execute.return_value = mock_result

        result = await service.unlink_account(user_id, account_id)

        assert result is True
        mock_repository.delete.assert_called_once_with(sample_oauth_account)

    async def test_allows_unlinking_when_multiple_oauth_accounts(
        self, service, mock_repository, user_id, account_id, sample_oauth_account
    ):
        """Test allows unlinking when user has multiple OAuth accounts."""
        another_account = MagicMock()
        another_account.id = uuid7()
        mock_repository.get_by_id.return_value = sample_oauth_account
        mock_repository.get_by_user_id.return_value = [sample_oauth_account, another_account]

        result = await service.unlink_account(user_id, account_id)

        assert result is True
        mock_repository.delete.assert_called_once_with(sample_oauth_account)


class TestHandleOAuthCallback:
    """Tests for handle_oauth_callback method."""

    async def test_returns_existing_user_when_oauth_account_exists(
        self, service, mock_session, mock_repository, sample_oauth_account, mock_user_info
    ):
        """Test returns existing user when OAuth account already linked."""
        mock_repository.get_by_provider_user_id.return_value = sample_oauth_account

        mock_user = MagicMock()
        mock_user.id = sample_oauth_account.user_id
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = mock_user
        mock_session.execute.return_value = mock_result

        user, is_new = await service.handle_oauth_callback("google", mock_user_info)

        assert user == mock_user
        assert is_new is False
        mock_repository.create.assert_not_called()

    async def test_links_to_logged_in_user(
        self, service, mock_session, mock_repository, user_id, mock_user_info
    ):
        """Test links OAuth to currently logged in user."""
        mock_repository.get_by_provider_user_id.return_value = None

        mock_user = MagicMock()
        mock_user.id = user_id
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = mock_user
        mock_session.execute.return_value = mock_result

        user, is_new = await service.handle_oauth_callback(
            "google", mock_user_info, current_user_id=user_id
        )

        assert user == mock_user
        assert is_new is False
        mock_repository.create.assert_called_once()

    async def test_auto_links_when_email_matches_existing_user(
        self, service, mock_session, mock_repository, mock_user_info
    ):
        """Test auto-links OAuth when email matches existing user."""
        mock_repository.get_by_provider_user_id.return_value = None

        existing_user = MagicMock()
        existing_user.id = uuid7()

        # First call for logged in user check (returns None)
        # Second call for email check (returns existing user)
        mock_result_none = MagicMock()
        mock_result_none.scalar_one_or_none.return_value = existing_user
        mock_session.execute.return_value = mock_result_none

        user, is_new = await service.handle_oauth_callback("google", mock_user_info)

        assert user == existing_user
        assert is_new is False
        mock_repository.create.assert_called_once()

    async def test_creates_new_user_when_no_match(
        self, service, mock_session, mock_repository, mock_user_info
    ):
        """Test creates new user when no existing account or email match."""
        mock_repository.get_by_provider_user_id.return_value = None
        mock_user_info.email = "new@example.com"

        # No existing user found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        # Mock flush to set user.id (simulating what DB does)
        created_user_id = uuid7()

        async def side_effect_flush():
            # Get the last added object (user, workspace, or membership)
            if mock_session.add.call_count > 0:
                last_call = mock_session.add.call_args_list[-1]
                obj = last_call[0][0]
                if hasattr(obj, "id") and obj.id is None:
                    obj.id = uuid7()

        mock_session.flush = AsyncMock(side_effect=side_effect_flush)

        user, is_new = await service.handle_oauth_callback("google", mock_user_info)

        assert is_new is True
        mock_session.add.assert_called()
        mock_repository.create.assert_called_once()


class TestGetDisplayName:
    """Tests for _get_display_name helper method."""

    def test_returns_full_name(self, service):
        """Test returns full name when first and last name provided."""
        user_info = MagicMock()
        user_info.first_name = "John"
        user_info.last_name = "Doe"
        user_info.username = None
        user_info.email = "john@example.com"

        result = service._get_display_name(user_info)

        assert result == "John Doe"

    def test_returns_first_name_only(self, service):
        """Test returns first name when last name missing."""
        user_info = MagicMock()
        user_info.first_name = "John"
        user_info.last_name = None
        user_info.username = None
        user_info.email = "john@example.com"

        result = service._get_display_name(user_info)

        assert result == "John"

    def test_returns_username_when_no_name(self, service):
        """Test returns username when no first/last name."""
        user_info = MagicMock()
        user_info.first_name = None
        user_info.last_name = None
        user_info.username = "johndoe"
        user_info.email = "john@example.com"

        result = service._get_display_name(user_info)

        assert result == "johndoe"

    def test_returns_email_when_no_name_or_username(self, service):
        """Test returns email when no name or username."""
        user_info = MagicMock()
        user_info.first_name = None
        user_info.last_name = None
        user_info.username = None
        user_info.email = "john@example.com"

        result = service._get_display_name(user_info)

        assert result == "john@example.com"

    def test_returns_default_when_nothing_available(self, service):
        """Test returns default when nothing available."""
        user_info = MagicMock()
        user_info.first_name = None
        user_info.last_name = None
        user_info.username = None
        user_info.email = None

        result = service._get_display_name(user_info)

        assert result == "OAuth User"


class TestGetAvailableProviders:
    """Tests for get_available_providers method."""

    def test_returns_configured_providers(self, service, mock_oauth_service):
        """Test returns only configured providers."""
        result = service.get_available_providers()

        assert "google" in result
        assert "github" in result

    def test_filters_unconfigured_providers(self, service, mock_oauth_service):
        """Test filters out unconfigured providers."""
        mock_oauth_service.providers["github"].is_configured.return_value = False

        result = service.get_available_providers()

        assert "google" in result
        assert "github" not in result


class TestCreateOAuthService:
    """Tests for create_oauth_service factory function."""

    def test_creates_service_without_providers(self):
        """Test creates service when no providers configured."""
        config = MagicMock(spec=Config)
        config.google_client_id = ""
        config.google_client_secret = ""
        config.github_client_id = ""
        config.github_client_secret = ""

        with patch("warehouse.domain.oauth.service.OAuthService") as MockOAuthService:
            mock_service = MagicMock()
            MockOAuthService.return_value = mock_service

            result = create_oauth_service(config)

            MockOAuthService.assert_called_once()
            mock_service.register.assert_not_called()

    def test_creates_service_with_google_only(self):
        """Test creates service with Google provider only."""
        config = MagicMock(spec=Config)
        config.google_client_id = "google-client-id"
        config.google_client_secret = "google-secret"
        config.github_client_id = ""
        config.github_client_secret = ""

        with patch("warehouse.domain.oauth.service.OAuthService") as MockOAuthService, patch(
            "warehouse.domain.oauth.service.GoogleOAuthProvider"
        ) as MockGoogle:
            mock_service = MagicMock()
            MockOAuthService.return_value = mock_service
            mock_google_provider = MagicMock()
            MockGoogle.return_value = mock_google_provider

            result = create_oauth_service(config)

            MockGoogle.assert_called_once_with(
                client_id="google-client-id",
                client_secret="google-secret",
            )
            mock_service.register.assert_called_once_with(mock_google_provider)

    def test_creates_service_with_both_providers(self):
        """Test creates service with both Google and GitHub providers."""
        config = MagicMock(spec=Config)
        config.google_client_id = "google-client-id"
        config.google_client_secret = "google-secret"
        config.github_client_id = "github-client-id"
        config.github_client_secret = "github-secret"

        with patch("warehouse.domain.oauth.service.OAuthService") as MockOAuthService, patch(
            "warehouse.domain.oauth.service.GoogleOAuthProvider"
        ) as MockGoogle, patch(
            "warehouse.domain.oauth.service.GitHubOAuthProvider"
        ) as MockGitHub:
            mock_service = MagicMock()
            MockOAuthService.return_value = mock_service

            result = create_oauth_service(config)

            MockGoogle.assert_called_once()
            MockGitHub.assert_called_once()
            assert mock_service.register.call_count == 2
