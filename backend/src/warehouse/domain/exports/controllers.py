"""Export domain controllers."""

from datetime import UTC, datetime

from litestar import get
from litestar.controller import Controller
from litestar.di import Provide
from litestar.response import Response
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.exports.schemas import ExportFormat
from warehouse.domain.exports.service import ExportService
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context


def get_export_service(db_session: AsyncSession) -> ExportService:
    """Dependency for export service."""
    return ExportService(session=db_session)


class ExportController(Controller):
    """Export controller."""

    path = "/exports"
    dependencies = {
        "export_service": Provide(get_export_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @get("/workspace")
    async def export_workspace(
        self,
        export_service: ExportService,
        workspace: WorkspaceContext,
        format: str = "xlsx",
    ) -> Response:
        """
        Export all workspace data.

        Query params:
            format: 'xlsx' or 'json' (default: xlsx)
        """
        export_format = ExportFormat(format.lower()) if format else ExportFormat.XLSX

        if export_format == ExportFormat.XLSX:
            file_bytes, _ = await export_service.export_workspace_xlsx(
                workspace.workspace_id, workspace.user_id
            )
            timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
            filename = f"warehouse_export_{timestamp}.xlsx"
            return Response(
                content=file_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                },
            )
        else:
            export_data, _ = await export_service.export_workspace_json(
                workspace.workspace_id, workspace.user_id
            )
            timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
            filename = f"warehouse_export_{timestamp}.json"
            return Response(
                content=export_data,
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                },
            )
