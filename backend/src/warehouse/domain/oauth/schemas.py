"""OAuth domain schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class OAuthAccountResponse(msgspec.Struct):
    """Schema for OAuth account response."""

    id: UUID
    provider: str
    email: str | None
    display_name: str | None
    avatar_url: str | None
    created_at: datetime


class OAuthLoginUrl(msgspec.Struct):
    """Schema for OAuth login URL response."""

    url: str
    provider: str


class OAuthCallbackResult(msgspec.Struct):
    """Schema for OAuth callback result."""

    access_token: str
    user_id: UUID
    is_new_user: bool
    redirect_url: str | None = None


class AvailableProvider(msgspec.Struct):
    """Schema for available OAuth provider."""

    provider: str
    enabled: bool
