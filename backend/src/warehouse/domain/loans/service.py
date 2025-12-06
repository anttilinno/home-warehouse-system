"""Loans domain service."""

from datetime import date, datetime
from uuid import UUID

from warehouse.domain.loans.models import Borrower, Loan
from warehouse.domain.loans.repository import BorrowerRepository, LoanRepository
from warehouse.domain.loans.schemas import BorrowerCreate, BorrowerUpdate, LoanCreate, LoanReturn


class BorrowerService:
    """Borrower service."""

    def __init__(self, repository: BorrowerRepository):
        """Initialize borrower service."""
        self.repository = repository

    async def create_borrower(self, borrower_data: BorrowerCreate) -> Borrower:
        """Create a new borrower."""
        borrower = Borrower(
            name=borrower_data.name,
            email=borrower_data.email,
            phone=borrower_data.phone,
            notes=borrower_data.notes,
        )
        return await self.repository.add(borrower)

    async def get_all_borrowers(self) -> list[Borrower]:
        """Get all borrowers."""
        return await self.repository.list()

    async def get_borrower(self, borrower_id: UUID) -> Borrower | None:
        """Get borrower by ID."""
        return await self.repository.get_by_id(borrower_id)

    async def update_borrower(
        self, borrower_id: UUID, borrower_data: BorrowerUpdate
    ) -> Borrower | None:
        """Update a borrower."""
        borrower = await self.repository.get_by_id(borrower_id)
        if not borrower:
            return None

        if borrower_data.name is not None:
            borrower.name = borrower_data.name
        if borrower_data.email is not None:
            borrower.email = borrower_data.email
        if borrower_data.phone is not None:
            borrower.phone = borrower_data.phone
        if borrower_data.notes is not None:
            borrower.notes = borrower_data.notes

        return await self.repository.update(borrower)

    async def delete_borrower(self, borrower_id: UUID) -> bool:
        """Delete a borrower."""
        borrower = await self.repository.get_by_id(borrower_id)
        if not borrower:
            return False

        await self.repository.delete(borrower)
        return True


class LoanService:
    """Loan service."""

    def __init__(self, repository: LoanRepository):
        """Initialize loan service."""
        self.repository = repository

    async def create_loan(self, loan_data: LoanCreate) -> Loan:
        """Create a new loan."""
        loan = Loan(
            item_id=loan_data.item_id,
            borrower_id=loan_data.borrower_id,
            quantity=loan_data.quantity,
            due_date=loan_data.due_date,
            notes=loan_data.notes,
        )
        return await self.repository.add(loan)

    async def get_all_loans(self) -> list[Loan]:
        """Get all loans."""
        return await self.repository.list()

    async def get_loan(self, loan_id: UUID) -> Loan | None:
        """Get loan by ID."""
        return await self.repository.get_by_id(loan_id)

    async def get_active_loans(self) -> list[Loan]:
        """Get all active (non-returned) loans."""
        # TODO: Implement filtering for active loans
        all_loans = await self.repository.list()
        return [loan for loan in all_loans if loan.returned_at is None]

    async def return_loan(self, loan_id: UUID, return_data: LoanReturn) -> Loan | None:
        """Return a loan."""
        loan = await self.repository.get_by_id(loan_id)
        if not loan:
            return None

        if loan.returned_at is not None:
            raise ValueError("Loan already returned")

        loan.returned_at = datetime.utcnow()
        if return_data.notes is not None:
            loan.notes = return_data.notes

        return await self.repository.update(loan)

