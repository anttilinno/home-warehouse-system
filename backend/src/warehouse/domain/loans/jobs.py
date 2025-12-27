"""Loan job handlers for RQ."""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from warehouse.domain.loans.models import Borrower, Loan
from warehouse.domain.loans.repository import LoanRepository
from warehouse.domain.loans.schemas import LoanCreate
from warehouse.domain.loans.service import LoanService

logger = logging.getLogger(__name__)


async def create_loan_job(loan_data: dict[str, Any]) -> str:
    """
    RQ job function to create a loan asynchronously.

    Args:
        loan_data: Serialized loan creation data (includes workspace_id)

    Returns:
        Loan ID on success

    Raises:
        Exception: If loan creation fails
    """
    try:
        logger.info("Starting loan creation job", extra={"loan_data": loan_data})

        # Extract workspace_id from job data
        workspace_id = UUID(loan_data.pop("workspace_id"))

        # Parse loan data
        loan_create = LoanCreate(**loan_data)

        # Create database session
        from warehouse.config import Config
        from sqlalchemy.ext.asyncio import create_async_engine

        config = Config.from_env()
        engine = create_async_engine(config.database_url)

        # Create session factory and session
        session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with session_factory() as session:
            # Create loan service
            repository = LoanRepository(session=session)
            service = LoanService(repository=repository)

            # Create the loan with workspace_id
            loan = await service.create_loan(loan_create, workspace_id)

            logger.info(
                "Loan created successfully",
                extra={"loan_id": str(loan.id), "inventory_id": str(loan.inventory_id), "borrower_id": str(loan.borrower_id)}
            )

            return str(loan.id)

    except Exception as exc:
        logger.error(
            "Failed to create loan",
            extra={"loan_data": loan_data, "error": str(exc)},
            exc_info=True
        )
        raise


async def check_loan_reminders_job(reminder_days: int = 3) -> dict[str, int]:
    """
    RQ job function to check for overdue and due-soon loans and send email reminders.

    This job should be scheduled to run daily (e.g., via cron or RQ scheduler).

    Args:
        reminder_days: Number of days before due date to send reminder (default: 3)

    Returns:
        Dictionary with counts of emails sent for overdue and due-soon loans
    """
    from sqlalchemy.ext.asyncio import create_async_engine

    from warehouse.config import Config
    from warehouse.domain.email.service import EmailService
    from warehouse.domain.inventory.models import Inventory
    from warehouse.domain.items.models import Item

    logger.info("Starting loan reminders check job")

    try:
        config = Config.from_env()
        email_service = EmailService(config)

        # Skip if email is not configured
        if not email_service.enabled:
            logger.warning("Email not configured, skipping loan reminders")
            return {"overdue_sent": 0, "due_soon_sent": 0}

        engine = create_async_engine(config.database_url)
        session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        today = date.today()
        reminder_date = today + timedelta(days=reminder_days)

        overdue_sent = 0
        due_soon_sent = 0

        async with session_factory() as session:
            # Find all active loans (not returned) with a due date
            stmt = (
                select(Loan, Borrower, Inventory, Item)
                .join(Borrower, Loan.borrower_id == Borrower.id)
                .join(Inventory, Loan.inventory_id == Inventory.id)
                .join(Item, Inventory.item_id == Item.id)
                .where(Loan.returned_at.is_(None))
                .where(Loan.due_date.isnot(None))
                .where(Loan.due_date <= reminder_date)  # Due soon or overdue
            )

            result = await session.execute(stmt)
            rows = result.all()

            for loan, borrower, inventory, item in rows:
                if not borrower.email:
                    logger.debug(
                        f"Borrower {borrower.name} has no email, skipping reminder"
                    )
                    continue

                is_overdue = loan.due_date < today
                due_date_str = loan.due_date.strftime("%Y-%m-%d")

                logger.info(
                    f"Sending {'overdue' if is_overdue else 'due soon'} reminder to {borrower.email} "
                    f"for item {item.name}, due {due_date_str}"
                )

                success = await email_service.send_loan_reminder(
                    to=borrower.email,
                    borrower_name=borrower.name,
                    item_name=item.name,
                    due_date=due_date_str,
                    is_overdue=is_overdue,
                )

                if success:
                    if is_overdue:
                        overdue_sent += 1
                    else:
                        due_soon_sent += 1

        logger.info(
            f"Loan reminders check completed. Overdue: {overdue_sent}, Due soon: {due_soon_sent}"
        )
        return {"overdue_sent": overdue_sent, "due_soon_sent": due_soon_sent}

    except Exception as exc:
        logger.error(
            "Failed to check loan reminders",
            extra={"error": str(exc)},
            exc_info=True,
        )
        raise