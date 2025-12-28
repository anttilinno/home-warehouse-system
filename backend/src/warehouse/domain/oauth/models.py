"""OAuth domain models."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin


class UserOAuthAccount(Base, UUIDPKMixin, TimestampMixin):
    """OAuth account linked to a user."""

    __tablename__ = "user_oauth_accounts"
    __table_args__ = {"schema": "auth"}

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(
        "User", back_populates="oauth_accounts", foreign_keys=[user_id]
    )


# Use TYPE_CHECKING to avoid circular imports
from typing import TYPE_CHECKING  # noqa: E402

if TYPE_CHECKING:
    from warehouse.domain.auth.models import User  # noqa: F401
