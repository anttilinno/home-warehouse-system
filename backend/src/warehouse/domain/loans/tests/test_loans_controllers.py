"""Controller tests for loans domain."""

import datetime
from types import SimpleNamespace
from uuid import UUID, uuid7
from unittest.mock import AsyncMock, MagicMock

import pytest
from litestar.exceptions import HTTPException, NotFoundException

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.loans.controllers import BorrowerController, LoanController
from warehouse.domain.loans.schemas import BorrowerCreate, BorrowerUpdate, LoanCreate, LoanCreateResponse, LoanReturn
from warehouse.lib.workspace import WorkspaceContext


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def user_id() -> UUID:
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def workspace(workspace_id: UUID, user_id: UUID) -> WorkspaceContext:
    """Workspace context for tests (with member role for write access)."""
    return WorkspaceContext(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=WorkspaceRole.MEMBER,
    )


@pytest.fixture
def borrower_service_mock() -> AsyncMock:
    svc = AsyncMock()
    svc.create_borrower = AsyncMock()
    svc.get_all_borrowers = AsyncMock()
    svc.get_borrower = AsyncMock()
    svc.update_borrower = AsyncMock()
    svc.delete_borrower = AsyncMock()
    return svc


@pytest.fixture
def loan_service_mock() -> AsyncMock:
    svc = AsyncMock()
    svc.create_loan = AsyncMock()
    svc.get_all_loans = AsyncMock()
    svc.get_active_loans = AsyncMock()
    svc.get_loan = AsyncMock()
    svc.return_loan = AsyncMock()
    return svc


@pytest.fixture
def loan_queue_mock():
    """Mock RQ Queue."""
    from unittest.mock import MagicMock
    queue = MagicMock()
    # Mock job with id attribute
    job_mock = MagicMock()
    job_mock.id = "test-job-id-123"
    queue.enqueue.return_value = job_mock
    queue.fetch_job.return_value = None  # Default to job not found
    return queue


@pytest.fixture
def activity_service_mock() -> AsyncMock:
    """Mocked activity log service."""
    svc = AsyncMock()
    svc.log_action = AsyncMock()
    return svc


@pytest.fixture
def borrower_controller() -> BorrowerController:
    return BorrowerController(owner=None)


@pytest.fixture
def loan_controller() -> LoanController:
    return LoanController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke the underlying handler function."""
    return await handler.fn(controller, **kwargs)


def _borrower(**overrides) -> SimpleNamespace:
    defaults = {
        "id": uuid7(),
        "name": "Alice",
        "email": "a@example.com",
        "phone": "123",
        "notes": None,
        "created_at": datetime.datetime(2024, 1, 1, 0, 0, 0),
        "updated_at": datetime.datetime(2024, 1, 1, 0, 0, 0),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _loan(**overrides) -> SimpleNamespace:
    defaults = {
        "id": uuid7(),
        "inventory_id": uuid7(),
        "borrower_id": uuid7(),
        "quantity": 1,
        "loaned_at": datetime.datetime(2024, 1, 2, 0, 0, 0),
        "due_date": None,
        "returned_at": None,
        "notes": None,
        "created_at": datetime.datetime(2024, 1, 2, 0, 0, 0),
        "updated_at": datetime.datetime(2024, 1, 3, 0, 0, 0),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


@pytest.mark.asyncio
async def test_create_borrower(borrower_controller: BorrowerController, borrower_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    borrower = _borrower()
    borrower_service_mock.create_borrower.return_value = borrower
    payload = BorrowerCreate(name="Alice", email=borrower.email, phone="123", notes=None)

    resp = await _call(
        borrower_controller.create_borrower, borrower_controller, data=payload, borrower_service=borrower_service_mock, activity_service=activity_service_mock, workspace=workspace
    )

    borrower_service_mock.create_borrower.assert_awaited_once_with(payload, workspace.workspace_id)
    assert resp.id == borrower.id
    assert resp.name == "Alice"


@pytest.mark.asyncio
async def test_list_borrowers(borrower_controller: BorrowerController, borrower_service_mock: AsyncMock, workspace: WorkspaceContext):
    borrowers = [_borrower(name="A"), _borrower(name="B")]
    borrower_service_mock.get_all_borrowers.return_value = borrowers

    resp = await _call(
        borrower_controller.list_borrowers, borrower_controller, borrower_service=borrower_service_mock, workspace=workspace
    )

    borrower_service_mock.get_all_borrowers.assert_awaited_once_with(workspace.workspace_id)
    assert [b.name for b in resp] == ["A", "B"]


@pytest.mark.asyncio
async def test_get_borrower(borrower_controller: BorrowerController, borrower_service_mock: AsyncMock, workspace: WorkspaceContext):
    borrower = _borrower(name="C")
    borrower_service_mock.get_borrower.return_value = borrower

    resp = await _call(
        borrower_controller.get_borrower, borrower_controller, borrower_id=borrower.id, borrower_service=borrower_service_mock, workspace=workspace
    )

    borrower_service_mock.get_borrower.assert_awaited_once_with(borrower.id, workspace.workspace_id)
    assert resp.name == "C"


@pytest.mark.asyncio
async def test_get_borrower_not_found(borrower_controller: BorrowerController, borrower_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode

    borrower_service_mock.get_borrower.side_effect = AppError(ErrorCode.BORROWER_NOT_FOUND, status_code=404)
    missing_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(
            borrower_controller.get_borrower,
            borrower_controller,
            borrower_id=missing_id,
            borrower_service=borrower_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_update_borrower(borrower_controller: BorrowerController, borrower_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    borrower = _borrower()
    borrower_service_mock.get_borrower.return_value = _borrower(name="Old Name")
    borrower_service_mock.update_borrower.return_value = borrower
    payload = BorrowerUpdate(email="new@example.com")

    resp = await _call(
        borrower_controller.update_borrower,
        borrower_controller,
        borrower_id=borrower.id,
        data=payload,
        borrower_service=borrower_service_mock,
        activity_service=activity_service_mock,
        workspace=workspace,
    )

    borrower_service_mock.update_borrower.assert_awaited_once_with(borrower.id, payload, workspace.workspace_id)
    assert resp.email == "new@example.com" or resp.email == borrower.email


@pytest.mark.asyncio
async def test_update_borrower_not_found(borrower_controller: BorrowerController, borrower_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode

    borrower_service_mock.get_borrower.side_effect = AppError(ErrorCode.BORROWER_NOT_FOUND, status_code=404)
    payload = BorrowerUpdate(name="Missing")
    missing_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(
            borrower_controller.update_borrower,
            borrower_controller,
            borrower_id=missing_id,
            data=payload,
            borrower_service=borrower_service_mock,
            activity_service=activity_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_delete_borrower_success(borrower_controller: BorrowerController, borrower_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    borrower_id = uuid7()
    borrower = _borrower(id=borrower_id)
    borrower_service_mock.get_borrower.return_value = borrower
    borrower_service_mock.delete_borrower.return_value = True

    result = await _call(
        borrower_controller.delete_borrower,
        borrower_controller,
        borrower_id=borrower_id,
        borrower_service=borrower_service_mock,
        activity_service=activity_service_mock,
        workspace=workspace,
    )

    borrower_service_mock.delete_borrower.assert_awaited_once_with(borrower_id, workspace.workspace_id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_borrower_not_found(borrower_controller: BorrowerController, borrower_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode

    borrower_service_mock.get_borrower.side_effect = AppError(ErrorCode.BORROWER_NOT_FOUND, status_code=404)
    borrower_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(
            borrower_controller.delete_borrower,
            borrower_controller,
            borrower_id=borrower_id,
            borrower_service=borrower_service_mock,
            activity_service=activity_service_mock,
            workspace=workspace,
        )


@pytest.mark.asyncio
async def test_create_loan(loan_controller: LoanController, loan_queue_mock, workspace: WorkspaceContext):
    loan = _loan(quantity=2)
    payload = LoanCreate(
        inventory_id=loan.inventory_id, borrower_id=loan.borrower_id, quantity=2, due_date=None, notes=None
    )

    resp = await _call(loan_controller.create_loan, loan_controller, data=payload, loan_queue=loan_queue_mock, workspace=workspace)

    # Verify queue.enqueue was called with correct function and data
    loan_queue_mock.enqueue.assert_called_once()
    args = loan_queue_mock.enqueue.call_args
    assert args[0][0].__name__ == "create_loan_job"  # First arg is the function
    import msgspec
    expected_data = msgspec.to_builtins(payload)
    expected_data["workspace_id"] = str(workspace.workspace_id)
    assert args[0][1] == expected_data  # Second arg is serialized loan data with workspace_id

    # Verify response
    assert isinstance(resp, LoanCreateResponse)
    assert resp.job_id == "test-job-id-123"
    assert resp.status == "queued"


@pytest.mark.asyncio
async def test_get_job_status_not_found(loan_controller: LoanController, loan_queue_mock):
    """Test job status when job is not found."""
    loan_queue_mock.fetch_job.return_value = None

    with pytest.raises(NotFoundException):
        await _call(loan_controller.get_job_status, loan_controller, job_id="nonexistent", loan_queue=loan_queue_mock)


@pytest.mark.asyncio
async def test_get_job_status_queued(loan_controller: LoanController, loan_queue_mock):
    """Test job status when job is queued."""
    job_mock = MagicMock()
    job_mock.get_status.return_value = "queued"
    loan_queue_mock.fetch_job.return_value = job_mock

    resp = await _call(loan_controller.get_job_status, loan_controller, job_id="job-123", loan_queue=loan_queue_mock)

    assert resp["status"] == "queued"
    assert "loan_id" not in resp


@pytest.mark.asyncio
async def test_get_job_status_started(loan_controller: LoanController, loan_queue_mock):
    """Test job status when job is started."""
    job_mock = MagicMock()
    job_mock.get_status.return_value = "started"
    loan_queue_mock.fetch_job.return_value = job_mock

    resp = await _call(loan_controller.get_job_status, loan_controller, job_id="job-123", loan_queue=loan_queue_mock)

    assert resp["status"] == "started"
    assert "loan_id" not in resp


@pytest.mark.asyncio
async def test_get_job_status_finished(loan_controller: LoanController, loan_queue_mock):
    """Test job status when job is finished."""
    job_mock = MagicMock()
    job_mock.get_status.return_value = "finished"
    job_mock.result = "550e8400-e29b-41d4-a716-446655440000"  # Mock loan ID
    loan_queue_mock.fetch_job.return_value = job_mock

    resp = await _call(loan_controller.get_job_status, loan_controller, job_id="job-123", loan_queue=loan_queue_mock)

    assert resp["status"] == "finished"
    assert resp["loan_id"] == "550e8400-e29b-41d4-a716-446655440000"


@pytest.mark.asyncio
async def test_get_job_status_failed(loan_controller: LoanController, loan_queue_mock):
    """Test job status when job has failed."""
    job_mock = MagicMock()
    job_mock.get_status.return_value = "failed"
    job_mock.exc_info = "Some error occurred"
    loan_queue_mock.fetch_job.return_value = job_mock

    resp = await _call(loan_controller.get_job_status, loan_controller, job_id="job-123", loan_queue=loan_queue_mock)

    assert resp["status"] == "failed"
    assert resp["error"] == "Some error occurred"


@pytest.mark.asyncio
async def test_list_loans(loan_controller: LoanController, loan_service_mock: AsyncMock, workspace: WorkspaceContext):
    loans = [_loan(quantity=1), _loan(quantity=3)]
    loan_service_mock.get_all_loans.return_value = loans

    resp = await _call(loan_controller.list_loans, loan_controller, loan_service=loan_service_mock, workspace=workspace)

    loan_service_mock.get_all_loans.assert_awaited_once_with(workspace.workspace_id)
    assert [l.quantity for l in resp] == [1, 3]


@pytest.mark.asyncio
async def test_list_active_loans(loan_controller: LoanController, loan_service_mock: AsyncMock, workspace: WorkspaceContext):
    loans = [_loan(returned_at=None)]
    loan_service_mock.get_active_loans.return_value = loans

    resp = await _call(loan_controller.list_active_loans, loan_controller, loan_service=loan_service_mock, workspace=workspace)

    loan_service_mock.get_active_loans.assert_awaited_once_with(workspace.workspace_id)
    assert len(resp) == 1


@pytest.mark.asyncio
async def test_get_loan(loan_controller: LoanController, loan_service_mock: AsyncMock, workspace: WorkspaceContext):
    loan = _loan()
    loan_service_mock.get_loan.return_value = loan

    resp = await _call(loan_controller.get_loan, loan_controller, loan_id=loan.id, loan_service=loan_service_mock, workspace=workspace)

    loan_service_mock.get_loan.assert_awaited_once_with(loan.id, workspace.workspace_id)
    assert resp.id == loan.id


@pytest.mark.asyncio
async def test_get_loan_not_found(loan_controller: LoanController, loan_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode

    loan_service_mock.get_loan.side_effect = AppError(ErrorCode.LOAN_NOT_FOUND, status_code=404)
    missing_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(loan_controller.get_loan, loan_controller, loan_id=missing_id, loan_service=loan_service_mock, workspace=workspace)


@pytest.mark.asyncio
async def test_return_loan_success(loan_controller: LoanController, loan_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    loan = _loan(returned_at=None)
    loan_service_mock.return_loan.return_value = loan
    payload = LoanReturn(notes="Returned")

    resp = await _call(loan_controller.return_loan, loan_controller, loan_id=loan.id, data=payload, loan_service=loan_service_mock, activity_service=activity_service_mock, workspace=workspace)

    loan_service_mock.return_loan.assert_awaited_once_with(loan.id, payload, workspace.workspace_id)
    assert resp.notes == "Returned" or resp.notes == loan.notes


@pytest.mark.asyncio
async def test_return_loan_not_found(loan_controller: LoanController, loan_service_mock: AsyncMock, activity_service_mock: AsyncMock, workspace: WorkspaceContext):
    from warehouse.errors import AppError, ErrorCode

    loan_service_mock.return_loan.side_effect = AppError(ErrorCode.LOAN_NOT_FOUND, status_code=404)
    payload = LoanReturn(notes=None)
    missing_id = uuid7()

    with pytest.raises(HTTPException, match="404"):
        await _call(
            loan_controller.return_loan,
            loan_controller,
            loan_id=missing_id,
            data=payload,
            loan_service=loan_service_mock,
            activity_service=activity_service_mock,
            workspace=workspace,
        )
