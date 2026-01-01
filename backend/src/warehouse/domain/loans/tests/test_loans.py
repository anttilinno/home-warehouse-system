"""Tests for the loans domain services and schemas."""

from datetime import date, datetime
from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest

from warehouse.domain.loans.models import Borrower, Loan
from warehouse.domain.loans.schemas import (
    BorrowerCreate,
    BorrowerResponse,
    BorrowerUpdate,
    LoanCreate,
    LoanResponse,
    LoanReturn,
)
from warehouse.domain.loans.service import BorrowerService, LoanService


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def borrower_repository_mock():
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.list = AsyncMock()
    repo.get_by_id = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    return repo


@pytest.fixture
def loan_repository_mock():
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.list = AsyncMock()
    repo.get_by_id = AsyncMock()
    repo.get_one_or_none = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock()
    return repo


@pytest.fixture
def borrower_service(borrower_repository_mock: AsyncMock) -> BorrowerService:
    return BorrowerService(repository=borrower_repository_mock)


@pytest.fixture
def loan_service(loan_repository_mock: AsyncMock) -> LoanService:
    return LoanService(repository=loan_repository_mock)


@pytest.fixture
def sample_borrower(workspace_id: UUID) -> Borrower:
    return Borrower(
        id=uuid7(),
        workspace_id=workspace_id,
        name="Alice",
        email="alice@example.com",
        phone="123",
        notes="Note",
        created_at=datetime(2024, 1, 1, 0, 0, 0),
    )


@pytest.fixture
def sample_loan(sample_borrower: Borrower, workspace_id: UUID) -> Loan:
    return Loan(
        id=uuid7(),
        workspace_id=workspace_id,
        inventory_id=uuid7(),
        borrower_id=sample_borrower.id,
        quantity=1,
        loaned_at=datetime(2024, 1, 2, 0, 0, 0),
        due_date=date(2024, 1, 10),
        returned_at=None,
        notes=None,
        created_at=datetime(2024, 1, 2, 0, 0, 0),
        updated_at=datetime(2024, 1, 2, 0, 0, 0),
    )


@pytest.mark.asyncio
async def test_create_borrower(borrower_service: BorrowerService, borrower_repository_mock: AsyncMock, workspace_id: UUID):
    created = Borrower(
        id=uuid7(),
        workspace_id=workspace_id,
        name="Bob",
        email=None,
        phone=None,
        notes=None,
        created_at=datetime(2024, 1, 1, 0, 0, 0),
    )
    borrower_repository_mock.add.return_value = created
    data = BorrowerCreate(name="Bob", email=None, phone=None, notes=None)

    result = await borrower_service.create_borrower(data, workspace_id)

    borrower_repository_mock.add.assert_awaited_once()
    sent = borrower_repository_mock.add.await_args.args[0]
    assert sent.name == "Bob"
    assert sent.workspace_id == workspace_id
    assert result is created


@pytest.mark.asyncio
async def test_get_all_borrowers(borrower_service: BorrowerService, borrower_repository_mock: AsyncMock, sample_borrower: Borrower, workspace_id: UUID):
    borrower_repository_mock.list.return_value = [sample_borrower]

    result = await borrower_service.get_all_borrowers(workspace_id)

    borrower_repository_mock.list.assert_awaited_once_with(workspace_id=workspace_id)
    assert result == [sample_borrower]


@pytest.mark.asyncio
async def test_get_borrower(borrower_service: BorrowerService, borrower_repository_mock: AsyncMock, sample_borrower: Borrower, workspace_id: UUID):
    borrower_repository_mock.get_one_or_none.return_value = sample_borrower

    result = await borrower_service.get_borrower(sample_borrower.id, workspace_id)

    borrower_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_borrower.id, workspace_id=workspace_id)
    assert result is sample_borrower


@pytest.mark.asyncio
async def test_get_borrower_not_found(borrower_service: BorrowerService, borrower_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    borrower_repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await borrower_service.get_borrower(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.BORROWER_NOT_FOUND
    borrower_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_update_borrower(borrower_service: BorrowerService, borrower_repository_mock: AsyncMock, sample_borrower: Borrower, workspace_id: UUID):
    borrower_repository_mock.get_one_or_none.return_value = sample_borrower
    borrower_repository_mock.update.return_value = sample_borrower
    data = BorrowerUpdate(email="new@example.com", notes="Updated")

    result = await borrower_service.update_borrower(sample_borrower.id, data, workspace_id)

    borrower_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_borrower.id, workspace_id=workspace_id)
    borrower_repository_mock.update.assert_awaited_once_with(sample_borrower)
    assert sample_borrower.email == "new@example.com"
    assert sample_borrower.notes == "Updated"
    assert result is sample_borrower


@pytest.mark.asyncio
async def test_update_borrower_not_found(borrower_service: BorrowerService, borrower_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    borrower_repository_mock.get_one_or_none.return_value = None
    data = BorrowerUpdate(name="Missing")

    with pytest.raises(AppError) as exc_info:
        await borrower_service.update_borrower(missing_id, data, workspace_id)

    assert exc_info.value.code == ErrorCode.BORROWER_NOT_FOUND
    borrower_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    borrower_repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_borrower(borrower_service: BorrowerService, borrower_repository_mock: AsyncMock, sample_borrower: Borrower, workspace_id: UUID):
    from unittest.mock import MagicMock

    borrower_repository_mock.get_one_or_none.return_value = sample_borrower

    # Mock the session.execute to return no existing loans
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    borrower_repository_mock.session.execute.return_value = mock_result

    result = await borrower_service.delete_borrower(sample_borrower.id, workspace_id)

    borrower_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_borrower.id, workspace_id=workspace_id)
    borrower_repository_mock.session.execute.assert_awaited_once()
    borrower_repository_mock.session.delete.assert_awaited_once_with(sample_borrower)
    assert result is True


@pytest.mark.asyncio
async def test_delete_borrower_not_found(borrower_service: BorrowerService, borrower_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    borrower_repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await borrower_service.delete_borrower(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.BORROWER_NOT_FOUND
    borrower_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    borrower_repository_mock.session.delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_loan(loan_service: LoanService, loan_repository_mock: AsyncMock, sample_borrower: Borrower, workspace_id: UUID):
    created = Loan(
        id=uuid7(),
        workspace_id=workspace_id,
        inventory_id=uuid7(),
        borrower_id=sample_borrower.id,
        quantity=2,
        loaned_at=datetime(2024, 1, 2, 0, 0, 0),
        due_date=date(2024, 1, 10),
        returned_at=None,
        notes="Note",
        created_at=datetime(2024, 1, 2, 0, 0, 0),
        updated_at=datetime(2024, 1, 2, 0, 0, 0),
    )
    loan_repository_mock.add.return_value = created
    data = LoanCreate(
        inventory_id=created.inventory_id,
        borrower_id=created.borrower_id,
        quantity=2,
        due_date=date(2024, 1, 10),
        notes="Note",
    )

    result = await loan_service.create_loan(data, workspace_id)

    loan_repository_mock.add.assert_awaited_once()
    sent = loan_repository_mock.add.await_args.args[0]
    assert sent.inventory_id == created.inventory_id
    assert sent.quantity == 2
    assert sent.workspace_id == workspace_id
    assert result is created


@pytest.mark.asyncio
async def test_get_all_loans(loan_service: LoanService, loan_repository_mock: AsyncMock, sample_loan: Loan, workspace_id: UUID):
    another = Loan(
        id=uuid7(),
        workspace_id=workspace_id,
        inventory_id=uuid7(),
        borrower_id=sample_loan.borrower_id,
        quantity=1,
        loaned_at=datetime(2024, 1, 3, 0, 0, 0),
        due_date=None,
        returned_at=None,
        notes=None,
        created_at=datetime(2024, 1, 3, 0, 0, 0),
        updated_at=datetime(2024, 1, 3, 0, 0, 0),
    )
    loan_repository_mock.list.return_value = [sample_loan, another]

    result = await loan_service.get_all_loans(workspace_id)

    loan_repository_mock.list.assert_awaited_once_with(workspace_id=workspace_id)
    assert result == [sample_loan, another]


@pytest.mark.asyncio
async def test_get_loan(loan_service: LoanService, loan_repository_mock: AsyncMock, sample_loan: Loan, workspace_id: UUID):
    loan_repository_mock.get_one_or_none.return_value = sample_loan

    result = await loan_service.get_loan(sample_loan.id, workspace_id)

    loan_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_loan.id, workspace_id=workspace_id)
    assert result is sample_loan


@pytest.mark.asyncio
async def test_get_loan_not_found(loan_service: LoanService, loan_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    loan_repository_mock.get_one_or_none.return_value = None

    with pytest.raises(AppError) as exc_info:
        await loan_service.get_loan(missing_id, workspace_id)

    assert exc_info.value.code == ErrorCode.LOAN_NOT_FOUND
    loan_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_get_active_loans_filters_returned(loan_service: LoanService, loan_repository_mock: AsyncMock, sample_loan: Loan, workspace_id: UUID):
    returned = Loan(
        id=uuid7(),
        workspace_id=workspace_id,
        inventory_id=uuid7(),
        borrower_id=sample_loan.borrower_id,
        quantity=1,
        loaned_at=datetime(2024, 1, 3, 0, 0, 0),
        due_date=None,
        returned_at=datetime(2024, 1, 4, 0, 0, 0),
        notes=None,
        created_at=datetime(2024, 1, 3, 0, 0, 0),
        updated_at=datetime(2024, 1, 4, 0, 0, 0),
    )
    loan_repository_mock.list.return_value = [sample_loan, returned]

    result = await loan_service.get_active_loans(workspace_id)

    loan_repository_mock.list.assert_awaited_once_with(workspace_id=workspace_id)
    assert result == [sample_loan]


@pytest.mark.asyncio
async def test_return_loan_success(loan_service: LoanService, loan_repository_mock: AsyncMock, sample_loan: Loan, workspace_id: UUID):
    loan_repository_mock.get_one_or_none.return_value = sample_loan
    loan_repository_mock.update.return_value = sample_loan
    data = LoanReturn(notes="Returned")

    result = await loan_service.return_loan(sample_loan.id, data, workspace_id)

    loan_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_loan.id, workspace_id=workspace_id)
    loan_repository_mock.update.assert_awaited_once_with(sample_loan)
    assert sample_loan.returned_at is not None
    assert sample_loan.notes == "Returned"
    assert result is sample_loan


@pytest.mark.asyncio
async def test_return_loan_not_found(loan_service: LoanService, loan_repository_mock: AsyncMock, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    missing_id = uuid7()
    loan_repository_mock.get_one_or_none.return_value = None
    data = LoanReturn(notes=None)

    with pytest.raises(AppError) as exc_info:
        await loan_service.return_loan(missing_id, data, workspace_id)

    assert exc_info.value.code == ErrorCode.LOAN_NOT_FOUND
    loan_repository_mock.get_one_or_none.assert_awaited_once_with(id=missing_id, workspace_id=workspace_id)
    loan_repository_mock.update.assert_not_awaited()


@pytest.mark.asyncio
async def test_return_loan_already_returned(loan_service: LoanService, loan_repository_mock: AsyncMock, sample_loan: Loan, workspace_id: UUID):
    from warehouse.errors import AppError, ErrorCode

    sample_loan.returned_at = datetime(2024, 1, 5, 0, 0, 0)
    loan_repository_mock.get_one_or_none.return_value = sample_loan
    data = LoanReturn(notes=None)

    with pytest.raises(AppError) as exc_info:
        await loan_service.return_loan(sample_loan.id, data, workspace_id)

    assert exc_info.value.code == ErrorCode.LOAN_ALREADY_RETURNED
    loan_repository_mock.update.assert_not_awaited()


def test_borrower_and_loan_schemas():
    borrower_id = uuid7()
    loan_id = uuid7()
    inventory_id = uuid7()
    created = datetime(2024, 1, 1, 0, 0, 0)
    updated = datetime(2024, 1, 2, 0, 0, 0)

    borrower_create = BorrowerCreate(name="Name")
    borrower_update = BorrowerUpdate(email="e@example.com")
    borrower_response = BorrowerResponse(
        id=borrower_id,
        name="Name",
        email=None,
        phone=None,
        notes=None,
        created_at=created,
        updated_at=updated,
    )
    loan_create = LoanCreate(inventory_id=inventory_id, borrower_id=borrower_id, quantity=1, due_date=None, notes=None)
    loan_return = LoanReturn(notes="Done")
    loan_response = LoanResponse(
        id=loan_id,
        inventory_id=inventory_id,
        borrower_id=borrower_id,
        quantity=1,
        loaned_at=created,
        due_date=None,
        returned_at=None,
        notes=None,
        created_at=created,
        updated_at=updated,
    )

    assert borrower_create.name == "Name"
    assert borrower_update.email == "e@example.com"
    assert borrower_response.id == borrower_id
    assert loan_create.inventory_id == inventory_id
    assert loan_return.notes == "Done"
    assert loan_response.updated_at == updated

    with pytest.raises(TypeError):
        BorrowerCreate()  # type: ignore[call-arg]


@pytest.mark.asyncio
async def test_return_loan_keeps_notes_when_none(loan_service: LoanService, loan_repository_mock: AsyncMock, sample_loan: Loan, workspace_id: UUID):
    sample_loan.notes = "orig"
    loan_repository_mock.get_one_or_none.return_value = sample_loan
    loan_repository_mock.update.return_value = sample_loan
    payload = LoanReturn(notes=None)

    result = await loan_service.return_loan(sample_loan.id, payload, workspace_id)

    loan_repository_mock.get_one_or_none.assert_awaited_once_with(id=sample_loan.id, workspace_id=workspace_id)
    loan_repository_mock.update.assert_awaited_once_with(sample_loan)
    assert sample_loan.notes == "orig"
    assert result is sample_loan
