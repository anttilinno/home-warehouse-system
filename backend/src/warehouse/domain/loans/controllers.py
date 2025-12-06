"""Loans domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.exceptions import NotFoundException
from litestar.status_codes import HTTP_201_CREATED

from warehouse.domain.loans.repository import BorrowerRepository, LoanRepository
from warehouse.domain.loans.schemas import (
    BorrowerCreate,
    BorrowerResponse,
    BorrowerUpdate,
    LoanCreate,
    LoanResponse,
    LoanReturn,
)
from warehouse.domain.loans.service import BorrowerService, LoanService


def get_borrower_service(repository: BorrowerRepository) -> BorrowerService:
    """Dependency for borrower service."""
    return BorrowerService(repository)


def get_loan_service(repository: LoanRepository) -> LoanService:
    """Dependency for loan service."""
    return LoanService(repository)


class BorrowerController(Controller):
    """Borrower controller."""

    path = "/borrowers"
    dependencies = {"borrower_service": Provide(get_borrower_service)}

    @post("/", status_code=HTTP_201_CREATED)
    async def create_borrower(
        self, data: BorrowerCreate, borrower_service: BorrowerService
    ) -> BorrowerResponse:
        """Create a new borrower."""
        borrower = await borrower_service.create_borrower(data)
        return BorrowerResponse(
            id=borrower.id,
            name=borrower.name,
            email=borrower.email,
            phone=borrower.phone,
            notes=borrower.notes,
            created_at=borrower.created_at,
        )

    @get("/")
    async def list_borrowers(
        self, borrower_service: BorrowerService
    ) -> list[BorrowerResponse]:
        """List all borrowers."""
        borrowers = await borrower_service.get_all_borrowers()
        return [
            BorrowerResponse(
                id=b.id,
                name=b.name,
                email=b.email,
                phone=b.phone,
                notes=b.notes,
                created_at=b.created_at,
            )
            for b in borrowers
        ]

    @get("/{borrower_id:uuid}")
    async def get_borrower(
        self, borrower_id: UUID, borrower_service: BorrowerService
    ) -> BorrowerResponse:
        """Get borrower by ID."""
        borrower = await borrower_service.get_borrower(borrower_id)
        if not borrower:
            raise NotFoundException("Borrower not found")
        return BorrowerResponse(
            id=borrower.id,
            name=borrower.name,
            email=borrower.email,
            phone=borrower.phone,
            notes=borrower.notes,
            created_at=borrower.created_at,
        )

    @patch("/{borrower_id:uuid}")
    async def update_borrower(
        self, borrower_id: UUID, data: BorrowerUpdate, borrower_service: BorrowerService
    ) -> BorrowerResponse:
        """Update a borrower."""
        borrower = await borrower_service.update_borrower(borrower_id, data)
        if not borrower:
            raise NotFoundException("Borrower not found")
        return BorrowerResponse(
            id=borrower.id,
            name=borrower.name,
            email=borrower.email,
            phone=borrower.phone,
            notes=borrower.notes,
            created_at=borrower.created_at,
        )

    @delete("/{borrower_id:uuid}")
    async def delete_borrower(
        self, borrower_id: UUID, borrower_service: BorrowerService
    ) -> None:
        """Delete a borrower."""
        deleted = await borrower_service.delete_borrower(borrower_id)
        if not deleted:
            raise NotFoundException("Borrower not found")


class LoanController(Controller):
    """Loan controller."""

    path = "/loans"
    dependencies = {"loan_service": Provide(get_loan_service)}

    @post("/", status_code=HTTP_201_CREATED)
    async def create_loan(
        self, data: LoanCreate, loan_service: LoanService
    ) -> LoanResponse:
        """Create a new loan."""
        loan = await loan_service.create_loan(data)
        return LoanResponse(
            id=loan.id,
            item_id=loan.item_id,
            borrower_id=loan.borrower_id,
            quantity=loan.quantity,
            loaned_at=loan.loaned_at,
            due_date=loan.due_date,
            returned_at=loan.returned_at,
            notes=loan.notes,
            created_at=loan.created_at,
            updated_at=loan.updated_at,
        )

    @get("/")
    async def list_loans(self, loan_service: LoanService) -> list[LoanResponse]:
        """List all loans."""
        loans = await loan_service.get_all_loans()
        return [
            LoanResponse(
                id=l.id,
                item_id=l.item_id,
                borrower_id=l.borrower_id,
                quantity=l.quantity,
                loaned_at=l.loaned_at,
                due_date=l.due_date,
                returned_at=l.returned_at,
                notes=l.notes,
                created_at=l.created_at,
                updated_at=l.updated_at,
            )
            for l in loans
        ]

    @get("/active")
    async def list_active_loans(
        self, loan_service: LoanService
    ) -> list[LoanResponse]:
        """List all active loans."""
        loans = await loan_service.get_active_loans()
        return [
            LoanResponse(
                id=l.id,
                item_id=l.item_id,
                borrower_id=l.borrower_id,
                quantity=l.quantity,
                loaned_at=l.loaned_at,
                due_date=l.due_date,
                returned_at=l.returned_at,
                notes=l.notes,
                created_at=l.created_at,
                updated_at=l.updated_at,
            )
            for l in loans
        ]

    @get("/{loan_id:uuid}")
    async def get_loan(
        self, loan_id: UUID, loan_service: LoanService
    ) -> LoanResponse:
        """Get loan by ID."""
        loan = await loan_service.get_loan(loan_id)
        if not loan:
            raise NotFoundException("Loan not found")
        return LoanResponse(
            id=loan.id,
            item_id=loan.item_id,
            borrower_id=loan.borrower_id,
            quantity=loan.quantity,
            loaned_at=loan.loaned_at,
            due_date=loan.due_date,
            returned_at=loan.returned_at,
            notes=loan.notes,
            created_at=loan.created_at,
            updated_at=loan.updated_at,
        )

    @patch("/{loan_id:uuid}/return")
    async def return_loan(
        self, loan_id: UUID, data: LoanReturn, loan_service: LoanService
    ) -> LoanResponse:
        """Return a loan."""
        loan = await loan_service.return_loan(loan_id, data)
        if not loan:
            raise NotFoundException("Loan not found")
        return LoanResponse(
            id=loan.id,
            item_id=loan.item_id,
            borrower_id=loan.borrower_id,
            quantity=loan.quantity,
            loaned_at=loan.loaned_at,
            due_date=loan.due_date,
            returned_at=loan.returned_at,
            notes=loan.notes,
            created_at=loan.created_at,
            updated_at=loan.updated_at,
        )

