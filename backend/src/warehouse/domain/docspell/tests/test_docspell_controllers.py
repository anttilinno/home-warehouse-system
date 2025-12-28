"""Tests for the Docspell domain controllers."""

from datetime import datetime, timezone
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock

import pytest

from warehouse.domain.docspell.controllers import DocspellController, get_docspell_service
from warehouse.domain.docspell.schemas import (
    DocspellConnectionTest,
    DocspellDocument,
    DocspellSearchResult,
    DocspellSettingsCreate,
    DocspellSettingsResponse,
    DocspellSettingsUpdate,
    DocspellTag,
    TagSyncRequest,
    TagSyncResult,
)
from warehouse.lib.workspace import WorkspaceContext
from warehouse.domain.auth.models import WorkspaceRole
from warehouse.errors import AppError, ErrorCode


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
def service_mock():
    """Mock docspell service."""
    return AsyncMock()


@pytest.fixture
def controller():
    """Create a controller instance."""
    return DocspellController(owner=None)


@pytest.fixture
def sample_settings_response(workspace_id):
    """Sample settings response."""
    return DocspellSettingsResponse(
        id=uuid7(),
        workspace_id=workspace_id,
        base_url="http://localhost:7880",
        collective_name="test-collective",
        username="testuser",
        sync_tags_enabled=False,
        is_enabled=True,
        last_sync_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


class TestDocspellControllerGetSettings:
    """Tests for get_settings endpoint."""

    async def test_get_settings_returns_none(
        self, controller, service_mock, workspace_context
    ):
        """Test getting settings when none exist."""
        service_mock.get_settings.return_value = None

        result = await _call(
            controller.get_settings,
            controller,
            service=service_mock,
            workspace=workspace_context,
        )

        assert result is None
        service_mock.get_settings.assert_called_once_with(workspace_context.workspace_id)

    async def test_get_settings_returns_data(
        self, controller, service_mock, workspace_context, sample_settings_response
    ):
        """Test getting existing settings."""
        service_mock.get_settings.return_value = sample_settings_response

        result = await _call(
            controller.get_settings,
            controller,
            service=service_mock,
            workspace=workspace_context,
        )

        assert result == sample_settings_response


class TestDocspellControllerCreateSettings:
    """Tests for create_settings endpoint."""

    async def test_create_settings_success(
        self, controller, service_mock, workspace_context, sample_settings_response
    ):
        """Test creating settings successfully."""
        service_mock.create_settings.return_value = sample_settings_response

        data = DocspellSettingsCreate(
            base_url="http://localhost:7880",
            collective_name="test-collective",
            username="testuser",
            password="testpass",
        )

        result = await _call(
            controller.create_settings,
            controller,
            data=data,
            service=service_mock,
            workspace=workspace_context,
        )

        assert result == sample_settings_response
        service_mock.create_settings.assert_called_once_with(
            workspace_context.workspace_id, data
        )

    async def test_create_settings_already_exists(
        self, controller, service_mock, workspace_context
    ):
        """Test creating settings when they already exist."""
        service_mock.create_settings.side_effect = AppError(
            ErrorCode.DOCSPELL_SETTINGS_EXISTS, status_code=400
        )

        data = DocspellSettingsCreate(
            base_url="http://localhost:7880",
            collective_name="test",
            username="user",
            password="pass",
        )

        with pytest.raises(Exception):  # HTTPException
            await _call(
                controller.create_settings,
                controller,
                data=data,
                service=service_mock,
                workspace=workspace_context,
            )


class TestDocspellControllerUpdateSettings:
    """Tests for update_settings endpoint."""

    async def test_update_settings_success(
        self, controller, service_mock, workspace_context, sample_settings_response
    ):
        """Test updating settings successfully."""
        updated_response = sample_settings_response
        service_mock.update_settings.return_value = updated_response

        data = DocspellSettingsUpdate(sync_tags_enabled=True)

        result = await _call(
            controller.update_settings,
            controller,
            data=data,
            service=service_mock,
            workspace=workspace_context,
        )

        assert result == updated_response


class TestDocspellControllerDeleteSettings:
    """Tests for delete_settings endpoint."""

    async def test_delete_settings_success(
        self, controller, service_mock, workspace_context
    ):
        """Test deleting settings successfully."""
        service_mock.delete_settings.return_value = True

        result = await _call(
            controller.delete_settings,
            controller,
            service=service_mock,
            workspace=workspace_context,
        )

        assert result is None  # 204 No Content
        service_mock.delete_settings.assert_called_once_with(
            workspace_context.workspace_id
        )


class TestDocspellControllerTestConnection:
    """Tests for test_connection endpoint."""

    async def test_connection_success(
        self, controller, service_mock, workspace_context
    ):
        """Test successful connection test."""
        service_mock.test_connection.return_value = DocspellConnectionTest(
            success=True,
            message="Connection successful",
            version="0.42.0",
        )

        result = await _call(
            controller.test_connection,
            controller,
            service=service_mock,
            workspace=workspace_context,
        )

        assert result.success is True
        assert result.version == "0.42.0"

    async def test_connection_not_configured(
        self, controller, service_mock, workspace_context
    ):
        """Test connection when not configured."""
        service_mock.test_connection.return_value = DocspellConnectionTest(
            success=False,
            message="Docspell not configured",
        )

        result = await _call(
            controller.test_connection,
            controller,
            service=service_mock,
            workspace=workspace_context,
        )

        assert result.success is False


class TestDocspellControllerSearch:
    """Tests for search_documents endpoint."""

    async def test_search_returns_results(
        self, controller, service_mock, workspace_context
    ):
        """Test search returns documents."""
        service_mock.search_documents.return_value = DocspellSearchResult(
            items=[
                DocspellDocument(
                    id="doc-1",
                    name="Invoice",
                    tags=["invoice"],
                ),
            ],
            total=1,
        )

        result = await _call(
            controller.search_documents,
            controller,
            service=service_mock,
            workspace=workspace_context,
            q="invoice",
            limit=20,
            offset=0,
        )

        assert result.total == 1
        assert len(result.items) == 1
        assert result.items[0].name == "Invoice"


class TestDocspellControllerGetDocument:
    """Tests for get_document endpoint."""

    async def test_get_document_found(
        self, controller, service_mock, workspace_context
    ):
        """Test getting an existing document."""
        service_mock.get_document.return_value = DocspellDocument(
            id="doc-123",
            name="My Document",
            tags=["receipt"],
        )

        result = await _call(
            controller.get_document,
            controller,
            document_id="doc-123",
            service=service_mock,
            workspace=workspace_context,
        )

        assert result is not None
        assert result.id == "doc-123"

    async def test_get_document_not_found(
        self, controller, service_mock, workspace_context
    ):
        """Test getting a non-existent document."""
        service_mock.get_document.return_value = None

        result = await _call(
            controller.get_document,
            controller,
            document_id="non-existent",
            service=service_mock,
            workspace=workspace_context,
        )

        assert result is None


class TestDocspellControllerGetTags:
    """Tests for get_tags endpoint."""

    async def test_get_tags_returns_list(
        self, controller, service_mock, workspace_context
    ):
        """Test getting tags."""
        service_mock.get_tags.return_value = [
            DocspellTag(id="tag-1", name="invoice"),
            DocspellTag(id="tag-2", name="receipt", category="document-type"),
        ]

        result = await _call(
            controller.get_tags,
            controller,
            service=service_mock,
            workspace=workspace_context,
        )

        assert len(result) == 2
        assert result[0].name == "invoice"
        assert result[1].category == "document-type"


class TestDocspellControllerSyncTags:
    """Tests for sync_tags endpoint."""

    async def test_sync_tags_success(
        self, controller, service_mock, workspace_context
    ):
        """Test syncing tags."""
        service_mock.sync_tags.return_value = TagSyncResult(
            tags_created_in_warehouse=2,
            tags_created_in_docspell=1,
            tags_matched=5,
            errors=[],
        )

        result = await _call(
            controller.sync_tags,
            controller,
            data=TagSyncRequest(direction="both"),
            service=service_mock,
            workspace=workspace_context,
        )

        assert result.tags_created_in_warehouse == 2
        assert result.tags_matched == 5


class TestGetDocspellService:
    """Tests for service dependency."""

    def test_creates_service(self):
        """Test that dependency creates service."""
        mock_session = MagicMock()

        service = get_docspell_service(mock_session)

        assert service is not None
        assert service.repository is not None
