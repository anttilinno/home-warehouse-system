"""Authentication domain models."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from warehouse.lib.base import Base, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from warehouse.domain.oauth.models import UserOAuthAccount


class WorkspaceRole(str, Enum):
    """Workspace role enum."""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class Workspace(Base, UUIDPKMixin, TimestampMixin):
    """Workspace model for multi-tenant isolation."""

    __tablename__ = "workspaces"
    __table_args__ = {"schema": "auth"}

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_personal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    members: Mapped[list["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="workspace"
    )


class User(Base, UUIDPKMixin, TimestampMixin):
    """User model."""

    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    date_format: Mapped[str] = mapped_column(String(30), default="DD.MM.YYYY HH:mm", nullable=False)
    language: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())

    workspace_memberships: Mapped[list["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="user", foreign_keys="[WorkspaceMember.user_id]"
    )
    oauth_accounts: Mapped[list["UserOAuthAccount"]] = relationship(
        "UserOAuthAccount", back_populates="user", foreign_keys="[UserOAuthAccount.user_id]"
    )


class WorkspaceMember(Base, UUIDPKMixin, TimestampMixin):
    """Workspace membership with role."""

    __tablename__ = "workspace_members"
    __table_args__ = {"schema": "auth"}

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[WorkspaceRole] = mapped_column(
        SAEnum(
            WorkspaceRole,
            name="workspace_role_enum",
            schema="auth",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=WorkspaceRole.MEMBER,
    )
    invited_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="members")
    user: Mapped["User"] = relationship(
        "User", back_populates="workspace_memberships", foreign_keys=[user_id]
    )


class WorkspaceExport(Base, UUIDPKMixin):
    """Workspace export audit log."""

    __tablename__ = "workspace_exports"
    __table_args__ = {"schema": "auth"}

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.workspaces.id", ondelete="CASCADE"), nullable=False
    )
    exported_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True
    )
    format: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    record_counts: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class PasswordResetToken(Base, UUIDPKMixin):
    """Password reset token with expiration and one-time use."""

    __tablename__ = "password_reset_tokens"
    __table_args__ = {"schema": "auth"}

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

