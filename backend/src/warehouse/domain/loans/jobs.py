"""Loan job handlers for RQ."""

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

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