"""Controller tests for imports domain."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid7

import pytest

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.imports.controllers import ImportController
from warehouse.domain.imports.schemas import (
    BarcodeNotFound,
    BarcodeProduct,
    EntityType,
    ImportError,
    ImportResult,
)
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
def import_service_mock() -> AsyncMock:
    """Mocked import service."""
    svc = AsyncMock()
    svc.import_data = AsyncMock()
    return svc


@pytest.fixture
def controller() -> ImportController:
    """Import controller instance."""
    return ImportController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


def _mock_upload_file(filename: str, content: bytes):
    """Create a mock UploadFile."""
    mock_file = AsyncMock()
    mock_file.filename = filename
    mock_file.read = AsyncMock(return_value=content)
    return mock_file


class TestUploadFile:
    """Tests for upload_file endpoint."""

    @pytest.mark.asyncio
    async def test_successful_import(
        self,
        controller: ImportController,
        import_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test successful file import."""
        expected_result = ImportResult(
            entity_type="categories",
            total_rows=5,
            created=4,
            updated=0,
            skipped=1,
            errors=[],
        )
        import_service_mock.import_data.return_value = expected_result

        mock_file = _mock_upload_file("categories.csv", b"name\nElectronics")
        mock_request = MagicMock()

        with patch(
            "warehouse.domain.imports.controllers.parse_file"
        ) as mock_parse:
            mock_parse.return_value = [{"name": "Electronics"}]

            result = await _call(
                controller.upload_file,
                controller,
                request=mock_request,
                import_service=import_service_mock,
                workspace=workspace,
                data=mock_file,
                entity_type="categories",
            )

        assert result.created == 4
        assert result.skipped == 1

    @pytest.mark.asyncio
    async def test_invalid_entity_type(
        self,
        controller: ImportController,
        import_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test import with invalid entity type."""
        mock_file = _mock_upload_file("data.csv", b"name\nTest")
        mock_request = MagicMock()

        result = await _call(
            controller.upload_file,
            controller,
            request=mock_request,
            import_service=import_service_mock,
            workspace=workspace,
            data=mock_file,
            entity_type="invalid_type",
        )

        assert len(result.errors) == 1
        assert "Invalid entity type" in str(result.errors[0])

    @pytest.mark.asyncio
    async def test_parse_error(
        self,
        controller: ImportController,
        import_service_mock: AsyncMock,
        workspace: WorkspaceContext,
    ):
        """Test import with file parse error."""
        mock_file = _mock_upload_file("data.txt", b"invalid content")
        mock_request = MagicMock()

        with patch(
            "warehouse.domain.imports.controllers.parse_file"
        ) as mock_parse:
            mock_parse.side_effect = ValueError("Unsupported file type")

            result = await _call(
                controller.upload_file,
                controller,
                request=mock_request,
                import_service=import_service_mock,
                workspace=workspace,
                data=mock_file,
                entity_type="categories",
            )

        assert len(result.errors) == 1
        assert "Unsupported file type" in str(result.errors[0])


class TestBarcodeLookup:
    """Tests for barcode_lookup endpoint."""

    @pytest.mark.asyncio
    async def test_returns_product_when_found(
        self,
        controller: ImportController,
    ):
        """Test barcode lookup returns product when found."""
        expected_product = BarcodeProduct(
            barcode="1234567890123",
            name="Test Product",
            brand="Test Brand",
            category="Electronics",
            description="A test product",
            image_url="https://example.com/image.jpg",
            source="openfoodfacts",
        )

        with patch(
            "warehouse.domain.imports.controllers.lookup_barcode",
            new_callable=AsyncMock,
        ) as mock_lookup:
            mock_lookup.return_value = expected_product

            result = await _call(
                controller.barcode_lookup,
                controller,
                barcode="1234567890123",
            )

        assert isinstance(result, BarcodeProduct)
        assert result.name == "Test Product"
        assert result.barcode == "1234567890123"

    @pytest.mark.asyncio
    async def test_returns_not_found_when_missing(
        self,
        controller: ImportController,
    ):
        """Test barcode lookup returns not found when product missing."""
        expected_not_found = BarcodeNotFound(barcode="0000000000000")

        with patch(
            "warehouse.domain.imports.controllers.lookup_barcode",
            new_callable=AsyncMock,
        ) as mock_lookup:
            mock_lookup.return_value = expected_not_found

            result = await _call(
                controller.barcode_lookup,
                controller,
                barcode="0000000000000",
            )

        assert isinstance(result, BarcodeNotFound)
        assert result.found is False
        assert result.barcode == "0000000000000"
