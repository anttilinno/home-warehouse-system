"""Docspell integration controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.params import Parameter
from litestar.status_codes import HTTP_201_CREATED, HTTP_204_NO_CONTENT
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.docspell.repository import DocspellSettingsRepository
from warehouse.domain.docspell.schemas import (
    AttachmentResponse,
    DocspellConnectionTest,
    DocspellDocument,
    DocspellSearchResult,
    DocspellSettingsCreate,
    DocspellSettingsResponse,
    DocspellSettingsUpdate,
    DocspellTag,
    ItemDocspellLink,
    TagSyncRequest,
    TagSyncResult,
)
from warehouse.domain.docspell.service import DocspellService
from warehouse.errors import AppError
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context


def get_docspell_service(db_session: AsyncSession) -> DocspellService:
    """Dependency for Docspell service."""
    repository = DocspellSettingsRepository(session=db_session)
    return DocspellService(repository)


class DocspellController(Controller):
    """Docspell integration controller."""

    path = "/docspell"
    dependencies = {
        "service": Provide(get_docspell_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @get("/settings")
    async def get_settings(
        self,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> DocspellSettingsResponse | None:
        """Get Docspell settings for current workspace."""
        return await service.get_settings(workspace.workspace_id)

    @post("/settings", status_code=HTTP_201_CREATED)
    async def create_settings(
        self,
        data: DocspellSettingsCreate,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> DocspellSettingsResponse:
        """Create Docspell settings for current workspace."""
        try:
            return await service.create_settings(workspace.workspace_id, data)
        except AppError as e:
            raise e.to_http_exception()

    @patch("/settings")
    async def update_settings(
        self,
        data: DocspellSettingsUpdate,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> DocspellSettingsResponse:
        """Update Docspell settings for current workspace."""
        try:
            return await service.update_settings(workspace.workspace_id, data)
        except AppError as e:
            raise e.to_http_exception()

    @delete("/settings", status_code=HTTP_204_NO_CONTENT)
    async def delete_settings(
        self,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete Docspell settings for current workspace."""
        try:
            await service.delete_settings(workspace.workspace_id)
        except AppError as e:
            raise e.to_http_exception()

    @get("/test")
    async def test_connection(
        self,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> DocspellConnectionTest:
        """Test Docspell connection for current workspace."""
        return await service.test_connection(workspace.workspace_id)

    @get("/search")
    async def search_documents(
        self,
        service: DocspellService,
        workspace: WorkspaceContext,
        q: str = Parameter(query="q", default=""),
        limit: int = Parameter(query="limit", default=20, ge=1, le=100),
        offset: int = Parameter(query="offset", default=0, ge=0),
    ) -> DocspellSearchResult:
        """Search for documents in Docspell."""
        try:
            return await service.search_documents(
                workspace.workspace_id, q, limit, offset
            )
        except AppError as e:
            raise e.to_http_exception()

    @get("/documents/{document_id:str}")
    async def get_document(
        self,
        document_id: str,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> DocspellDocument | None:
        """Get a specific document from Docspell."""
        try:
            return await service.get_document(workspace.workspace_id, document_id)
        except AppError as e:
            raise e.to_http_exception()

    @get("/tags")
    async def get_tags(
        self,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> list[DocspellTag]:
        """Get all tags from Docspell."""
        try:
            return await service.get_tags(workspace.workspace_id)
        except AppError as e:
            raise e.to_http_exception()

    @post("/tags/sync")
    async def sync_tags(
        self,
        data: TagSyncRequest,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> TagSyncResult:
        """Synchronize tags between Warehouse and Docspell."""
        try:
            return await service.sync_tags(workspace.workspace_id, data.direction)
        except AppError as e:
            raise e.to_http_exception()

    # Item-Document Linking Endpoints

    @get("/items/{item_id:uuid}/attachments")
    async def get_item_attachments(
        self,
        item_id: UUID,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> list[AttachmentResponse]:
        """Get all Docspell attachments for an item."""
        try:
            return await service.get_item_attachments(workspace.workspace_id, item_id)
        except AppError as e:
            raise e.to_http_exception()

    @post("/items/{item_id:uuid}/attachments", status_code=HTTP_201_CREATED)
    async def link_document(
        self,
        item_id: UUID,
        data: ItemDocspellLink,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> AttachmentResponse:
        """Link a Docspell document to an item."""
        try:
            return await service.link_document(workspace.workspace_id, item_id, data)
        except AppError as e:
            raise e.to_http_exception()

    @delete("/items/{item_id:uuid}/attachments/{attachment_id:uuid}", status_code=HTTP_204_NO_CONTENT)
    async def unlink_document(
        self,
        item_id: UUID,
        attachment_id: UUID,
        service: DocspellService,
        workspace: WorkspaceContext,
    ) -> None:
        """Unlink a Docspell document from an item."""
        try:
            await service.unlink_document(workspace.workspace_id, item_id, attachment_id)
        except AppError as e:
            raise e.to_http_exception()
