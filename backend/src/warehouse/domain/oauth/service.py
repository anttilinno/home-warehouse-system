"""OAuth domain service."""

from uuid import UUID

from litestar_oauth import OAuthService, OAuthUserInfo
from litestar_oauth.providers import GitHubOAuthProvider, GoogleOAuthProvider
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.config import Config
from warehouse.domain.auth.models import User, Workspace, WorkspaceMember, WorkspaceRole
from warehouse.domain.oauth.models import UserOAuthAccount
from warehouse.domain.oauth.repository import OAuthAccountRepository
from warehouse.domain.oauth.schemas import OAuthAccountResponse

# Singleton OAuth service to persist state across requests
_oauth_service: OAuthService | None = None


def create_oauth_service(config: Config) -> OAuthService:
    """Get or create the singleton OAuth service with providers."""
    global _oauth_service

    if _oauth_service is not None:
        return _oauth_service

    service = OAuthService()

    # Register Google provider if configured
    if config.google_client_id and config.google_client_secret:
        google = GoogleOAuthProvider(
            client_id=config.google_client_id,
            client_secret=config.google_client_secret,
        )
        service.register(google)

    # Register GitHub provider if configured
    if config.github_client_id and config.github_client_secret:
        github = GitHubOAuthProvider(
            client_id=config.github_client_id,
            client_secret=config.github_client_secret,
        )
        service.register(github)

    _oauth_service = service
    return service


class OAuthAccountService:
    """Service for OAuth account operations."""

    def __init__(
        self,
        session: AsyncSession,
        repository: OAuthAccountRepository,
        oauth_service: OAuthService,
    ) -> None:
        """Initialize service with dependencies."""
        self.session = session
        self.repository = repository
        self.oauth_service = oauth_service

    async def get_user_accounts(self, user_id: UUID) -> list[OAuthAccountResponse]:
        """Get all OAuth accounts for a user."""
        accounts = await self.repository.get_by_user_id(user_id)
        return [
            OAuthAccountResponse(
                id=account.id,
                provider=account.provider,
                email=account.email,
                display_name=account.display_name,
                avatar_url=account.avatar_url,
                created_at=account.created_at,
            )
            for account in accounts
        ]

    async def unlink_account(self, user_id: UUID, account_id: UUID) -> bool:
        """Unlink an OAuth account from a user."""
        account = await self.repository.get_by_id(account_id)
        if account is None or account.user_id != user_id:
            return False

        # Check if this is the only OAuth account and user has no password
        # (prevent orphaning accounts)
        user_accounts = await self.repository.get_by_user_id(user_id)
        if len(user_accounts) == 1:
            # Check if user has a password set
            from sqlalchemy import select
            from warehouse.domain.auth.models import User

            stmt = select(User).where(User.id == user_id)
            result = await self.session.execute(stmt)
            user = result.scalar_one_or_none()
            if user and user.password_hash == "":
                # User has no password and this is their only OAuth account
                # Don't allow unlinking
                return False

        await self.repository.delete(account)
        return True

    async def handle_oauth_callback(
        self,
        provider: str,
        user_info: OAuthUserInfo,
        current_user_id: UUID | None = None,
    ) -> tuple[User, bool]:
        """Handle OAuth callback and return user.

        Auto-links to existing user if:
        1. OAuth account already exists
        2. Email matches an existing user
        3. User is currently logged in (linking new provider)

        Creates new user if no match found.

        Returns:
            Tuple of (user, is_new_user)
        """
        from sqlalchemy import select
        from warehouse.domain.auth.models import User

        # 1. Check if OAuth account already exists
        existing_account = await self.repository.get_by_provider_user_id(
            provider, user_info.oauth_id
        )
        if existing_account:
            # Return existing user
            stmt = select(User).where(User.id == existing_account.user_id)
            result = await self.session.execute(stmt)
            user = result.scalar_one()
            return user, False

        # 2. If user is logged in, link to their account
        if current_user_id:
            stmt = select(User).where(User.id == current_user_id)
            result = await self.session.execute(stmt)
            user = result.scalar_one()
            await self._create_oauth_account(user.id, provider, user_info)
            return user, False

        # 3. Check if email matches existing user (auto-link)
        if user_info.email:
            stmt = select(User).where(User.email == user_info.email)
            result = await self.session.execute(stmt)
            existing_user = result.scalar_one_or_none()
            if existing_user:
                await self._create_oauth_account(existing_user.id, provider, user_info)
                return existing_user, False

        # 4. Create new user
        display_name = self._get_display_name(user_info)
        new_user = await self._create_oauth_user(user_info.email or "", display_name)
        await self._create_oauth_account(new_user.id, provider, user_info)
        return new_user, True

    async def _create_oauth_account(
        self, user_id: UUID, provider: str, user_info: OAuthUserInfo
    ) -> UserOAuthAccount:
        """Create OAuth account for user."""
        display_name = self._get_display_name(user_info)
        account = await self.repository.create(
            user_id=user_id,
            provider=provider,
            provider_user_id=user_info.oauth_id,
            email=user_info.email,
            display_name=display_name,
            avatar_url=user_info.avatar_url,
        )
        # Commit immediately to ensure OAuth account is persisted before redirect
        await self.session.commit()
        return account

    async def _create_oauth_user(self, email: str, full_name: str) -> User:
        """Create new user from OAuth info."""
        # Generate unique email if not provided
        if not email:
            import secrets
            email = f"oauth_{secrets.token_hex(8)}@placeholder.local"

        user = User(
            email=email,
            full_name=full_name or "OAuth User",
            password_hash="",  # Empty password for OAuth-only users
            is_active=True,
        )
        self.session.add(user)
        await self.session.flush()

        # Create personal workspace
        workspace = Workspace(
            name=f"{full_name}'s Workspace",
            slug=f"personal-{user.id.hex[:8]}",
            is_personal=True,
        )
        self.session.add(workspace)
        await self.session.flush()

        # Add user as workspace owner
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role=WorkspaceRole.OWNER,
        )
        self.session.add(membership)
        await self.session.flush()

        # Commit to ensure new user is persisted before redirect
        await self.session.commit()

        return user

    def _get_display_name(self, user_info: OAuthUserInfo) -> str:
        """Get display name from OAuth user info."""
        if user_info.first_name or user_info.last_name:
            parts = [user_info.first_name, user_info.last_name]
            return " ".join(p for p in parts if p)
        if user_info.username:
            return user_info.username
        return user_info.email or "OAuth User"

    def get_available_providers(self) -> list[str]:
        """Get list of available (configured) providers."""
        return [
            name
            for name in self.oauth_service.list_providers()
            if self.oauth_service.providers[name].is_configured()
        ]
