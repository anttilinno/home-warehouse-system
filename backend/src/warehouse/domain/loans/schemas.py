"""Loans domain schemas."""

from datetime import date, datetime
from uuid import UUID

import msgspec


class BorrowerCreate(msgspec.Struct):
    """Schema for creating a borrower."""

    name: str
    email: str | None = None
    phone: str | None = None
    notes: str | None = None


class BorrowerUpdate(msgspec.Struct):
    """Schema for updating a borrower."""

    name: str | None = None
    email: str | None = None
    phone: str | None = None
    notes: str | None = None


class BorrowerResponse(msgspec.Struct):
    """Schema for borrower response."""

    id: UUID
    name: str
    email: str | None
    phone: str | None
    notes: str | None
    created_at: datetime


class LoanCreate(msgspec.Struct):
    """Schema for creating a loan."""

    inventory_id: UUID
    borrower_id: UUID
    quantity: int = 1
    due_date: date | None = None
    notes: str | None = None


class LoanReturn(msgspec.Struct):
    """Schema for returning a loan."""

    notes: str | None = None


class LoanResponse(msgspec.Struct):
    """Schema for loan response."""

    id: UUID
    inventory_id: UUID
    borrower_id: UUID
    quantity: int
    loaned_at: datetime
    due_date: date | None
    returned_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class LoanCreateResponse(msgspec.Struct):
    """Schema for loan creation response."""

    job_id: str
    status: str

