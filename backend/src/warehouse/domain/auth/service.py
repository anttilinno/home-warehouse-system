"""Authentication domain service."""

import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from passlib.context import CryptContext
from sqlalchemy import select

from warehouse.config import Config
from warehouse.domain.auth.models import PasswordResetToken, User, Workspace, WorkspaceMember, WorkspaceRole
from warehouse.domain.auth.repository import UserRepository, WorkspaceRepository, WorkspaceMemberRepository
from warehouse.domain.auth.schemas import LoginRequest, UserCreate, WorkspaceCreate, WorkspaceMemberInvite, WorkspaceMemberResponse, WorkspaceResponse
from warehouse.errors import AppError, ErrorCode

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')


class AuthService:
    """Authentication service."""

    def __init__(
        self,
        repository: UserRepository,
        config: Config,
        workspace_repository: WorkspaceRepository | None = None,
        workspace_member_repository: WorkspaceMemberRepository | None = None,
    ):
        """Initialize auth service."""
        self.repository = repository
        self.config = config
        self.workspace_repository = workspace_repository
        self.workspace_member_repository = workspace_member_repository

    def hash_password(self, password: str) -> str:
        """Hash a password."""
        hashed = pwd_context.hash(password)
        return str(hashed)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password."""
        verified = pwd_context.verify(plain_password, hashed_password)
        return bool(verified)

    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user with a default personal workspace."""
        existing = await self.repository.get_by_email(user_data.email)
        if existing:
            raise AppError(ErrorCode.AUTH_EMAIL_EXISTS, status_code=400)

        hashed_password = self.hash_password(user_data.password)
        user = User(
            email=user_data.email,
            full_name=user_data.full_name,
            password_hash=hashed_password,
            language=user_data.language,
        )
        user = await self.repository.add(user)

        # Create default personal workspace
        if self.workspace_repository and self.workspace_member_repository:
            workspace_name = f"{user_data.full_name}'s Workspace"
            base_slug = slugify(user_data.full_name)

            # Ensure unique slug
            slug = base_slug
            counter = 1
            while await self.workspace_repository.get_by_slug(slug):
                slug = f"{base_slug}-{counter}"
                counter += 1

            workspace = Workspace(
                name=workspace_name,
                slug=slug,
                description="Personal workspace",
                is_personal=True,
            )
            workspace = await self.workspace_repository.add(workspace)

            # Add user as owner of the workspace
            membership = WorkspaceMember(
                workspace_id=workspace.id,
                user_id=user.id,
                role=WorkspaceRole.OWNER,
            )
            await self.workspace_member_repository.add(membership)

        await self.repository.session.commit()
        return user

    async def authenticate(self, login_data: LoginRequest) -> User:
        """Authenticate a user by email."""
        user = await self.repository.get_by_email(login_data.email)

        if not user:
            raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, status_code=401)
        if not user.is_active:
            raise AppError(ErrorCode.AUTH_INACTIVE_USER, status_code=401)

        if not self.verify_password(login_data.password, user.password_hash):
            raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, status_code=401)

        return user

    async def get_user_workspaces(self, user_id: UUID) -> list[WorkspaceResponse]:
        """Get all workspaces for a user."""
        user = await self.repository.get_with_workspaces(user_id)
        if not user:
            return []

        return [
            WorkspaceResponse(
                id=membership.workspace.id,
                name=membership.workspace.name,
                slug=membership.workspace.slug,
                description=membership.workspace.description,
                role=membership.role.value,
                is_personal=membership.workspace.is_personal,
            )
            for membership in user.workspace_memberships
        ]

    def create_access_token(self, user_id: UUID) -> str:
        """Create a JWT access token."""
        expires = datetime.now(UTC) + timedelta(hours=self.config.jwt_expiration_hours)
        payload = {
            "sub": str(user_id),
            "exp": expires,
        }
        return jwt.encode(payload, self.config.secret_key, algorithm=self.config.jwt_algorithm)

    def decode_token(self, token: str) -> UUID | None:
        """Decode and verify a JWT token, returning the user ID if valid."""
        try:
            payload = jwt.decode(token, self.config.secret_key, algorithms=[self.config.jwt_algorithm])
            user_id = payload.get("sub")
            if user_id:
                return UUID(user_id)
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        return None

    async def get_current_user(self, token: str) -> User:
        """Get the current user from a JWT token."""
        user_id = self.decode_token(token)
        if not user_id:
            raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401)

        user = await self.repository.get_one_or_none(id=user_id)
        if not user:
            raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401)
        if not user.is_active:
            raise AppError(ErrorCode.AUTH_INACTIVE_USER, status_code=401)

        return user

    async def update_profile(
        self,
        user_id: UUID,
        full_name: str | None = None,
        email: str | None = None,
        date_format: str | None = None,
        language: str | None = None,
        theme: str | None = None,
    ) -> User:
        """Update user profile fields."""
        user = await self.repository.get_one_or_none(id=user_id)
        if not user:
            raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401)

        if email and email != user.email:
            existing = await self.repository.get_by_email(email)
            if existing:
                raise AppError(ErrorCode.AUTH_EMAIL_EXISTS, status_code=400)
            user.email = email

        if full_name is not None:
            user.full_name = full_name

        if date_format is not None:
            user.date_format = date_format

        if language is not None:
            user.language = language

        if theme is not None:
            user.theme = theme

        user.updated_at = datetime.now(UTC).replace(tzinfo=None)
        await self.repository.session.commit()
        await self.repository.session.refresh(user)
        return user

    async def change_password(self, user_id: UUID, current_password: str, new_password: str) -> User:
        """Change user password."""
        user = await self.repository.get_one_or_none(id=user_id)
        if not user:
            raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401)

        if not self.verify_password(current_password, user.password_hash):
            raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, status_code=400)

        user.password_hash = self.hash_password(new_password)
        user.updated_at = datetime.now(UTC).replace(tzinfo=None)
        await self.repository.session.commit()
        await self.repository.session.refresh(user)
        return user

    async def create_workspace(self, user_id: UUID, data: WorkspaceCreate) -> WorkspaceResponse:
        """Create a new workspace and add the user as owner."""
        if not self.workspace_repository or not self.workspace_member_repository:
            raise AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=500)

        # Generate unique slug
        base_slug = slugify(data.name)
        slug = base_slug
        counter = 1
        while await self.workspace_repository.get_by_slug(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        workspace = Workspace(
            name=data.name,
            slug=slug,
            description=data.description,
        )
        workspace = await self.workspace_repository.add(workspace)

        # Add user as owner
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user_id,
            role=WorkspaceRole.OWNER,
        )
        await self.workspace_member_repository.add(membership)
        await self.repository.session.commit()

        return WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            slug=workspace.slug,
            description=workspace.description,
            role=WorkspaceRole.OWNER.value,
            is_personal=workspace.is_personal,
        )

    async def get_workspace_members(self, workspace_id: UUID, user_id: UUID) -> list[WorkspaceMemberResponse]:
        """Get all members of a workspace."""
        if not self.workspace_member_repository:
            raise AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=500)

        # Verify user has access to this workspace
        membership = await self.workspace_member_repository.get_one_or_none(
            workspace_id=workspace_id, user_id=user_id
        )
        if not membership:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND, status_code=404)

        # Get all members with user details
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        stmt = (
            select(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == workspace_id)
            .options(selectinload(WorkspaceMember.user))
        )
        result = await self.repository.session.execute(stmt)
        members = result.scalars().all()

        return [
            WorkspaceMemberResponse(
                id=m.id,
                user_id=m.user_id,
                email=m.user.email,
                full_name=m.user.full_name,
                role=m.role.value,
                created_at=m.created_at,
            )
            for m in members
        ]

    async def invite_member(
        self, workspace_id: UUID, inviter_id: UUID, data: WorkspaceMemberInvite
    ) -> WorkspaceMemberResponse:
        """Invite a user to a workspace by email."""
        if not self.workspace_member_repository:
            raise AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=500)

        # Verify inviter has admin or owner role
        inviter_membership = await self.workspace_member_repository.get_one_or_none(
            workspace_id=workspace_id, user_id=inviter_id
        )
        if not inviter_membership:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND, status_code=404)
        if inviter_membership.role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            raise AppError(ErrorCode.WORKSPACE_PERMISSION_DENIED, status_code=403)

        # Find user by email
        user = await self.repository.get_by_email(data.email)
        if not user:
            raise AppError(ErrorCode.USER_NOT_FOUND, status_code=404)

        # Check if user is already a member
        existing = await self.workspace_member_repository.get_one_or_none(
            workspace_id=workspace_id, user_id=user.id
        )
        if existing:
            raise AppError(ErrorCode.WORKSPACE_MEMBER_EXISTS, status_code=400)

        # Parse role
        try:
            role = WorkspaceRole(data.role)
        except ValueError:
            raise AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=400)

        # Cannot invite as owner (there can only be one owner typically)
        if role == WorkspaceRole.OWNER:
            raise AppError(ErrorCode.WORKSPACE_PERMISSION_DENIED, status_code=403)

        # Create membership
        membership = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=user.id,
            role=role,
            invited_by=inviter_id,
        )
        membership = await self.workspace_member_repository.add(membership)
        await self.repository.session.commit()

        return WorkspaceMemberResponse(
            id=membership.id,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=role.value,
            created_at=membership.created_at,
        )

    async def search_users(
        self, query: str | None = None, workspace_id: UUID | None = None, limit: int = 50
    ) -> list[dict]:
        """Search users by email or name, optionally excluding existing workspace members.

        If query is empty/None and workspace_id is provided, returns all invitable users.
        """
        from sqlalchemy import select, or_, func

        stmt = select(User).where(User.is_active == True).limit(limit)

        # Apply search filter if query provided
        if query and len(query) >= 2:
            search_pattern = f"%{query.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.email).like(search_pattern),
                    func.lower(User.full_name).like(search_pattern),
                )
            )

        # Exclude users already in the workspace
        if workspace_id and self.workspace_member_repository:
            existing_member_ids = select(WorkspaceMember.user_id).where(
                WorkspaceMember.workspace_id == workspace_id
            )
            stmt = stmt.where(User.id.not_in(existing_member_ids))

        # Order by name for consistent display
        stmt = stmt.order_by(User.full_name)

        result = await self.repository.session.execute(stmt)
        users = result.scalars().all()

        return [
            {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
            }
            for user in users
        ]

    async def delete_workspace(self, workspace_id: UUID, user_id: UUID) -> None:
        """Delete a workspace and all related data. Cannot delete personal or last workspace."""
        if not self.workspace_repository or not self.workspace_member_repository:
            raise AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=500)

        # Get workspace
        workspace = await self.workspace_repository.get_one_or_none(id=workspace_id)
        if not workspace:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND, status_code=404)

        # Check if personal workspace (protected)
        if workspace.is_personal:
            raise AppError(ErrorCode.WORKSPACE_PROTECTED, status_code=403)

        # Verify user has owner or admin role
        membership = await self.workspace_member_repository.get_one_or_none(
            workspace_id=workspace_id, user_id=user_id
        )
        if not membership:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND, status_code=404)
        if membership.role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            raise AppError(ErrorCode.WORKSPACE_PERMISSION_DENIED, status_code=403)

        # Check if this is the user's last workspace
        user_memberships = await self.workspace_member_repository.list(user_id=user_id)
        if len(user_memberships) <= 1:
            raise AppError(ErrorCode.WORKSPACE_LAST, status_code=400)

        # Delete workspace using raw SQL to ensure CASCADE works properly
        from sqlalchemy import delete
        delete_stmt = delete(Workspace).where(Workspace.id == workspace_id)
        await self.repository.session.execute(delete_stmt)
        await self.repository.session.commit()

    async def remove_member(self, workspace_id: UUID, member_id: UUID, remover_id: UUID) -> None:
        """Remove a member from a workspace. Owner/Admin can remove, but owner cannot be removed."""
        if not self.workspace_member_repository:
            raise AppError(ErrorCode.GENERAL_BAD_REQUEST, status_code=500)

        # Verify remover has owner or admin role
        remover_membership = await self.workspace_member_repository.get_one_or_none(
            workspace_id=workspace_id, user_id=remover_id
        )
        if not remover_membership:
            raise AppError(ErrorCode.WORKSPACE_NOT_FOUND, status_code=404)
        if remover_membership.role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            raise AppError(ErrorCode.WORKSPACE_PERMISSION_DENIED, status_code=403)

        # Get target member
        target_membership = await self.workspace_member_repository.get_one_or_none(id=member_id)
        if not target_membership or target_membership.workspace_id != workspace_id:
            raise AppError(ErrorCode.WORKSPACE_MEMBER_NOT_FOUND, status_code=404)

        # Cannot remove owner
        if target_membership.role == WorkspaceRole.OWNER:
            raise AppError(ErrorCode.WORKSPACE_OWNER_CANNOT_BE_REMOVED, status_code=403)

        # Delete membership
        await self.workspace_member_repository.delete(member_id)
        await self.repository.session.commit()

    async def request_password_reset(self, email: str) -> tuple[str, str] | None:
        """Generate a password reset token for the user.

        Args:
            email: User's email address

        Returns:
            Tuple of (reset token, user language) if user exists, None otherwise
        """
        user = await self.repository.get_by_email(email)
        if not user:
            return None

        # Generate a secure random token
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires_at = datetime.now(UTC) + timedelta(hours=1)

        # Store the token hash in the database
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.repository.session.add(reset_token)
        await self.repository.session.commit()

        return (token, user.language)

    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset user password using a reset token.

        Args:
            token: The reset token received via email
            new_password: The new password to set

        Returns:
            True if password was reset successfully, False otherwise
        """
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # Find valid token
        stmt = (
            select(PasswordResetToken)
            .where(PasswordResetToken.token_hash == token_hash)
            .where(PasswordResetToken.expires_at > datetime.now(UTC))
            .where(PasswordResetToken.used_at.is_(None))
        )
        result = await self.repository.session.execute(stmt)
        reset_token = result.scalar_one_or_none()

        if not reset_token:
            return False

        # Get user and update password
        user = await self.repository.get_one_or_none(id=reset_token.user_id)
        if not user:
            return False

        user.password_hash = self.hash_password(new_password)
        user.updated_at = datetime.now(UTC).replace(tzinfo=None)

        # Mark token as used
        reset_token.used_at = datetime.now(UTC)

        await self.repository.session.commit()
        return True

