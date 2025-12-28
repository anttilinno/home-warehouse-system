"""Tests for the Docspell HTTP client."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from warehouse.domain.docspell.client import DocspellAuthToken, DocspellClient


@pytest.fixture
def client():
    """Create a Docspell client for testing."""
    return DocspellClient(
        base_url="http://localhost:7880",
        collective="test-collective",
        username="testuser",
        password="testpass",
    )


class TestDocspellClientInit:
    """Tests for client initialization."""

    def test_init_strips_trailing_slash(self):
        """Test that trailing slash is stripped from base URL."""
        client = DocspellClient(
            base_url="http://localhost:7880/",
            collective="test",
            username="user",
            password="pass",
        )
        assert client.base_url == "http://localhost:7880"

    def test_init_stores_credentials(self):
        """Test that credentials are stored."""
        client = DocspellClient(
            base_url="http://localhost:7880",
            collective="my-collective",
            username="myuser",
            password="mypass",
        )
        assert client.collective == "my-collective"
        assert client.username == "myuser"
        assert client.password == "mypass"


class TestDocspellClientAuth:
    """Tests for authentication."""

    async def test_get_token_authenticates(self, client):
        """Test that _get_token makes auth request."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"token": "test-token-123"}

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            token = await client._get_token()

            assert token == "test-token-123"
            mock_client.post.assert_called_once()
            call_args = mock_client.post.call_args
            assert "auth/login" in call_args[0][0]
            assert call_args[1]["json"]["collective"] == "test-collective"
            assert call_args[1]["json"]["account"] == "testuser"
            assert call_args[1]["json"]["password"] == "testpass"

    async def test_get_token_caches(self, client):
        """Test that token is cached."""
        # Set a valid cached token
        client._token = DocspellAuthToken(
            token="cached-token",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            token = await client._get_token()

            # Should return cached token without making request
            assert token == "cached-token"
            mock_client_class.assert_not_called()

    async def test_get_token_refreshes_expired(self, client):
        """Test that expired token is refreshed."""
        # Set an expired cached token
        client._token = DocspellAuthToken(
            token="expired-token",
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"token": "new-token"}

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            token = await client._get_token()

            assert token == "new-token"
            mock_client.post.assert_called_once()

    async def test_get_token_auth_failure(self, client):
        """Test that auth failure raises exception."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            with pytest.raises(Exception, match="authentication failed"):
                await client._get_token()


class TestDocspellClientTestConnection:
    """Tests for test_connection method."""

    async def test_connection_success(self, client):
        """Test successful connection test."""
        auth_response = MagicMock()
        auth_response.status_code = 200
        auth_response.json.return_value = {"token": "test-token"}

        version_response = MagicMock()
        version_response.status_code = 200
        version_response.json.return_value = {"version": "0.42.0"}

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = auth_response
            mock_client.get.return_value = version_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            success, message, version = await client.test_connection()

            assert success is True
            assert version == "0.42.0"

    async def test_connection_failure(self, client):
        """Test failed connection test."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = httpx.TimeoutException("timeout")
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            success, message, version = await client.test_connection()

            assert success is False
            assert version is None


class TestDocspellClientSearch:
    """Tests for search method."""

    async def test_search_returns_documents(self, client):
        """Test search returns documents."""
        # Set cached token to avoid auth
        client._token = DocspellAuthToken(
            token="test-token",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )

        search_response = MagicMock()
        search_response.status_code = 200
        search_response.json.return_value = {
            "count": 2,
            "groups": [
                {
                    "items": [
                        {
                            "id": "item-1",
                            "name": "Document 1",
                            "itemDate": "2024-01-15",
                            "tags": [{"name": "invoice"}],
                        },
                        {
                            "id": "item-2",
                            "name": "Document 2",
                            "corrOrg": {"name": "ACME Corp"},
                            "tags": [],
                        },
                    ]
                }
            ],
        }
        search_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = search_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await client.search("invoice", limit=20, offset=0)

            assert result.total == 2
            assert len(result.items) == 2
            assert result.items[0].id == "item-1"
            assert result.items[0].name == "Document 1"
            assert result.items[0].tags == ["invoice"]
            assert result.items[1].correspondent == "ACME Corp"


class TestDocspellClientGetTags:
    """Tests for get_tags method."""

    async def test_get_tags_returns_list(self, client):
        """Test get_tags returns tag list."""
        client._token = DocspellAuthToken(
            token="test-token",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )

        tags_response = MagicMock()
        tags_response.status_code = 200
        tags_response.json.return_value = {
            "items": [
                {"id": "tag-1", "name": "invoice", "category": "document-type"},
                {"id": "tag-2", "name": "warranty"},
            ]
        }
        tags_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = tags_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await client.get_tags()

            assert len(result) == 2
            assert result[0].name == "invoice"
            assert result[0].category == "document-type"
            assert result[1].name == "warranty"
            assert result[1].category is None


class TestDocspellClientGetItem:
    """Tests for get_item method."""

    async def test_get_item_found(self, client):
        """Test getting an existing item."""
        client._token = DocspellAuthToken(
            token="test-token",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )

        item_response = MagicMock()
        item_response.status_code = 200
        item_response.json.return_value = {
            "id": "item-123",
            "name": "My Document",
            "itemDate": "2024-01-20",
            "tags": [{"name": "receipt"}],
        }
        item_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = item_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await client.get_item("item-123")

            assert result is not None
            assert result.id == "item-123"
            assert result.name == "My Document"
            assert result.tags == ["receipt"]

    async def test_get_item_not_found(self, client):
        """Test getting a non-existent item."""
        client._token = DocspellAuthToken(
            token="test-token",
            expires_at=datetime.now(UTC) + timedelta(minutes=5),
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            error_response = MagicMock()
            error_response.status_code = 404
            mock_client.get.side_effect = httpx.HTTPStatusError(
                "Not Found", request=MagicMock(), response=error_response
            )
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client

            result = await client.get_item("non-existent")

            assert result is None
