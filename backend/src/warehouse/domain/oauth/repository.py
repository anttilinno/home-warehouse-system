"""OAuth domain repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.oauth.models import UserOAuthAccount


class OAuthAccountRepository:
    """Repository for OAuth account operations."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with database session."""
        self.session = session

    async def get_by_provider_user_id(
        self, provider: str, provider_user_id: str
    ) -> UserOAuthAccount | None:
        """Get OAuth account by provider and provider user ID."""
        stmt = select(UserOAuthAccount).where(
            UserOAuthAccount.provider == provider,
            UserOAuthAccount.provider_user_id == provider_user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user_id(self, user_id: UUID) -> list[UserOAuthAccount]:
        """Get all OAuth accounts for a user."""
        stmt = select(UserOAuthAccount).where(UserOAuthAccount.user_id == user_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, account_id: UUID) -> UserOAuthAccount | None:
        """Get OAuth account by ID."""
        stmt = select(UserOAuthAccount).where(UserOAuthAccount.id == account_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        user_id: UUID,
        provider: str,
        provider_user_id: str,
        email: str | None = None,
        display_name: str | None = None,
        avatar_url: str | None = None,
        access_token: str | None = None,
        refresh_token: str | None = None,
    ) -> UserOAuthAccount:
        """Create a new OAuth account."""
        account = UserOAuthAccount(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
            access_token=access_token,
            refresh_token=refresh_token,
        )
        self.session.add(account)
        await self.session.flush()
        return account

    async def delete(self, account: UserOAuthAccount) -> None:
        """Delete an OAuth account."""
        await self.session.delete(account)
        await self.session.flush()

    async def update_tokens(
        self,
        account: UserOAuthAccount,
        access_token: str | None = None,
        refresh_token: str | None = None,
    ) -> UserOAuthAccount:
        """Update OAuth account tokens."""
        if access_token is not None:
            account.access_token = access_token
        if refresh_token is not None:
            account.refresh_token = refresh_token
        await self.session.flush()
        return account
