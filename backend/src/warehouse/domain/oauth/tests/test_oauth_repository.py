"""Tests for OAuthAccountRepository."""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid7

import pytest

from warehouse.domain.oauth.repository import OAuthAccountRepository


@pytest.fixture
def mock_session():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.delete = AsyncMock()
    return session


@pytest.fixture
def repository(mock_session):
    """OAuthAccountRepository instance with mocked session."""
    return OAuthAccountRepository(session=mock_session)


@pytest.fixture
def user_id():
    """Sample user ID."""
    return uuid7()


@pytest.fixture
def account_id():
    """Sample account ID."""
    return uuid7()


class TestGetByProviderUserId:
    """Tests for get_by_provider_user_id method."""

    async def test_returns_account_when_found(self, repository, mock_session):
        """Test returns account when provider and user_id match."""
        mock_account = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_account
        mock_session.execute.return_value = mock_result

        result = await repository.get_by_provider_user_id("google", "google-123")

        assert result == mock_account
        mock_session.execute.assert_called_once()

    async def test_returns_none_when_not_found(self, repository, mock_session):
        """Test returns None when no matching account."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        result = await repository.get_by_provider_user_id("google", "unknown-123")

        assert result is None


class TestGetByUserId:
    """Tests for get_by_user_id method."""

    async def test_returns_list_of_accounts(self, repository, mock_session, user_id):
        """Test returns all accounts for user."""
        mock_account1 = MagicMock()
        mock_account2 = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_account1, mock_account2]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute.return_value = mock_result

        result = await repository.get_by_user_id(user_id)

        assert len(result) == 2
        assert mock_account1 in result
        assert mock_account2 in result

    async def test_returns_empty_list_when_no_accounts(self, repository, mock_session, user_id):
        """Test returns empty list when user has no accounts."""
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute.return_value = mock_result

        result = await repository.get_by_user_id(user_id)

        assert result == []


class TestGetById:
    """Tests for get_by_id method."""

    async def test_returns_account_when_found(self, repository, mock_session, account_id):
        """Test returns account when ID matches."""
        mock_account = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_account
        mock_session.execute.return_value = mock_result

        result = await repository.get_by_id(account_id)

        assert result == mock_account

    async def test_returns_none_when_not_found(self, repository, mock_session, account_id):
        """Test returns None when ID not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        result = await repository.get_by_id(account_id)

        assert result is None


class TestCreate:
    """Tests for create method."""

    async def test_creates_account_with_all_fields(self, repository, mock_session, user_id):
        """Test creates account with all provided fields."""
        await repository.create(
            user_id=user_id,
            provider="google",
            provider_user_id="google-123",
            email="user@example.com",
            display_name="Test User",
            avatar_url="https://example.com/avatar.jpg",
            access_token="access-token",
            refresh_token="refresh-token",
        )

        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
        # Verify the account was created with correct attributes
        added_account = mock_session.add.call_args[0][0]
        assert added_account.user_id == user_id
        assert added_account.provider == "google"
        assert added_account.provider_user_id == "google-123"
        assert added_account.email == "user@example.com"
        assert added_account.display_name == "Test User"

    async def test_creates_account_with_minimal_fields(self, repository, mock_session, user_id):
        """Test creates account with only required fields."""
        await repository.create(
            user_id=user_id,
            provider="github",
            provider_user_id="github-456",
        )

        mock_session.add.assert_called_once()
        added_account = mock_session.add.call_args[0][0]
        assert added_account.user_id == user_id
        assert added_account.provider == "github"
        assert added_account.email is None


class TestDelete:
    """Tests for delete method."""

    async def test_deletes_account(self, repository, mock_session):
        """Test deletes the account."""
        mock_account = MagicMock()

        await repository.delete(mock_account)

        mock_session.delete.assert_called_once_with(mock_account)
        mock_session.flush.assert_called_once()


class TestUpdateTokens:
    """Tests for update_tokens method."""

    async def test_updates_access_token(self, repository, mock_session):
        """Test updates only access token when provided."""
        mock_account = MagicMock()
        mock_account.access_token = "old-access"
        mock_account.refresh_token = "old-refresh"

        await repository.update_tokens(mock_account, access_token="new-access")

        assert mock_account.access_token == "new-access"
        assert mock_account.refresh_token == "old-refresh"
        mock_session.flush.assert_called_once()

    async def test_updates_both_tokens(self, repository, mock_session):
        """Test updates both tokens when provided."""
        mock_account = MagicMock()

        await repository.update_tokens(
            mock_account, access_token="new-access", refresh_token="new-refresh"
        )

        assert mock_account.access_token == "new-access"
        assert mock_account.refresh_token == "new-refresh"

    async def test_skips_none_values(self, repository, mock_session):
        """Test skips update when None is passed."""
        mock_account = MagicMock()
        mock_account.access_token = "original-access"
        mock_account.refresh_token = "original-refresh"

        await repository.update_tokens(mock_account)

        # Should not change values when None passed
        assert mock_account.access_token == "original-access"
        assert mock_account.refresh_token == "original-refresh"
