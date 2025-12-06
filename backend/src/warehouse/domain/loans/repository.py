"""Loans domain repository."""

from advanced_alchemy.repository import SQLAlchemyAsyncRepository

from warehouse.domain.loans.models import Borrower, Loan
from warehouse.lib.base import BaseRepository


class BorrowerRepository(BaseRepository[Borrower]):
    """Borrower repository."""

    model_type = Borrower


class LoanRepository(BaseRepository[Loan]):
    """Loan repository."""

    model_type = Loan

