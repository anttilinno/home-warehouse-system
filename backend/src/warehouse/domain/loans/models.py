"""Loans domain models."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin, WorkspaceMixin


class Borrower(Base, UUIDPKMixin, WorkspaceMixin, TimestampMixin):
    """Borrower model."""

    __tablename__ = "borrowers"
    __table_args__ = {"schema": "warehouse"}

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Loan(Base, UUIDPKMixin, WorkspaceMixin, TimestampMixin):
    """Loan model."""

    __tablename__ = "loans"
    __table_args__ = {"schema": "warehouse"}

    inventory_id: Mapped[UUID] = mapped_column(
        ForeignKey("warehouse.inventory.id"), nullable=False
    )
    borrower_id: Mapped[UUID] = mapped_column(
        ForeignKey("warehouse.borrowers.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    loaned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

