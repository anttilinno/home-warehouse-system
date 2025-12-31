"""Tests for email templates."""

import pytest

from conftest import (
    TEST_ITEM_POWER_DRILL,
    TEST_USER_JOHN_DOE,
    TEST_WORKSPACE_HOME,
)
from warehouse.domain.email.templates import (
    TRANSLATIONS,
    get_translations,
    loan_reminder_template,
    password_reset_template,
    workspace_invite_template,
)

# Test constants
_EXAMPLE_URL = "https://example.com"
_APP_URL = "https://app.example.com"
_RESET_URL = f"{_APP_URL}/reset?token=abc123"


class TestGetTranslations:
    """Tests for get_translations helper."""

    def test_returns_english_translations(self):
        """Test that English translations are returned."""
        result = get_translations("en", "password_reset")
        assert result["title"] == "Reset Your Password"
        assert result["button"] == "Reset Password"

    def test_returns_estonian_translations(self):
        """Test that Estonian translations are returned."""
        result = get_translations("et", "password_reset")
        assert result["title"] == "Lähtesta oma parool"
        assert result["button"] == "Lähtesta parool"

    def test_returns_russian_translations(self):
        """Test that Russian translations are returned."""
        result = get_translations("ru", "password_reset")
        assert result["title"] == "Сбросить пароль"
        assert result["button"] == "Сбросить пароль"

    def test_falls_back_to_english_for_unknown_language(self):
        """Test that unknown languages fall back to English."""
        result = get_translations("fr", "password_reset")
        assert result["title"] == "Reset Your Password"

    def test_all_template_types_exist(self):
        """Test that all template types exist in translations."""
        for lang in ["en", "et", "ru"]:
            assert "password_reset" in TRANSLATIONS[lang]
            assert "loan_reminder" in TRANSLATIONS[lang]
            assert "workspace_invite" in TRANSLATIONS[lang]


class TestPasswordResetTemplate:
    """Tests for password_reset_template function."""

    def test_contains_reset_url(self):
        """Test that template contains the reset URL."""
        html = password_reset_template(_RESET_URL, "en")
        assert _RESET_URL in html

    def test_contains_english_content(self):
        """Test that English template contains correct content."""
        html = password_reset_template(_EXAMPLE_URL, "en")
        assert "Reset Your Password" in html
        assert "Reset Password" in html
        assert "1 hour" in html

    def test_contains_estonian_content(self):
        """Test that Estonian template contains correct content."""
        html = password_reset_template(_EXAMPLE_URL, "et")
        assert "Lähtesta oma parool" in html
        assert "Lähtesta parool" in html

    def test_contains_russian_content(self):
        """Test that Russian template contains correct content."""
        html = password_reset_template(_EXAMPLE_URL, "ru")
        assert "Сбросить пароль" in html

    def test_is_valid_html(self):
        """Test that template is valid HTML structure."""
        html = password_reset_template(_EXAMPLE_URL, "en")
        assert html.startswith("\n<!DOCTYPE html>")
        assert "<html>" in html
        assert "</html>" in html
        assert "<body" in html
        assert "</body>" in html


class TestLoanReminderTemplate:
    """Tests for loan_reminder_template function."""

    def test_contains_borrower_name(self):
        """Test that template contains borrower name."""
        html = loan_reminder_template(
            borrower_name=TEST_USER_JOHN_DOE,
            item_name=TEST_ITEM_POWER_DRILL,
            due_date="2024-01-15",
            is_overdue=False,
            language="en",
        )
        assert TEST_USER_JOHN_DOE in html

    def test_contains_item_name(self):
        """Test that template contains item name."""
        html = loan_reminder_template(
            borrower_name=TEST_USER_JOHN_DOE,
            item_name=TEST_ITEM_POWER_DRILL,
            due_date="2024-01-15",
            is_overdue=False,
            language="en",
        )
        assert TEST_ITEM_POWER_DRILL in html

    def test_contains_due_date(self):
        """Test that template contains due date."""
        html = loan_reminder_template(
            borrower_name=TEST_USER_JOHN_DOE,
            item_name=TEST_ITEM_POWER_DRILL,
            due_date="2024-01-15",
            is_overdue=False,
            language="en",
        )
        assert "2024-01-15" in html

    def test_shows_overdue_status(self):
        """Test that template shows overdue status."""
        html = loan_reminder_template(
            borrower_name=TEST_USER_JOHN_DOE,
            item_name=TEST_ITEM_POWER_DRILL,
            due_date="2024-01-15",
            is_overdue=True,
            language="en",
        )
        assert "is overdue" in html
        # Check for red color indicating overdue
        assert "#dc2626" in html

    def test_shows_due_soon_status(self):
        """Test that template shows due soon status."""
        html = loan_reminder_template(
            borrower_name=TEST_USER_JOHN_DOE,
            item_name=TEST_ITEM_POWER_DRILL,
            due_date="2024-01-20",
            is_overdue=False,
            language="en",
        )
        assert "is due soon" in html
        # Check for amber/warning color
        assert "#f59e0b" in html

    def test_estonian_overdue(self):
        """Test Estonian overdue text."""
        html = loan_reminder_template(
            borrower_name=TEST_USER_JOHN_DOE,
            item_name=TEST_ITEM_POWER_DRILL,
            due_date="2024-01-15",
            is_overdue=True,
            language="et",
        )
        assert "on hilinenud" in html

    def test_russian_overdue(self):
        """Test Russian overdue text."""
        html = loan_reminder_template(
            borrower_name=TEST_USER_JOHN_DOE,
            item_name=TEST_ITEM_POWER_DRILL,
            due_date="2024-01-15",
            is_overdue=True,
            language="ru",
        )
        assert "просрочен" in html


class TestWorkspaceInviteTemplate:
    """Tests for workspace_invite_template function."""

    def test_contains_inviter_name(self):
        """Test that template contains inviter name."""
        html = workspace_invite_template(
            inviter_name=TEST_USER_JOHN_DOE,
            workspace_name=TEST_WORKSPACE_HOME,
            role="member",
            app_url=_APP_URL,
            language="en",
        )
        assert TEST_USER_JOHN_DOE in html

    def test_contains_workspace_name(self):
        """Test that template contains workspace name."""
        html = workspace_invite_template(
            inviter_name=TEST_USER_JOHN_DOE,
            workspace_name=TEST_WORKSPACE_HOME,
            role="member",
            app_url=_APP_URL,
            language="en",
        )
        assert TEST_WORKSPACE_HOME in html

    def test_contains_role(self):
        """Test that template contains role."""
        html = workspace_invite_template(
            inviter_name=TEST_USER_JOHN_DOE,
            workspace_name=TEST_WORKSPACE_HOME,
            role="admin",
            app_url=_APP_URL,
            language="en",
        )
        assert "admin" in html

    def test_contains_dashboard_link(self):
        """Test that template contains dashboard link."""
        html = workspace_invite_template(
            inviter_name=TEST_USER_JOHN_DOE,
            workspace_name=TEST_WORKSPACE_HOME,
            role="member",
            app_url=_APP_URL,
            language="en",
        )
        assert f"{_APP_URL}/dashboard" in html

    def test_estonian_content(self):
        """Test Estonian invitation content."""
        html = workspace_invite_template(
            inviter_name=TEST_USER_JOHN_DOE,
            workspace_name=TEST_WORKSPACE_HOME,
            role="member",
            app_url=_APP_URL,
            language="et",
        )
        assert "Sind on kutsutud!" in html
        assert "kutsus sind" in html

    def test_russian_content(self):
        """Test Russian invitation content."""
        html = workspace_invite_template(
            inviter_name=TEST_USER_JOHN_DOE,
            workspace_name=TEST_WORKSPACE_HOME,
            role="member",
            app_url=_APP_URL,
            language="ru",
        )
        assert "Вас пригласили!" in html


class TestTranslationsCompleteness:
    """Tests to verify all translations are complete."""

    def test_password_reset_translations_complete(self):
        """Test that all password reset translations have all keys."""
        required_keys = ["title", "intro", "expires", "button", "ignore"]
        for lang in ["en", "et", "ru"]:
            for key in required_keys:
                assert key in TRANSLATIONS[lang]["password_reset"], (
                    f"Missing key '{key}' in {lang} password_reset translations"
                )

    def test_loan_reminder_translations_complete(self):
        """Test that all loan reminder translations have all keys."""
        required_keys = [
            "title",
            "greeting",
            "overdue",
            "due_soon",
            "reminder",
            "due_date",
            "return",
        ]
        for lang in ["en", "et", "ru"]:
            for key in required_keys:
                assert key in TRANSLATIONS[lang]["loan_reminder"], (
                    f"Missing key '{key}' in {lang} loan_reminder translations"
                )

    def test_workspace_invite_translations_complete(self):
        """Test that all workspace invite translations have all keys."""
        required_keys = ["title", "invite", "button", "login"]
        for lang in ["en", "et", "ru"]:
            for key in required_keys:
                assert key in TRANSLATIONS[lang]["workspace_invite"], (
                    f"Missing key '{key}' in {lang} workspace_invite translations"
                )
