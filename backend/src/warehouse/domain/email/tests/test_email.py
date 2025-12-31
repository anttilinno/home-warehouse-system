"""Tests for the email domain service."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from conftest import (
    MOCK_HTTPX_ASYNC_CLIENT,
    TEST_EMAIL_USER,
    TEST_ITEM_POWER_DRILL,
    TEST_USER_JOHN_DOE,
    TEST_WORKSPACE_HOME,
)
from warehouse.config import Config
from warehouse.domain.email.service import EmailService

# Test constants
_TEST_EMAIL = "test@example.com"
_TEST_SUBJECT = "Test Subject"
_TEST_HTML = "<p>Test</p>"
_RESET_URL = "https://app.example.com/reset?token=abc123"
_BORROWER_EMAIL = "borrower@example.com"
_INVITEE_EMAIL = "invitee@example.com"


@pytest.fixture
def config_with_api_key():
    """Config with Resend API key configured."""
    config = MagicMock(spec=Config)
    config.resend_api_key = "test-api-key"
    config.email_from_address = "noreply@example.com"
    config.app_url = "https://app.example.com"
    return config


@pytest.fixture
def config_without_api_key():
    """Config without Resend API key."""
    config = MagicMock(spec=Config)
    config.resend_api_key = None
    config.email_from_address = "noreply@example.com"
    config.app_url = "https://app.example.com"
    return config


@pytest.fixture
def service_with_api_key(config_with_api_key):
    """Email service with API key configured."""
    return EmailService(config=config_with_api_key)


@pytest.fixture
def service_without_api_key(config_without_api_key):
    """Email service without API key."""
    return EmailService(config=config_without_api_key)


class TestEmailServiceInit:
    """Tests for EmailService initialization."""

    def test_enabled_when_api_key_present(self, service_with_api_key):
        """Test that service is enabled when API key is present."""
        assert service_with_api_key.enabled is True

    def test_disabled_when_api_key_missing(self, service_without_api_key):
        """Test that service is disabled when API key is missing."""
        assert service_without_api_key.enabled is False


class TestSendEmail:
    """Tests for send_email method."""

    @pytest.mark.asyncio
    async def test_returns_false_when_disabled(self, service_without_api_key):
        """Test that send_email returns False when service is disabled."""
        result = await service_without_api_key.send_email(
            to=_TEST_EMAIL,
            subject=_TEST_SUBJECT,
            html=_TEST_HTML,
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_successful_email_send(self, service_with_api_key):
        """Test successful email send via Resend API."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "email-123"}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await service_with_api_key.send_email(
                to=_TEST_EMAIL,
                subject=_TEST_SUBJECT,
                html=_TEST_HTML,
                text="Test",
            )

        assert result is True
        mock_client.post.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_failed_email_send(self, service_with_api_key):
        """Test failed email send returns False."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad Request"

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await service_with_api_key.send_email(
                to=_TEST_EMAIL,
                subject=_TEST_SUBJECT,
                html=_TEST_HTML,
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_timeout_returns_false(self, service_with_api_key):
        """Test that timeout exception returns False."""
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await service_with_api_key.send_email(
                to=_TEST_EMAIL,
                subject=_TEST_SUBJECT,
                html=_TEST_HTML,
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_generic_exception_returns_false(self, service_with_api_key):
        """Test that generic exceptions return False."""
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=Exception("Connection error"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await service_with_api_key.send_email(
                to=_TEST_EMAIL,
                subject=_TEST_SUBJECT,
                html=_TEST_HTML,
            )

        assert result is False


class TestSendPasswordReset:
    """Tests for send_password_reset method."""

    @pytest.mark.asyncio
    async def test_sends_password_reset_english(self, service_with_api_key):
        """Test password reset email in English."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            result = await service_with_api_key.send_password_reset(
                to=TEST_EMAIL_USER,
                reset_url=_RESET_URL,
                language="en",
            )

            assert result is True
            mock_send.assert_awaited_once()
            call_args = mock_send.call_args
            assert call_args.kwargs["to"] == TEST_EMAIL_USER
            assert "Reset your password" in call_args.kwargs["subject"]

    @pytest.mark.asyncio
    async def test_sends_password_reset_estonian(self, service_with_api_key):
        """Test password reset email in Estonian."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            result = await service_with_api_key.send_password_reset(
                to=TEST_EMAIL_USER,
                reset_url=_RESET_URL,
                language="et",
            )

            assert result is True
            call_args = mock_send.call_args
            assert "Lähtesta oma parool" in call_args.kwargs["subject"]

    @pytest.mark.asyncio
    async def test_sends_password_reset_russian(self, service_with_api_key):
        """Test password reset email in Russian."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            result = await service_with_api_key.send_password_reset(
                to=TEST_EMAIL_USER,
                reset_url=_RESET_URL,
                language="ru",
            )

            assert result is True
            call_args = mock_send.call_args
            assert "Сбросить пароль" in call_args.kwargs["subject"]

    @pytest.mark.asyncio
    async def test_falls_back_to_english(self, service_with_api_key):
        """Test that unknown language falls back to English."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            result = await service_with_api_key.send_password_reset(
                to=TEST_EMAIL_USER,
                reset_url=_RESET_URL,
                language="fr",  # Not supported, should fall back to English
            )

            assert result is True
            call_args = mock_send.call_args
            assert "Reset your password" in call_args.kwargs["subject"]


class TestSendLoanReminder:
    """Tests for send_loan_reminder method."""

    @pytest.mark.asyncio
    async def test_sends_overdue_reminder(self, service_with_api_key):
        """Test overdue loan reminder email."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            result = await service_with_api_key.send_loan_reminder(
                to=_BORROWER_EMAIL,
                borrower_name=TEST_USER_JOHN_DOE,
                item_name=TEST_ITEM_POWER_DRILL,
                due_date="2024-01-15",
                is_overdue=True,
                language="en",
            )

            assert result is True
            call_args = mock_send.call_args
            assert "Loan Overdue" in call_args.kwargs["subject"]
            assert TEST_ITEM_POWER_DRILL in call_args.kwargs["subject"]

    @pytest.mark.asyncio
    async def test_sends_due_soon_reminder(self, service_with_api_key):
        """Test due soon loan reminder email."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            result = await service_with_api_key.send_loan_reminder(
                to=_BORROWER_EMAIL,
                borrower_name="Jane Doe",
                item_name="Hammer",
                due_date="2024-01-20",
                is_overdue=False,
                language="en",
            )

            assert result is True
            call_args = mock_send.call_args
            assert "Loan Due Soon" in call_args.kwargs["subject"]

    @pytest.mark.asyncio
    async def test_loan_reminder_estonian(self, service_with_api_key):
        """Test loan reminder in Estonian."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            await service_with_api_key.send_loan_reminder(
                to=_BORROWER_EMAIL,
                borrower_name=TEST_USER_JOHN_DOE,
                item_name=TEST_ITEM_POWER_DRILL,
                due_date="2024-01-15",
                is_overdue=True,
                language="et",
            )

            call_args = mock_send.call_args
            assert "hilinenud" in call_args.kwargs["subject"]


class TestSendWorkspaceInvite:
    """Tests for send_workspace_invite method."""

    @pytest.mark.asyncio
    async def test_sends_workspace_invite(self, service_with_api_key):
        """Test workspace invitation email."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            result = await service_with_api_key.send_workspace_invite(
                to=_INVITEE_EMAIL,
                inviter_name=TEST_USER_JOHN_DOE,
                workspace_name=TEST_WORKSPACE_HOME,
                role="member",
                language="en",
            )

            assert result is True
            call_args = mock_send.call_args
            assert "invited" in call_args.kwargs["subject"]
            assert TEST_WORKSPACE_HOME in call_args.kwargs["subject"]

    @pytest.mark.asyncio
    async def test_workspace_invite_estonian(self, service_with_api_key):
        """Test workspace invitation in Estonian."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            await service_with_api_key.send_workspace_invite(
                to=_INVITEE_EMAIL,
                inviter_name=TEST_USER_JOHN_DOE,
                workspace_name=TEST_WORKSPACE_HOME,
                role="member",
                language="et",
            )

            call_args = mock_send.call_args
            assert "kutsuti" in call_args.kwargs["subject"]

    @pytest.mark.asyncio
    async def test_workspace_invite_russian(self, service_with_api_key):
        """Test workspace invitation in Russian."""
        with patch.object(
            service_with_api_key, "send_email", new_callable=AsyncMock
        ) as mock_send:
            mock_send.return_value = True

            await service_with_api_key.send_workspace_invite(
                to=_INVITEE_EMAIL,
                inviter_name=TEST_USER_JOHN_DOE,
                workspace_name=TEST_WORKSPACE_HOME,
                role="member",
                language="ru",
            )

            call_args = mock_send.call_args
            assert "пригласили" in call_args.kwargs["subject"]
