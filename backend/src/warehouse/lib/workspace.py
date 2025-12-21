"""Workspace context for multi-tenancy."""

from dataclasses import dataclass
from uuid import UUID

from litestar import Request
from litestar.exceptions import NotAuthorizedException

from warehouse.errors import AppError, ErrorCode


@dataclass
class WorkspaceContext:
    """Workspace context for the current request."""

    workspace_id: UUID


def get_workspace_context(request: Request) -> WorkspaceContext:
    """
    Extract workspace context from request.

    The workspace ID is expected in the X-Workspace-ID header.
    In a full implementation, this would also validate that the
    authenticated user has access to the workspace.
    """
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

    return WorkspaceContext(workspace_id=workspace_id)
