"""Authentication domain schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class UserCreate(msgspec.Struct):
    """Schema for creating a user."""

    username: str
    email: str
    password: str


class UserResponse(msgspec.Struct):
    """Schema for user response."""

    id: UUID
    username: str
    email: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LoginRequest(msgspec.Struct):
    """Schema for login request."""

    username: str
    password: str


class TokenResponse(msgspec.Struct):
    """Schema for token response."""

    access_token: str
    token_type: str = "bearer"

