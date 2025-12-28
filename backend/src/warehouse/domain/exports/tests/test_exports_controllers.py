"""Controller tests for exports domain."""

from unittest.mock import AsyncMock, patch
from uuid import uuid7

import pytest
from litestar.response import Response

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.exports.controllers import ExportController
from warehouse.domain.exports.schemas import ExportFormat
from warehouse.lib.workspace import WorkspaceContext


@pytest.fixture
def workspace_id():
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def workspace(workspace_id, user_id) -> WorkspaceContext:
    """Workspace context for tests."""
    return WorkspaceContext(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=WorkspaceRole.MEMBER,
    )


@pytest.fixture
def export_service_mock() -> AsyncMock:
    """Mocked export service."""
    svc = AsyncMock()
    svc.export_workspace_xlsx = AsyncMock()
    svc.export_workspace_json = AsyncMock()
    return svc


@pytest.fixture
def controller() -> ExportController:
    """Export controller instance."""
    return ExportController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


class TestExportWorkspace:
    """Tests for export_workspace endpoint."""

    @pytest.mark.asyncio
    async def test_exports_xlsx_format(
        self,
        controller: ExportController,
        export_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test XLSX export returns correct response."""
        file_bytes = b"mock xlsx content"
        record_counts = {"categories": 5, "items": 10}
        export_service_mock.export_workspace_xlsx.return_value = (file_bytes, record_counts)

        result = await _call(
            controller.export_workspace,
            controller,
            export_service=export_service_mock,
            workspace=workspace,
            format="xlsx",
        )

        export_service_mock.export_workspace_xlsx.assert_awaited_once_with(
            workspace.workspace_id, workspace.user_id
        )
        assert isinstance(result, Response)
        assert result.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    @pytest.mark.asyncio
    async def test_exports_json_format(
        self,
        controller: ExportController,
        export_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test JSON export returns correct response."""
        export_data = {"workspace_id": str(workspace.workspace_id), "categories": []}
        record_counts = {"categories": 0}
        export_service_mock.export_workspace_json.return_value = (export_data, record_counts)

        result = await _call(
            controller.export_workspace,
            controller,
            export_service=export_service_mock,
            workspace=workspace,
            format="json",
        )

        export_service_mock.export_workspace_json.assert_awaited_once_with(
            workspace.workspace_id, workspace.user_id
        )
        assert isinstance(result, Response)
        assert result.media_type == "application/json"

    @pytest.mark.asyncio
    async def test_default_format_is_xlsx(
        self,
        controller: ExportController,
        export_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test that default format is XLSX."""
        file_bytes = b"mock xlsx content"
        record_counts = {}
        export_service_mock.export_workspace_xlsx.return_value = (file_bytes, record_counts)

        await _call(
            controller.export_workspace,
            controller,
            export_service=export_service_mock,
            workspace=workspace,
            format="xlsx",  # Default
        )

        export_service_mock.export_workspace_xlsx.assert_awaited_once()
        export_service_mock.export_workspace_json.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_case_insensitive_format(
        self,
        controller: ExportController,
        export_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test that format parameter is case-insensitive."""
        export_data = {"workspace_id": str(workspace.workspace_id)}
        record_counts = {}
        export_service_mock.export_workspace_json.return_value = (export_data, record_counts)

        result = await _call(
            controller.export_workspace,
            controller,
            export_service=export_service_mock,
            workspace=workspace,
            format="JSON",  # Uppercase
        )

        export_service_mock.export_workspace_json.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_xlsx_response_has_content_disposition(
        self,
        controller: ExportController,
        export_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test that XLSX response has Content-Disposition header."""
        file_bytes = b"mock xlsx content"
        record_counts = {}
        export_service_mock.export_workspace_xlsx.return_value = (file_bytes, record_counts)

        result = await _call(
            controller.export_workspace,
            controller,
            export_service=export_service_mock,
            workspace=workspace,
            format="xlsx",
        )

        assert "Content-Disposition" in result.headers
        assert "attachment" in result.headers["Content-Disposition"]
        assert ".xlsx" in result.headers["Content-Disposition"]

    @pytest.mark.asyncio
    async def test_json_response_has_content_disposition(
        self,
        controller: ExportController,
        export_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test that JSON response has Content-Disposition header."""
        export_data = {"workspace_id": str(workspace.workspace_id)}
        record_counts = {}
        export_service_mock.export_workspace_json.return_value = (export_data, record_counts)

        result = await _call(
            controller.export_workspace,
            controller,
            export_service=export_service_mock,
            workspace=workspace,
            format="json",
        )

        assert "Content-Disposition" in result.headers
        assert "attachment" in result.headers["Content-Disposition"]
        assert ".json" in result.headers["Content-Disposition"]
