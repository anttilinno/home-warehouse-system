"""Tests for sync domain controllers."""

import datetime
from datetime import UTC
from unittest.mock import AsyncMock
from uuid import uuid7

import pytest

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.sync.controllers import SyncController
from warehouse.domain.sync.schemas import (
    BatchOperation,
    BatchOperationResult,
    BatchRequest,
    BatchResponse,
    SyncMetadata,
    SyncResponse,
)
from warehouse.lib.workspace import WorkspaceContext


@pytest.fixture
def workspace_id():
    """A sample workspace ID."""
    return uuid7()


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def workspace_context(workspace_id, user_id):
    """Create a workspace context."""
    return WorkspaceContext(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=WorkspaceRole.OWNER,
    )


@pytest.fixture
def viewer_context(workspace_id, user_id):
    """Create a viewer workspace context."""
    return WorkspaceContext(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=WorkspaceRole.VIEWER,
    )


@pytest.fixture
def mock_sync_service():
    """Create mock sync service."""
    return AsyncMock()


@pytest.fixture
def sync_controller():
    """Create sync controller instance."""
    return SyncController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


class TestGetDeltaController:
    """Tests for GET /sync/delta endpoint logic."""

    async def test_get_delta_calls_service(
        self,
        sync_controller: SyncController,
        mock_sync_service: AsyncMock,
        workspace_context: WorkspaceContext,
    ):
        """Test that get_delta controller calls service correctly."""
        expected_response = SyncResponse(
            metadata=SyncMetadata(
                server_time=datetime.datetime.now(UTC),
                has_more=False,
                next_cursor=None,
            ),
            items=[{"id": str(uuid7()), "name": "Test Item", "sku": "SKU-001"}],
            locations=[],
            containers=[],
            categories=[],
            inventory=[],
            loans=[],
            borrowers=[],
            deleted=[],
        )
        mock_sync_service.get_delta.return_value = expected_response

        result = await _call(
            SyncController.get_delta,
            sync_controller,
            sync_service=mock_sync_service,
            workspace=workspace_context,
            modified_since=None,
            entity_types=None,
            limit=500,
        )

        assert result == expected_response
        mock_sync_service.get_delta.assert_called_once_with(
            workspace_id=workspace_context.workspace_id,
            modified_since=None,
            entity_types=None,
            limit=500,
        )

    async def test_get_delta_parses_entity_types(
        self,
        sync_controller: SyncController,
        mock_sync_service: AsyncMock,
        workspace_context: WorkspaceContext,
    ):
        """Test that entity_types string is parsed to list."""
        expected_response = SyncResponse(
            metadata=SyncMetadata(
                server_time=datetime.datetime.now(UTC),
                has_more=False,
            ),
            items=[],
            locations=[],
            containers=[],
            categories=[],
            inventory=[],
            loans=[],
            borrowers=[],
            deleted=[],
        )
        mock_sync_service.get_delta.return_value = expected_response

        await _call(
            SyncController.get_delta,
            sync_controller,
            sync_service=mock_sync_service,
            workspace=workspace_context,
            modified_since=None,
            entity_types="item,location,container",
            limit=500,
        )

        mock_sync_service.get_delta.assert_called_once_with(
            workspace_id=workspace_context.workspace_id,
            modified_since=None,
            entity_types=["item", "location", "container"],
            limit=500,
        )

    async def test_get_delta_passes_modified_since(
        self,
        sync_controller: SyncController,
        mock_sync_service: AsyncMock,
        workspace_context: WorkspaceContext,
    ):
        """Test that modified_since is passed to service."""
        modified_since = datetime.datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)
        expected_response = SyncResponse(
            metadata=SyncMetadata(
                server_time=datetime.datetime.now(UTC),
                has_more=False,
            ),
            items=[],
            locations=[],
            containers=[],
            categories=[],
            inventory=[],
            loans=[],
            borrowers=[],
            deleted=[],
        )
        mock_sync_service.get_delta.return_value = expected_response

        await _call(
            SyncController.get_delta,
            sync_controller,
            sync_service=mock_sync_service,
            workspace=workspace_context,
            modified_since=modified_since,
            entity_types=None,
            limit=100,
        )

        mock_sync_service.get_delta.assert_called_once_with(
            workspace_id=workspace_context.workspace_id,
            modified_since=modified_since,
            entity_types=None,
            limit=100,
        )


class TestBatchOperationsController:
    """Tests for POST /sync/batch endpoint logic."""

    async def test_batch_operations_calls_service(
        self,
        sync_controller: SyncController,
        mock_sync_service: AsyncMock,
        workspace_context: WorkspaceContext,
    ):
        """Test that batch_operations controller calls service correctly."""
        expected_response = BatchResponse(
            success=True,
            results=[
                BatchOperationResult(
                    index=0,
                    success=True,
                    id=uuid7(),
                )
            ],
            succeeded_count=1,
            failed_count=0,
        )
        mock_sync_service.process_batch.return_value = expected_response

        request = BatchRequest(
            operations=[
                BatchOperation(
                    operation="create",
                    entity_type="item",
                    data={"sku": "NEW-001", "name": "New Item"},
                )
            ],
        )

        result = await _call(
            SyncController.batch_operations,
            sync_controller,
            data=request,
            sync_service=mock_sync_service,
            workspace=workspace_context,
        )

        assert result == expected_response
        mock_sync_service.process_batch.assert_called_once_with(
            workspace_id=workspace_context.workspace_id,
            user_id=workspace_context.user_id,
            request=request,
        )

    async def test_batch_operations_requires_write_permission(
        self,
        sync_controller: SyncController,
        mock_sync_service: AsyncMock,
        viewer_context: WorkspaceContext,
    ):
        """Test that batch operations require write permission."""
        from litestar.exceptions import HTTPException

        request = BatchRequest(
            operations=[
                BatchOperation(
                    operation="create",
                    entity_type="item",
                    data={"sku": "NEW-001", "name": "New Item"},
                )
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await _call(
                SyncController.batch_operations,
                sync_controller,
                data=request,
                sync_service=mock_sync_service,
                workspace=viewer_context,
            )

        assert exc_info.value.status_code == 403
        mock_sync_service.process_batch.assert_not_called()
