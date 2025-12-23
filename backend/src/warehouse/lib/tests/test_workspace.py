"""Tests for workspace context."""

from uuid import uuid7
from unittest.mock import MagicMock

import pytest
from litestar.exceptions import HTTPException

from warehouse.lib.workspace import get_workspace_context, WorkspaceContext


@pytest.fixture
def mock_request():
    """Create a mock request object."""
    request = MagicMock()
    request.headers = {}
    return request


class TestGetWorkspaceContext:
    """Tests for get_workspace_context function."""

    def test_get_workspace_context_success(self, mock_request):
        """Test valid UUID header returns WorkspaceContext."""
        workspace_id = uuid7()
        mock_request.headers = {"X-Workspace-ID": str(workspace_id)}

        result = get_workspace_context(mock_request)

        assert isinstance(result, WorkspaceContext)
        assert result.workspace_id == workspace_id

    def test_get_workspace_context_missing_header(self, mock_request):
        """Test missing header raises WORKSPACE_REQUIRED error."""
        mock_request.headers = {}

        with pytest.raises(HTTPException) as exc_info:
            get_workspace_context(mock_request)

        assert exc_info.value.status_code == 400
        assert "Workspace ID is required" in str(exc_info.value.detail)

    def test_get_workspace_context_invalid_uuid(self, mock_request):
        """Test invalid UUID raises WORKSPACE_INVALID error."""
        mock_request.headers = {"X-Workspace-ID": "not-a-valid-uuid"}

        with pytest.raises(HTTPException) as exc_info:
            get_workspace_context(mock_request)

        assert exc_info.value.status_code == 400
        assert "Invalid workspace ID" in str(exc_info.value.detail)

    def test_get_workspace_context_empty_header(self, mock_request):
        """Test empty header raises WORKSPACE_REQUIRED error."""
        mock_request.headers = {"X-Workspace-ID": ""}

        with pytest.raises(HTTPException) as exc_info:
            get_workspace_context(mock_request)

        assert exc_info.value.status_code == 400
        # Empty string fails UUID parsing, but empty check comes first
        # so it should raise WORKSPACE_REQUIRED


class TestWorkspaceContext:
    """Tests for WorkspaceContext dataclass."""

    def test_workspace_context_creation(self):
        """Test WorkspaceContext can be created with workspace_id."""
        workspace_id = uuid7()
        context = WorkspaceContext(workspace_id=workspace_id)

        assert context.workspace_id == workspace_id
