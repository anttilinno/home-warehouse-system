"""Authentication domain schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class UserCreate(msgspec.Struct):
    """Schema for creating a user."""

    email: str
    full_name: str
    password: str


class UserResponse(msgspec.Struct):
    """Schema for user response."""

    id: UUID
    email: str
    full_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LoginRequest(msgspec.Struct):
    """Schema for login request."""

    email: str
    password: str


class WorkspaceResponse(msgspec.Struct):
    """Schema for workspace response."""

    id: UUID
    name: str
    slug: str
    description: str | None
    role: str
    is_personal: bool = False


class TokenResponse(msgspec.Struct):
    """Schema for token response."""

    access_token: str
    user: UserResponse
    workspaces: list[WorkspaceResponse]
    token_type: str = "bearer"


class ProfileUpdate(msgspec.Struct):
    """Schema for updating user profile."""

    full_name: str | None = None
    email: str | None = None


class PasswordChange(msgspec.Struct):
    """Schema for changing password."""

    current_password: str
    new_password: str


class WorkspaceCreate(msgspec.Struct):
    """Schema for creating a workspace."""

    name: str
    description: str | None = None


class WorkspaceMemberInvite(msgspec.Struct):
    """Schema for inviting a user to a workspace."""

    email: str
    role: str = "member"  # owner, admin, member, viewer


class WorkspaceMemberResponse(msgspec.Struct):
    """Schema for workspace member response."""

    id: UUID
    user_id: UUID
    email: str
    full_name: str
    role: str
    created_at: datetime


class UserSearchResult(msgspec.Struct):
    """Schema for user search result."""

    id: str
    email: str
    full_name: str

