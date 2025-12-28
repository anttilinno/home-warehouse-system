"""OAuth domain controllers."""

from uuid import UUID

from litestar import delete, get, Request
from litestar.controller import Controller
from litestar.di import Provide
from litestar.params import Parameter
from litestar.response import Redirect
from litestar_oauth import OAuthService

from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.config import Config
from warehouse.domain.auth.service import AuthService
from warehouse.domain.auth.repository import UserRepository, WorkspaceRepository, WorkspaceMemberRepository
from warehouse.domain.oauth.repository import OAuthAccountRepository
from warehouse.domain.oauth.schemas import AvailableProvider, OAuthAccountResponse
from warehouse.domain.oauth.service import OAuthAccountService, create_oauth_service
from warehouse.errors import AppError, ErrorCode


def get_oauth_service(config: Config) -> OAuthService:
    """Dependency for OAuth service."""
    return create_oauth_service(config)


def get_oauth_account_service(
    db_session: AsyncSession, config: Config
) -> OAuthAccountService:
    """Dependency for OAuth account service."""
    oauth_service = create_oauth_service(config)
    repository = OAuthAccountRepository(session=db_session)
    return OAuthAccountService(
        session=db_session,
        repository=repository,
        oauth_service=oauth_service,
    )


def get_auth_service(db_session: AsyncSession, config: Config) -> AuthService:
    """Dependency for auth service."""
    user_repository = UserRepository(session=db_session)
    workspace_repository = WorkspaceRepository(session=db_session)
    workspace_member_repository = WorkspaceMemberRepository(session=db_session)
    return AuthService(
        user_repository,
        config,
        workspace_repository,
        workspace_member_repository,
    )


class OAuthController(Controller):
    """OAuth authentication controller."""

    path = "/auth/oauth"
    dependencies = {
        "oauth_service": Provide(get_oauth_service, sync_to_thread=False),
        "oauth_account_service": Provide(get_oauth_account_service, sync_to_thread=False),
        "auth_service": Provide(get_auth_service, sync_to_thread=False),
    }

    @get("/providers")
    async def get_providers(
        self, oauth_account_service: OAuthAccountService
    ) -> list[AvailableProvider]:
        """Get list of available OAuth providers."""
        providers = oauth_account_service.get_available_providers()
        return [AvailableProvider(provider=p, enabled=True) for p in providers]

    @get("/{provider:str}/login")
    async def oauth_login(
        self,
        provider: str,
        oauth_service: OAuthService,
        config: Config,
        next: str | None = None,
    ) -> Redirect:
        """Initiate OAuth login flow."""
        try:
            # Callback URL on the backend
            callback_url = f"{config.backend_url.rstrip('/')}/auth/oauth/{provider}/callback"

            auth_url = await oauth_service.get_authorization_url(
                provider_name=provider,
                redirect_uri=callback_url,
                next_url=next,
            )
            return Redirect(path=auth_url)
        except Exception as e:
            raise AppError(
                ErrorCode.OAUTH_PROVIDER_ERROR,
                status_code=400,
                message=f"OAuth login failed: {e}",
            ).to_http_exception()

    @get("/{provider:str}/callback")
    async def oauth_callback(
        self,
        request: Request,
        provider: str,
        oauth_service: OAuthService,
        oauth_account_service: OAuthAccountService,
        auth_service: AuthService,
        config: Config,
        code: str | None = None,
        oauth_state: str | None = Parameter(query="state", default=None),
        error: str | None = None,
    ) -> Redirect:
        """Handle OAuth callback from provider."""
        # Handle OAuth errors from provider
        if error:
            return Redirect(path=f"{config.app_url}/login?error=oauth_denied")

        if not code or not oauth_state:
            return Redirect(path=f"{config.app_url}/login?error=oauth_missing_params")

        try:
            # Validate and consume the state
            state_data = oauth_service.state_manager.consume_state(oauth_state, provider)
            callback_url = state_data.redirect_uri

            # Exchange code for token
            oauth_provider = oauth_service.get_provider(provider)
            token = await oauth_provider.exchange_code(code, callback_url)

            # Get user info from provider
            user_info = await oauth_provider.get_user_info(token.access_token)

            # Check if there's a current logged in user (linking flow)
            current_user_id = None
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                try:
                    user = await auth_service.get_current_user(auth_header[7:])
                    current_user_id = user.id
                except Exception:
                    pass

            # Handle the callback - auto-link or create user
            user, is_new_user = await oauth_account_service.handle_oauth_callback(
                provider, user_info, current_user_id
            )

            # Generate JWT token for the user
            access_token = auth_service.create_access_token(user.id)

            # Determine redirect URL
            next_url = state_data.next_url or f"{config.app_url}/dashboard"

            # Append token to URL for frontend to capture
            separator = "&" if "?" in next_url else "?"
            redirect_url = f"{next_url}{separator}token={access_token}&language={user.language}"
            if is_new_user:
                redirect_url += "&new_user=true"

            return Redirect(path=redirect_url)

        except Exception as e:
            return Redirect(path=f"{config.app_url}/login?error=oauth_failed&message={str(e)}")


class OAuthAccountController(Controller):
    """Controller for managing linked OAuth accounts."""

    path = "/auth/me/oauth-accounts"
    dependencies = {
        "oauth_account_service": Provide(get_oauth_account_service, sync_to_thread=False),
        "auth_service": Provide(get_auth_service, sync_to_thread=False),
    }

    @get("")
    async def list_accounts(
        self, request: Request, oauth_account_service: OAuthAccountService, auth_service: AuthService
    ) -> list[OAuthAccountResponse]:
        """Get all linked OAuth accounts for current user."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
            return await oauth_account_service.get_user_accounts(user.id)
        except AppError as exc:
            raise exc.to_http_exception()

    @delete("/{account_id:uuid}")
    async def unlink_account(
        self,
        request: Request,
        account_id: UUID,
        oauth_account_service: OAuthAccountService,
        auth_service: AuthService,
    ) -> None:
        """Unlink an OAuth account from current user."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
            success = await oauth_account_service.unlink_account(user.id, account_id)
            if not success:
                raise AppError(
                    ErrorCode.OAUTH_UNLINK_FAILED,
                    status_code=400,
                    message="Cannot unlink this account",
                )
        except AppError as exc:
            raise exc.to_http_exception()

    def _extract_token(self, request: Request) -> str:
        """Extract JWT token from Authorization header."""
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401).to_http_exception()
        return auth_header[7:]
