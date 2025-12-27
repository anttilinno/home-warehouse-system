"""Authentication domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post, Request
from litestar.controller import Controller
from litestar.di import Provide
from litestar.exceptions import NotAuthorizedException
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.config import Config
from warehouse.domain.auth.repository import UserRepository, WorkspaceRepository, WorkspaceMemberRepository
from warehouse.domain.auth.schemas import (
    LoginRequest,
    MessageResponse,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdate,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserSearchResult,
    WorkspaceCreate,
    WorkspaceMemberInvite,
    WorkspaceMemberResponse,
    WorkspaceResponse,
)
from warehouse.domain.email.service import EmailService
from warehouse.domain.auth.service import AuthService
from warehouse.domain.notifications.repository import NotificationRepository
from warehouse.domain.notifications.service import NotificationService
from warehouse.errors import AppError, ErrorCode


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


def get_notification_service(db_session: AsyncSession) -> NotificationService:
    """Dependency for notification service."""
    notification_repository = NotificationRepository(session=db_session)
    return NotificationService(notification_repository)


def get_email_service(config: Config) -> EmailService:
    """Dependency for email service."""
    return EmailService(config)


class AuthController(Controller):
    """Authentication controller."""

    path = "/auth"
    dependencies = {
        "auth_service": Provide(get_auth_service, sync_to_thread=False),
        "notification_service": Provide(get_notification_service, sync_to_thread=False),
        "email_service": Provide(get_email_service, sync_to_thread=False),
    }

    @post("/register", status_code=HTTP_201_CREATED)
    async def register(
        self, data: UserCreate, auth_service: AuthService
    ) -> UserResponse:
        """Register a new user."""
        try:
            user = await auth_service.create_user(data)
        except AppError as exc:
            raise exc.to_http_exception()
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            date_format=user.date_format,
            language=user.language,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    @post("/login")
    async def login(self, data: LoginRequest, auth_service: AuthService) -> TokenResponse:
        """Login and get access token."""
        try:
            user = await auth_service.authenticate(data)
        except AppError as exc:
            raise exc.to_http_exception()

        access_token = auth_service.create_access_token(user.id)
        user_response = UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            date_format=user.date_format,
            language=user.language,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        workspaces = await auth_service.get_user_workspaces(user.id)
        return TokenResponse(access_token=access_token, user=user_response, workspaces=workspaces)

    @get("/me")
    async def get_me(self, request: Request, auth_service: AuthService) -> UserResponse:
        """Get current user profile."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
        except AppError as exc:
            raise exc.to_http_exception()

        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            date_format=user.date_format,
            language=user.language,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    @patch("/me")
    async def update_me(self, request: Request, data: ProfileUpdate, auth_service: AuthService) -> UserResponse:
        """Update current user profile."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
            user = await auth_service.update_profile(
                user.id,
                full_name=data.full_name,
                email=data.email,
                date_format=data.date_format,
                language=data.language,
            )
        except AppError as exc:
            raise exc.to_http_exception()

        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            date_format=user.date_format,
            language=user.language,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    @post("/me/password")
    async def change_password(self, request: Request, data: PasswordChange, auth_service: AuthService) -> UserResponse:
        """Change current user password."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
            user = await auth_service.change_password(user.id, data.current_password, data.new_password)
        except AppError as exc:
            raise exc.to_http_exception()

        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            date_format=user.date_format,
            language=user.language,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    def _extract_token(self, request: Request) -> str:
        """Extract JWT token from Authorization header."""
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401).to_http_exception()
        return auth_header[7:]  # Remove "Bearer " prefix

    @post("/workspaces", status_code=HTTP_201_CREATED)
    async def create_workspace(
        self, request: Request, data: WorkspaceCreate, auth_service: AuthService
    ) -> WorkspaceResponse:
        """Create a new workspace."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
            workspace = await auth_service.create_workspace(user.id, data)
        except AppError as exc:
            raise exc.to_http_exception()
        return workspace

    @get("/workspaces/{workspace_id:uuid}/members")
    async def get_workspace_members(
        self, request: Request, workspace_id: UUID, auth_service: AuthService
    ) -> list[WorkspaceMemberResponse]:
        """Get all members of a workspace."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
            members = await auth_service.get_workspace_members(workspace_id, user.id)
        except AppError as exc:
            raise exc.to_http_exception()
        return members

    @get("/users/search")
    async def search_users(
        self, request: Request, auth_service: AuthService, q: str | None = None, workspace_id: UUID | None = None
    ) -> list[UserSearchResult]:
        """Search users by email or name. Returns all invitable users if q is empty."""
        token = self._extract_token(request)
        try:
            await auth_service.get_current_user(token)
            results = await auth_service.search_users(q, workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()
        return [UserSearchResult(**r) for r in results]

    @post("/workspaces/{workspace_id:uuid}/members", status_code=HTTP_201_CREATED)
    async def invite_member(
        self,
        request: Request,
        workspace_id: UUID,
        data: WorkspaceMemberInvite,
        auth_service: AuthService,
        notification_service: NotificationService,
        email_service: EmailService,
    ) -> WorkspaceMemberResponse:
        """Invite a user to a workspace."""
        token = self._extract_token(request)
        try:
            inviter = await auth_service.get_current_user(token)
            member = await auth_service.invite_member(workspace_id, inviter.id, data)

            # Get workspace name for notification
            if auth_service.workspace_repository:
                workspace = await auth_service.workspace_repository.get_one_or_none(id=workspace_id)
                if workspace:
                    # Send in-app notification to the invited user
                    await notification_service.send_workspace_invite_notification(
                        user_id=member.user_id,
                        workspace_id=workspace_id,
                        workspace_name=workspace.name,
                        role=member.role,
                        invited_by_name=inviter.full_name,
                    )
                    # Send email notification
                    await email_service.send_workspace_invite(
                        to=data.email,
                        inviter_name=inviter.full_name,
                        workspace_name=workspace.name,
                        role=member.role,
                    )
        except AppError as exc:
            raise exc.to_http_exception()
        return member

    @delete("/workspaces/{workspace_id:uuid}")
    async def delete_workspace(
        self, request: Request, workspace_id: UUID, auth_service: AuthService
    ) -> None:
        """Delete a workspace. Only owner/admin can delete, personal workspaces cannot be deleted."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
            await auth_service.delete_workspace(workspace_id, user.id)
        except AppError as exc:
            raise exc.to_http_exception()

    @delete("/workspaces/{workspace_id:uuid}/members/{member_id:uuid}")
    async def remove_member(
        self, request: Request, workspace_id: UUID, member_id: UUID, auth_service: AuthService
    ) -> None:
        """Remove a member from a workspace. Owner/Admin can remove, but owner cannot be removed."""
        token = self._extract_token(request)
        try:
            user = await auth_service.get_current_user(token)
            await auth_service.remove_member(workspace_id, member_id, user.id)
        except AppError as exc:
            raise exc.to_http_exception()

    @post("/password-reset/request")
    async def request_password_reset(
        self,
        data: PasswordResetRequest,
        auth_service: AuthService,
        email_service: EmailService,
        config: Config,
    ) -> MessageResponse:
        """Request a password reset email.

        Always returns success message to prevent email enumeration.
        """
        result = await auth_service.request_password_reset(data.email)

        if result:
            token, language = result
            # Build reset URL using user's preferred language for locale prefix
            reset_url = f"{config.app_url}/{language}/reset-password?token={token}"
            await email_service.send_password_reset(data.email, reset_url, language)

        # Always return success to prevent email enumeration
        return MessageResponse(message="If an account exists with this email, a reset link has been sent.")

    @post("/password-reset/confirm")
    async def confirm_password_reset(
        self, data: PasswordResetConfirm, auth_service: AuthService
    ) -> MessageResponse:
        """Confirm password reset with token and new password."""
        try:
            success = await auth_service.reset_password(data.token, data.new_password)
            if success:
                return MessageResponse(message="Password has been reset successfully.")
            else:
                raise AppError(ErrorCode.AUTH_INVALID_TOKEN, "Invalid or expired reset token", status_code=400)
        except AppError as exc:
            raise exc.to_http_exception()

