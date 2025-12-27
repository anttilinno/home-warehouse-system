"""Email service using Resend API."""

import logging

import httpx

from warehouse.config import Config
from warehouse.domain.email.templates import (
    loan_reminder_template,
    password_reset_template,
    workspace_invite_template,
)

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for sending transactional emails via Resend."""

    RESEND_API_URL = "https://api.resend.com/emails"

    def __init__(self, config: Config):
        """Initialize email service.

        Args:
            config: Application configuration with Resend API key
        """
        self.config = config
        self.enabled = bool(config.resend_api_key)

    async def send_email(
        self,
        to: str,
        subject: str,
        html: str,
        text: str | None = None,
    ) -> bool:
        """Send email via Resend API.

        Args:
            to: Recipient email address
            subject: Email subject
            html: HTML content
            text: Optional plain text content

        Returns:
            True if email was sent successfully, False otherwise
        """
        if not self.enabled:
            logger.warning(
                "Email not configured (RESEND_API_KEY not set). "
                f"Would send to {to}: {subject}"
            )
            return False

        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "from": self.config.email_from_address,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                }
                if text:
                    payload["text"] = text

                response = await client.post(
                    self.RESEND_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.config.resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Email sent successfully to {to}: {data.get('id')}")
                    return True
                else:
                    logger.error(
                        f"Failed to send email to {to}: "
                        f"{response.status_code} - {response.text}"
                    )
                    return False

        except httpx.TimeoutException:
            logger.error(f"Timeout sending email to {to}")
            return False
        except Exception as e:
            logger.error(f"Error sending email to {to}: {e}")
            return False

    async def send_password_reset(
        self, to: str, reset_url: str, language: str = "en"
    ) -> bool:
        """Send password reset email.

        Args:
            to: Recipient email address
            reset_url: Password reset URL with token
            language: User's preferred language (en, et, ru)

        Returns:
            True if email was sent successfully
        """
        html = password_reset_template(reset_url, language)
        # Localized subjects
        subjects = {
            "en": "Reset your password - Home Warehouse System",
            "et": "Lähtesta oma parool - Home Warehouse System",
            "ru": "Сбросить пароль - Home Warehouse System",
        }
        subject = subjects.get(language, subjects["en"])
        return await self.send_email(
            to=to,
            subject=subject,
            html=html,
        )

    async def send_loan_reminder(
        self,
        to: str,
        borrower_name: str,
        item_name: str,
        due_date: str,
        is_overdue: bool,
        language: str = "en",
    ) -> bool:
        """Send loan reminder email.

        Args:
            to: Borrower email address
            borrower_name: Name of the borrower
            item_name: Name of the borrowed item
            due_date: Due date string
            is_overdue: Whether the loan is overdue
            language: User's preferred language (en, et, ru)

        Returns:
            True if email was sent successfully
        """
        html = loan_reminder_template(
            borrower_name, item_name, due_date, is_overdue, language
        )
        # Localized subjects
        if is_overdue:
            subjects = {
                "en": f"Loan Overdue: {item_name}",
                "et": f"Laenutus hilinenud: {item_name}",
                "ru": f"Займ просрочен: {item_name}",
            }
        else:
            subjects = {
                "en": f"Loan Due Soon: {item_name}",
                "et": f"Laenutuse tähtaeg läheneb: {item_name}",
                "ru": f"Срок займа истекает: {item_name}",
            }
        subject = subjects.get(language, subjects["en"])
        return await self.send_email(
            to=to,
            subject=subject,
            html=html,
        )

    async def send_workspace_invite(
        self,
        to: str,
        inviter_name: str,
        workspace_name: str,
        role: str,
        language: str = "en",
    ) -> bool:
        """Send workspace invitation email.

        Args:
            to: Invitee email address
            inviter_name: Name of the person who sent the invite
            workspace_name: Name of the workspace
            role: Role the invitee will have
            language: User's preferred language (en, et, ru)

        Returns:
            True if email was sent successfully
        """
        html = workspace_invite_template(
            inviter_name, workspace_name, role, self.config.app_url, language
        )
        # Localized subjects
        subjects = {
            "en": f"You've been invited to {workspace_name} - Home Warehouse System",
            "et": f"Sind kutsuti töörühma {workspace_name} - Home Warehouse System",
            "ru": f"Вас пригласили в {workspace_name} - Home Warehouse System",
        }
        subject = subjects.get(language, subjects["en"])
        return await self.send_email(
            to=to,
            subject=subject,
            html=html,
        )
