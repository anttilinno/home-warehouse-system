"""Loans domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.exceptions import NotFoundException
from litestar.status_codes import HTTP_201_CREATED, HTTP_202_ACCEPTED
from rq import Queue
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.config import Config
from warehouse.domain.loans.jobs import create_loan_job
from warehouse.domain.loans.repository import BorrowerRepository, LoanRepository
from warehouse.domain.loans.schemas import (
    BorrowerCreate,
    BorrowerResponse,
    BorrowerUpdate,
    LoanCreate,
    LoanCreateResponse,
    LoanResponse,
    LoanReturn,
)
from warehouse.domain.loans.service import BorrowerService, LoanService
from warehouse.errors import AppError
from warehouse.lib.rq import get_queue
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context, require_write_permission


def get_borrower_service(db_session: AsyncSession) -> BorrowerService:
    """Dependency for borrower service."""
    repository = BorrowerRepository(session=db_session)
    return BorrowerService(repository)


def get_loan_service(db_session: AsyncSession) -> LoanService:
    """Dependency for loan service."""
    repository = LoanRepository(session=db_session)
    return LoanService(repository)


def get_loan_queue(config: Config) -> Queue:
    """Dependency for loan RQ queue."""
    return get_queue(config, "loans")


class BorrowerController(Controller):
    """Borrower controller."""

    path = "/borrowers"
    dependencies = {
        "borrower_service": Provide(get_borrower_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @post("/", status_code=HTTP_201_CREATED)
    async def create_borrower(
        self,
        data: BorrowerCreate,
        borrower_service: BorrowerService,
        workspace: WorkspaceContext,
    ) -> BorrowerResponse:
        """Create a new borrower."""
        require_write_permission(workspace)
        borrower = await borrower_service.create_borrower(data, workspace.workspace_id)
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
        self,
        borrower_service: BorrowerService,
        workspace: WorkspaceContext,
    ) -> list[BorrowerResponse]:
        """List all borrowers."""
        borrowers = await borrower_service.get_all_borrowers(workspace.workspace_id)
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
        self,
        borrower_id: UUID,
        borrower_service: BorrowerService,
        workspace: WorkspaceContext,
    ) -> BorrowerResponse:
        """Get borrower by ID."""
        try:
            borrower = await borrower_service.get_borrower(
                borrower_id, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()
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
        self,
        borrower_id: UUID,
        data: BorrowerUpdate,
        borrower_service: BorrowerService,
        workspace: WorkspaceContext,
    ) -> BorrowerResponse:
        """Update a borrower."""
        require_write_permission(workspace)
        try:
            borrower = await borrower_service.update_borrower(
                borrower_id, data, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()
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
        self,
        borrower_id: UUID,
        borrower_service: BorrowerService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete a borrower."""
        require_write_permission(workspace)
        try:
            await borrower_service.delete_borrower(borrower_id, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()


class LoanController(Controller):
    """Loan controller."""

    path = "/loans"
    dependencies = {
        "loan_service": Provide(get_loan_service, sync_to_thread=False),
        "loan_queue": Provide(get_loan_queue, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @post("/", status_code=HTTP_202_ACCEPTED)
    async def create_loan(
        self,
        data: LoanCreate,
        loan_queue: Queue,
        workspace: WorkspaceContext,
    ) -> LoanCreateResponse:
        """Create a new loan asynchronously."""
        require_write_permission(workspace)
        import msgspec

        loan_data = msgspec.to_builtins(data)
        # Include workspace_id in job data
        loan_data["workspace_id"] = str(workspace.workspace_id)

        job = loan_queue.enqueue(create_loan_job, loan_data)

        return LoanCreateResponse(
            job_id=job.id,
            status="queued",
        )

    @get("/jobs/{job_id:str}")
    async def get_job_status(
        self, job_id: str, loan_queue: Queue
    ) -> dict[str, str]:
        """Get the status of a loan creation job."""
        job = loan_queue.fetch_job(job_id)

        if not job:
            raise NotFoundException("Job not found")

        status = job.get_status()

        # Handle both JobStatus enum and string status
        status_str = status.value if hasattr(status, 'value') else str(status)
        response: dict[str, str] = {"status": status_str}

        if status == "finished":
            response["loan_id"] = job.result
        elif status == "failed":
            response["error"] = str(job.exc_info) if job.exc_info else "Unknown error"

        return response

    @get("/")
    async def list_loans(
        self,
        loan_service: LoanService,
        workspace: WorkspaceContext,
    ) -> list[LoanResponse]:
        """List all loans."""
        loans = await loan_service.get_all_loans(workspace.workspace_id)
        return [
            LoanResponse(
                id=loan.id,
                inventory_id=loan.inventory_id,
                borrower_id=loan.borrower_id,
                quantity=loan.quantity,
                loaned_at=loan.loaned_at,
                due_date=loan.due_date,
                returned_at=loan.returned_at,
                notes=loan.notes,
                created_at=loan.created_at,
                updated_at=loan.updated_at,
            )
            for loan in loans
        ]

    @get("/active")
    async def list_active_loans(
        self,
        loan_service: LoanService,
        workspace: WorkspaceContext,
    ) -> list[LoanResponse]:
        """List all active loans."""
        loans = await loan_service.get_active_loans(workspace.workspace_id)
        return [
            LoanResponse(
                id=loan.id,
                inventory_id=loan.inventory_id,
                borrower_id=loan.borrower_id,
                quantity=loan.quantity,
                loaned_at=loan.loaned_at,
                due_date=loan.due_date,
                returned_at=loan.returned_at,
                notes=loan.notes,
                created_at=loan.created_at,
                updated_at=loan.updated_at,
            )
            for loan in loans
        ]

    @get("/{loan_id:uuid}")
    async def get_loan(
        self,
        loan_id: UUID,
        loan_service: LoanService,
        workspace: WorkspaceContext,
    ) -> LoanResponse:
        """Get loan by ID."""
        try:
            loan = await loan_service.get_loan(loan_id, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()
        return LoanResponse(
            id=loan.id,
            inventory_id=loan.inventory_id,
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
        self,
        loan_id: UUID,
        data: LoanReturn,
        loan_service: LoanService,
        workspace: WorkspaceContext,
    ) -> LoanResponse:
        """Return a loan."""
        require_write_permission(workspace)
        try:
            loan = await loan_service.return_loan(loan_id, data, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()
        return LoanResponse(
            id=loan.id,
            inventory_id=loan.inventory_id,
            borrower_id=loan.borrower_id,
            quantity=loan.quantity,
            loaned_at=loan.loaned_at,
            due_date=loan.due_date,
            returned_at=loan.returned_at,
            notes=loan.notes,
            created_at=loan.created_at,
            updated_at=loan.updated_at,
        )

