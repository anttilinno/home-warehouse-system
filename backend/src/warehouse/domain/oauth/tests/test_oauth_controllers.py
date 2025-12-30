"""Tests for OAuth domain controllers."""

from datetime import datetime, timezone
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from warehouse.domain.oauth.controllers import (
    OAuthController,
    OAuthAccountController,
    get_oauth_service,
    get_oauth_account_service,
    get_auth_service,
)
from warehouse.domain.oauth.schemas import AvailableProvider, OAuthAccountResponse
from warehouse.errors import AppError, ErrorCode


@pytest.fixture
def user_id():
    """Sample user ID."""
    return uuid7()


@pytest.fixture
def account_id():
    """Sample account ID."""
    return uuid7()


@pytest.fixture
def mock_oauth_service():
    """Mock litestar-oauth OAuthService."""
    service = MagicMock()
    service.get_authorization_url = AsyncMock(return_value="https://oauth.example.com/authorize")
    service.state_manager = MagicMock()
    service.get_provider = MagicMock()
    return service


@pytest.fixture
def mock_oauth_account_service():
    """Mock OAuthAccountService."""
    service = AsyncMock()
    # get_available_providers is a sync method, so use MagicMock
    service.get_available_providers = MagicMock(return_value=["google", "github"])
    service.get_user_accounts = AsyncMock(return_value=[])
    service.unlink_account = AsyncMock(return_value=True)
    service.handle_oauth_callback = AsyncMock()
    return service


@pytest.fixture
def mock_auth_service():
    """Mock AuthService."""
    service = AsyncMock()
    service.create_access_token = MagicMock(return_value="jwt-token")
    service.get_current_user = AsyncMock()
    return service


@pytest.fixture
def mock_config():
    """Mock Config."""
    config = MagicMock()
    config.app_url = "http://localhost:3000"
    config.google_client_id = "google-id"
    config.google_client_secret = "google-secret"
    config.github_client_id = ""
    config.github_client_secret = ""
    return config


@pytest.fixture
def mock_request():
    """Mock Litestar Request."""
    request = MagicMock()
    request.headers = {"Authorization": "Bearer test-jwt-token"}
    return request


@pytest.fixture
def oauth_controller():
    """Create OAuthController instance."""
    return OAuthController(owner=None)


@pytest.fixture
def oauth_account_controller():
    """Create OAuthAccountController instance."""
    return OAuthAccountController(owner=None)


@pytest.fixture
def sample_oauth_account_response(account_id):
    """Sample OAuthAccountResponse."""
    return OAuthAccountResponse(
        id=account_id,
        provider="google",
        email="user@example.com",
        display_name="Test User",
        avatar_url="https://example.com/avatar.jpg",
        created_at=datetime.now(timezone.utc),
    )


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


class TestOAuthControllerGetProviders:
    """Tests for get_providers endpoint."""

    async def test_returns_available_providers(
        self, oauth_controller, mock_oauth_account_service
    ):
        """Test returns list of available providers."""
        result = await _call(
            oauth_controller.get_providers,
            oauth_controller,
            oauth_account_service=mock_oauth_account_service,
        )

        assert len(result) == 2
        assert result[0].provider == "google"
        assert result[0].enabled is True
        assert result[1].provider == "github"

    async def test_returns_empty_when_no_providers(
        self, oauth_controller, mock_oauth_account_service
    ):
        """Test returns empty list when no providers configured."""
        mock_oauth_account_service.get_available_providers.return_value = []

        result = await _call(
            oauth_controller.get_providers,
            oauth_controller,
            oauth_account_service=mock_oauth_account_service,
        )

        assert result == []


class TestOAuthControllerLogin:
    """Tests for oauth_login endpoint."""

    async def test_redirects_to_provider(
        self, oauth_controller, mock_oauth_service, mock_config
    ):
        """Test redirects to OAuth provider authorization URL."""
        result = await _call(
            oauth_controller.oauth_login,
            oauth_controller,
            provider="google",
            oauth_service=mock_oauth_service,
            config=mock_config,
            next=None,
        )

        mock_oauth_service.get_authorization_url.assert_called_once()
        assert result.url == "https://oauth.example.com/authorize"

    async def test_passes_next_url(
        self, oauth_controller, mock_oauth_service, mock_config
    ):
        """Test passes next URL to provider."""
        await _call(
            oauth_controller.oauth_login,
            oauth_controller,
            provider="google",
            oauth_service=mock_oauth_service,
            config=mock_config,
            next="/dashboard",
        )

        call_kwargs = mock_oauth_service.get_authorization_url.call_args[1]
        assert call_kwargs["next_url"] == "/dashboard"

    async def test_handles_provider_error(
        self, oauth_controller, mock_oauth_service, mock_config
    ):
        """Test raises error when OAuth service fails."""
        mock_oauth_service.get_authorization_url.side_effect = Exception("Provider error")

        with pytest.raises(Exception):  # HTTPException
            await _call(
                oauth_controller.oauth_login,
                oauth_controller,
                provider="invalid",
                oauth_service=mock_oauth_service,
                config=mock_config,
                next=None,
            )


class TestOAuthControllerCallback:
    """Tests for oauth_callback endpoint."""

    async def test_redirects_on_error_from_provider(
        self,
        oauth_controller,
        mock_request,
        mock_oauth_service,
        mock_oauth_account_service,
        mock_auth_service,
        mock_config,
    ):
        """Test redirects to login with error when provider returns error."""
        result = await _call(
            oauth_controller.oauth_callback,
            oauth_controller,
            request=mock_request,
            provider="google",
            oauth_service=mock_oauth_service,
            oauth_account_service=mock_oauth_account_service,
            auth_service=mock_auth_service,
            config=mock_config,
            code=None,
            oauth_state=None,
            error="access_denied",
        )

        assert "error=oauth_denied" in result.url

    async def test_redirects_on_missing_params(
        self,
        oauth_controller,
        mock_request,
        mock_oauth_service,
        mock_oauth_account_service,
        mock_auth_service,
        mock_config,
    ):
        """Test redirects to login when code or state missing."""
        result = await _call(
            oauth_controller.oauth_callback,
            oauth_controller,
            request=mock_request,
            provider="google",
            oauth_service=mock_oauth_service,
            oauth_account_service=mock_oauth_account_service,
            auth_service=mock_auth_service,
            config=mock_config,
            code="auth-code",
            oauth_state=None,
            error=None,
        )

        assert "error=oauth_missing_params" in result.url

    async def test_successful_callback_redirects_to_dashboard(
        self,
        oauth_controller,
        mock_request,
        mock_oauth_service,
        mock_oauth_account_service,
        mock_auth_service,
        mock_config,
        user_id,
    ):
        """Test successful callback redirects to dashboard with token."""
        # Setup state manager
        mock_state_data = MagicMock()
        mock_state_data.redirect_uri = "http://localhost:8000/auth/oauth/google/callback"
        mock_state_data.next_url = None
        mock_oauth_service.state_manager.consume_state.return_value = mock_state_data

        # Setup token exchange
        mock_provider = MagicMock()
        mock_token = MagicMock()
        mock_token.access_token = "provider-access-token"
        mock_provider.exchange_code = AsyncMock(return_value=mock_token)
        mock_oauth_service.get_provider.return_value = mock_provider

        # Setup user info
        mock_user_info = MagicMock()
        mock_provider.get_user_info = AsyncMock(return_value=mock_user_info)

        # Setup OAuth account service
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_user.language = "en"
        mock_oauth_account_service.handle_oauth_callback.return_value = (mock_user, False)

        # Setup auth service
        mock_request.headers = {}  # No auth header (not logged in)
        mock_auth_service.create_access_token.return_value = "jwt-token"

        result = await _call(
            oauth_controller.oauth_callback,
            oauth_controller,
            request=mock_request,
            provider="google",
            oauth_service=mock_oauth_service,
            oauth_account_service=mock_oauth_account_service,
            auth_service=mock_auth_service,
            config=mock_config,
            code="auth-code",
            oauth_state="state-token",
            error=None,
        )

        assert "dashboard" in result.url
        assert "token=jwt-token" in result.url
        assert "new_user=true" not in result.url

    async def test_new_user_flag_in_redirect(
        self,
        oauth_controller,
        mock_request,
        mock_oauth_service,
        mock_oauth_account_service,
        mock_auth_service,
        mock_config,
        user_id,
    ):
        """Test new user flag is included in redirect for new users."""
        # Setup state manager
        mock_state_data = MagicMock()
        mock_state_data.redirect_uri = "http://localhost:8000/auth/oauth/google/callback"
        mock_state_data.next_url = None
        mock_oauth_service.state_manager.consume_state.return_value = mock_state_data

        # Setup token exchange
        mock_provider = MagicMock()
        mock_token = MagicMock()
        mock_token.access_token = "provider-access-token"
        mock_provider.exchange_code = AsyncMock(return_value=mock_token)
        mock_oauth_service.get_provider.return_value = mock_provider

        # Setup user info
        mock_user_info = MagicMock()
        mock_provider.get_user_info = AsyncMock(return_value=mock_user_info)

        # Setup OAuth account service - new user
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_user.language = "en"
        mock_oauth_account_service.handle_oauth_callback.return_value = (mock_user, True)

        mock_request.headers = {}

        result = await _call(
            oauth_controller.oauth_callback,
            oauth_controller,
            request=mock_request,
            provider="google",
            oauth_service=mock_oauth_service,
            oauth_account_service=mock_oauth_account_service,
            auth_service=mock_auth_service,
            config=mock_config,
            code="auth-code",
            oauth_state="state-token",
            error=None,
        )

        assert "new_user=true" in result.url


class TestOAuthAccountControllerListAccounts:
    """Tests for list_accounts endpoint."""

    async def test_returns_empty_list(
        self,
        oauth_account_controller,
        mock_request,
        mock_oauth_account_service,
        mock_auth_service,
        user_id,
    ):
        """Test returns empty list when no accounts linked."""
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_auth_service.get_current_user.return_value = mock_user
        mock_oauth_account_service.get_user_accounts.return_value = []

        result = await _call(
            oauth_account_controller.list_accounts,
            oauth_account_controller,
            request=mock_request,
            oauth_account_service=mock_oauth_account_service,
            auth_service=mock_auth_service,
        )

        assert result == []

    async def test_returns_linked_accounts(
        self,
        oauth_account_controller,
        mock_request,
        mock_oauth_account_service,
        mock_auth_service,
        user_id,
        sample_oauth_account_response,
    ):
        """Test returns list of linked accounts."""
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_auth_service.get_current_user.return_value = mock_user
        mock_oauth_account_service.get_user_accounts.return_value = [
            sample_oauth_account_response
        ]

        result = await _call(
            oauth_account_controller.list_accounts,
            oauth_account_controller,
            request=mock_request,
            oauth_account_service=mock_oauth_account_service,
            auth_service=mock_auth_service,
        )

        assert len(result) == 1
        assert result[0].provider == "google"

    async def test_raises_on_invalid_token(
        self,
        oauth_account_controller,
        mock_oauth_account_service,
        mock_auth_service,
    ):
        """Test raises error when auth token is invalid."""
        mock_request = MagicMock()
        mock_request.headers = {}  # No Authorization header

        with pytest.raises(Exception):  # HTTPException
            await _call(
                oauth_account_controller.list_accounts,
                oauth_account_controller,
                request=mock_request,
                oauth_account_service=mock_oauth_account_service,
                auth_service=mock_auth_service,
            )


class TestOAuthAccountControllerUnlinkAccount:
    """Tests for unlink_account endpoint."""

    async def test_unlink_success(
        self,
        oauth_account_controller,
        mock_request,
        mock_oauth_account_service,
        mock_auth_service,
        user_id,
        account_id,
    ):
        """Test successfully unlinking an account."""
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_auth_service.get_current_user.return_value = mock_user
        mock_oauth_account_service.unlink_account.return_value = True

        # Should not raise
        await _call(
            oauth_account_controller.unlink_account,
            oauth_account_controller,
            request=mock_request,
            account_id=account_id,
            oauth_account_service=mock_oauth_account_service,
            auth_service=mock_auth_service,
        )

        mock_oauth_account_service.unlink_account.assert_called_once_with(user_id, account_id)

    async def test_unlink_fails_raises_error(
        self,
        oauth_account_controller,
        mock_request,
        mock_oauth_account_service,
        mock_auth_service,
        user_id,
        account_id,
    ):
        """Test raises error when unlink fails."""
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_auth_service.get_current_user.return_value = mock_user
        mock_oauth_account_service.unlink_account.return_value = False

        with pytest.raises(Exception):  # HTTPException
            await _call(
                oauth_account_controller.unlink_account,
                oauth_account_controller,
                request=mock_request,
                account_id=account_id,
                oauth_account_service=mock_oauth_account_service,
                auth_service=mock_auth_service,
            )


class TestExtractToken:
    """Tests for _extract_token helper."""

    def test_extracts_bearer_token(self, oauth_account_controller):
        """Test extracts token from Bearer header."""
        mock_request = MagicMock()
        mock_request.headers = {"Authorization": "Bearer my-jwt-token"}

        result = oauth_account_controller._extract_token(mock_request)

        assert result == "my-jwt-token"

    def test_raises_on_missing_header(self, oauth_account_controller):
        """Test raises error when header missing."""
        mock_request = MagicMock()
        mock_request.headers = {}

        with pytest.raises(Exception):  # HTTPException
            oauth_account_controller._extract_token(mock_request)

    def test_raises_on_invalid_format(self, oauth_account_controller):
        """Test raises error when header has wrong format."""
        mock_request = MagicMock()
        mock_request.headers = {"Authorization": "Basic credentials"}

        with pytest.raises(Exception):  # HTTPException
            oauth_account_controller._extract_token(mock_request)


class TestDependencyFactories:
    """Tests for dependency factory functions."""

    def test_get_oauth_service(self, mock_config):
        """Test get_oauth_service creates service."""
        with patch("warehouse.domain.oauth.controllers.create_oauth_service") as mock_create:
            mock_create.return_value = MagicMock()

            get_oauth_service(mock_config)

            mock_create.assert_called_once_with(mock_config)

    def test_get_oauth_account_service(self, mock_config):
        """Test get_oauth_account_service creates service."""
        mock_session = AsyncMock()

        with patch("warehouse.domain.oauth.controllers.create_oauth_service"), patch(
            "warehouse.domain.oauth.controllers.OAuthAccountRepository"
        ):
            result = get_oauth_account_service(mock_session, mock_config)

            assert result is not None

    def test_get_auth_service(self, mock_config):
        """Test get_auth_service creates service."""
        mock_session = AsyncMock()

        with patch("warehouse.domain.oauth.controllers.UserRepository"), patch(
            "warehouse.domain.oauth.controllers.WorkspaceRepository"
        ), patch("warehouse.domain.oauth.controllers.WorkspaceMemberRepository"):
            result = get_auth_service(mock_session, mock_config)

            assert result is not None
