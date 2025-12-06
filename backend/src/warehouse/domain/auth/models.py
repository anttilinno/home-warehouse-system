"""Authentication domain models."""

from datetime import datetime
from uuid import UUID

from advanced_alchemy.base import UUIDPrimaryKey
from sqlalchemy import Boolean, String, func
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.lib.base import TimestampMixin


class User(UUIDPrimaryKey, TimestampMixin):
    """User model."""

    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

