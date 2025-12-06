"""Loans domain models."""

from datetime import date, datetime
from uuid import UUID

from advanced_alchemy.base import UUIDPrimaryKey
from sqlalchemy import Date, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.lib.base import TimestampMixin


class Borrower(UUIDPrimaryKey):
    """Borrower model."""

    __tablename__ = "borrowers"
    __table_args__ = {"schema": "warehouse"}

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Loan(UUIDPrimaryKey, TimestampMixin):
    """Loan model."""

    __tablename__ = "loans"
    __table_args__ = {"schema": "warehouse"}

    item_id: Mapped[UUID] = mapped_column(
        ForeignKey("warehouse.items.id"), nullable=False
    )
    borrower_id: Mapped[UUID] = mapped_column(
        ForeignKey("warehouse.borrowers.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    loaned_at: Mapped[datetime] = mapped_column(server_default=func.now())
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

