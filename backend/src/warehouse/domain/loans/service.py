"""Loans domain service."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select

from warehouse.domain.loans.models import Borrower, Loan
from warehouse.domain.loans.repository import BorrowerRepository, LoanRepository
from warehouse.domain.loans.schemas import BorrowerCreate, BorrowerUpdate, LoanCreate, LoanReturn
from warehouse.errors import AppError, ErrorCode


class BorrowerService:
    """Borrower service."""

    def __init__(self, repository: BorrowerRepository):
        """Initialize borrower service."""
        self.repository = repository

    async def create_borrower(
        self, borrower_data: BorrowerCreate, workspace_id: UUID
    ) -> Borrower:
        """Create a new borrower."""
        borrower = Borrower(
            workspace_id=workspace_id,
            name=borrower_data.name,
            email=borrower_data.email,
            phone=borrower_data.phone,
            notes=borrower_data.notes,
        )
        borrower = await self.repository.add(borrower)
        await self.repository.session.commit()
        return borrower

    async def get_all_borrowers(self, workspace_id: UUID) -> list[Borrower]:
        """Get all borrowers for a workspace."""
        return await self.repository.list(workspace_id=workspace_id)

    async def get_borrower(
        self, borrower_id: UUID, workspace_id: UUID
    ) -> Borrower:
        """Get borrower by ID within a workspace."""
        borrower = await self.repository.get_one_or_none(
            id=borrower_id, workspace_id=workspace_id
        )
        if not borrower:
            raise AppError(ErrorCode.BORROWER_NOT_FOUND, status_code=404)
        return borrower

    async def update_borrower(
        self, borrower_id: UUID, borrower_data: BorrowerUpdate, workspace_id: UUID
    ) -> Borrower:
        """Update a borrower."""
        borrower = await self.repository.get_one_or_none(
            id=borrower_id, workspace_id=workspace_id
        )
        if not borrower:
            raise AppError(ErrorCode.BORROWER_NOT_FOUND, status_code=404)

        if borrower_data.name is not None:
            borrower.name = borrower_data.name
        if borrower_data.email is not None:
            borrower.email = borrower_data.email
        if borrower_data.phone is not None:
            borrower.phone = borrower_data.phone
        if borrower_data.notes is not None:
            borrower.notes = borrower_data.notes

        borrower = await self.repository.update(borrower)
        await self.repository.session.commit()
        return borrower

    async def delete_borrower(self, borrower_id: UUID, workspace_id: UUID) -> bool:
        """Delete a borrower."""
        borrower = await self.repository.get_one_or_none(
            id=borrower_id, workspace_id=workspace_id
        )
        if not borrower:
            raise AppError(ErrorCode.BORROWER_NOT_FOUND, status_code=404)

        # Prevent FK violations: refuse delete when loans exist.
        existing_loan = await self.repository.session.execute(
            select(Loan.id).where(Loan.borrower_id == borrower_id).limit(1)
        )
        if existing_loan.scalar_one_or_none():
            raise AppError(ErrorCode.BORROWER_HAS_LOANS, status_code=400)

        await self.repository.session.delete(borrower)
        await self.repository.session.commit()
        return True


class LoanService:
    """Loan service."""

    def __init__(self, repository: LoanRepository):
        """Initialize loan service."""
        self.repository = repository

    async def create_loan(self, loan_data: LoanCreate, workspace_id: UUID) -> Loan:
        """Create a new loan."""
        loan = Loan(
            workspace_id=workspace_id,
            inventory_id=loan_data.inventory_id,
            borrower_id=loan_data.borrower_id,
            quantity=loan_data.quantity,
            due_date=loan_data.due_date,
            notes=loan_data.notes,
        )
        loan = await self.repository.add(loan)
        await self.repository.session.commit()
        return loan

    async def get_all_loans(self, workspace_id: UUID) -> list[Loan]:
        """Get all loans for a workspace."""
        return await self.repository.list(workspace_id=workspace_id)

    async def get_loan(self, loan_id: UUID, workspace_id: UUID) -> Loan:
        """Get loan by ID within a workspace."""
        loan = await self.repository.get_one_or_none(
            id=loan_id, workspace_id=workspace_id
        )
        if not loan:
            raise AppError(ErrorCode.LOAN_NOT_FOUND, status_code=404)
        return loan

    async def get_active_loans(self, workspace_id: UUID) -> list[Loan]:
        """Get all active (non-returned) loans for a workspace."""
        all_loans = await self.repository.list(workspace_id=workspace_id)
        return [loan for loan in all_loans if loan.returned_at is None]

    async def return_loan(
        self, loan_id: UUID, return_data: LoanReturn, workspace_id: UUID
    ) -> Loan:
        """Return a loan."""
        loan = await self.repository.get_one_or_none(
            id=loan_id, workspace_id=workspace_id
        )
        if not loan:
            raise AppError(ErrorCode.LOAN_NOT_FOUND, status_code=404)

        if loan.returned_at is not None:
            raise AppError(ErrorCode.LOAN_ALREADY_RETURNED, status_code=400)

        loan.returned_at = datetime.now(UTC)
        if return_data.notes is not None:
            loan.notes = return_data.notes

        loan = await self.repository.update(loan)
        await self.repository.session.commit()
        return loan

