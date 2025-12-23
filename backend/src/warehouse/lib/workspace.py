"""Workspace context for multi-tenancy."""

from dataclasses import dataclass
from uuid import UUID

import jwt
from litestar import Request
from litestar.exceptions import NotAuthorizedException
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.config import Config
from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.auth.repository import WorkspaceMemberRepository
from warehouse.errors import AppError, ErrorCode


@dataclass
class WorkspaceContext:
    """Workspace context for the current request."""

    workspace_id: UUID
    user_id: UUID
    user_role: WorkspaceRole

    def can_write(self) -> bool:
        """Check if user has write permissions (not a viewer)."""
        return self.user_role != WorkspaceRole.VIEWER


def require_write_permission(workspace: WorkspaceContext) -> None:
    """Raise 403 if user cannot write (is a viewer)."""
    if not workspace.can_write():
        raise AppError(
            ErrorCode.WORKSPACE_PERMISSION_DENIED,
            status_code=403,
        ).to_http_exception()


async def get_workspace_context(
    request: Request, db_session: AsyncSession, config: Config
) -> WorkspaceContext:
    """
    Extract workspace context from request and validate user access.

    The workspace ID is expected in the X-Workspace-ID header.
    The user ID is extracted from the JWT token in Authorization header.
    """
    # Extract workspace ID from header
    workspace_id_header = request.headers.get("X-Workspace-ID")

    if not workspace_id_header:
        raise AppError(
            ErrorCode.WORKSPACE_REQUIRED,
            status_code=400,
        ).to_http_exception()

    try:
        workspace_id = UUID(workspace_id_header)
    except ValueError:
        raise AppError(
            ErrorCode.WORKSPACE_INVALID,
            status_code=400,
        ).to_http_exception()

    # Extract and decode JWT token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise AppError(
            ErrorCode.AUTH_INVALID_TOKEN,
            status_code=401,
        ).to_http_exception()

    token = auth_header[7:]  # Remove "Bearer " prefix

    try:
        payload = jwt.decode(token, config.secret_key, algorithms=[config.jwt_algorithm])
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401).to_http_exception()
        user_id = UUID(user_id_str)
    except jwt.ExpiredSignatureError:
        raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401).to_http_exception()
    except jwt.InvalidTokenError:
        raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401).to_http_exception()
    except ValueError:
        raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401).to_http_exception()

    # Look up user's workspace membership and role
    member_repo = WorkspaceMemberRepository(session=db_session)
    membership = await member_repo.get_one_or_none(
        workspace_id=workspace_id, user_id=user_id
    )

    if not membership:
        raise AppError(
            ErrorCode.WORKSPACE_ACCESS_DENIED,
            status_code=403,
        ).to_http_exception()

    return WorkspaceContext(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=membership.role,
    )
