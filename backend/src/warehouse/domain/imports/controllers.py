"""Import domain controllers."""

from litestar import Controller, get, post, Request
from litestar.datastructures import UploadFile
from litestar.di import Provide
from litestar.enums import RequestEncodingType
from litestar.params import Body, Parameter
from litestar.status_codes import HTTP_200_OK
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.imports.barcode import lookup_barcode
from warehouse.domain.imports.parsers import parse_file
from warehouse.domain.imports.schemas import (
    BarcodeNotFound,
    BarcodeProduct,
    EntityType,
    ImportResult,
)
from warehouse.domain.imports.service import ImportService
from warehouse.lib.workspace import get_workspace_context, WorkspaceContext


def get_import_service(db_session: AsyncSession) -> ImportService:
    """Dependency for import service."""
    return ImportService(session=db_session)


class ImportController(Controller):
    """Import controller for bulk data import operations."""

    path = "/imports"
    dependencies = {
        "import_service": Provide(get_import_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @post("/upload", status_code=HTTP_200_OK)
    async def upload_file(
        self,
        request: Request,
        import_service: ImportService,
        workspace: WorkspaceContext,
        data: UploadFile = Body(media_type=RequestEncodingType.MULTI_PART),
        entity_type: str = Parameter(query="entity_type"),
    ) -> ImportResult:
        """Upload and import a CSV or Excel file.

        Args:
            data: Uploaded file (CSV or Excel)
            entity_type: Type of entity to import (categories, locations, etc.)

        Returns:
            ImportResult with counts and errors
        """
        # Validate entity type
        try:
            entity = EntityType(entity_type)
        except ValueError:
            return ImportResult(
                entity_type=entity_type,
                total_rows=0,
                created=0,
                updated=0,
                skipped=0,
                errors=[{"row": 0, "field": None, "message": f"Invalid entity type: {entity_type}"}],
            )

        # Read and parse file
        content = await data.read()
        filename = data.filename or "unknown.csv"

        try:
            rows = parse_file(content, filename)
        except ValueError as e:
            return ImportResult(
                entity_type=entity_type,
                total_rows=0,
                created=0,
                updated=0,
                skipped=0,
                errors=[{"row": 0, "field": None, "message": str(e)}],
            )

        # Import the data
        result = await import_service.import_data(entity, rows, workspace.workspace_id)
        return result

    @get("/barcode/{barcode:str}")
    async def barcode_lookup(
        self,
        barcode: str,
    ) -> BarcodeProduct | BarcodeNotFound:
        """Look up product information by barcode.

        Uses Open Food Facts and UPC Item DB APIs.

        Args:
            barcode: Product barcode (EAN/UPC)

        Returns:
            BarcodeProduct if found, BarcodeNotFound otherwise
        """
        return await lookup_barcode(barcode)
