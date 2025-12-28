"""Docspell integration service."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select

from warehouse.domain.docspell.client import DocspellClient
from warehouse.domain.docspell.encryption import decrypt_password, encrypt_password
from warehouse.domain.docspell.models import WorkspaceDocspellSettings
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
    TagSyncResult,
)
from warehouse.domain.items.models import Attachment, AttachmentType, Item
from warehouse.errors import AppError, ErrorCode


class DocspellService:
    """Service for Docspell integration."""

    def __init__(self, repository: DocspellSettingsRepository):
        """Initialize service with repository.

        Args:
            repository: Docspell settings repository
        """
        self.repository = repository

    def _get_client(self, settings: WorkspaceDocspellSettings) -> DocspellClient:
        """Create Docspell client from settings.

        Args:
            settings: Workspace Docspell settings

        Returns:
            Configured Docspell client
        """
        password = decrypt_password(settings.password_encrypted)
        return DocspellClient(
            base_url=settings.base_url,
            collective=settings.collective_name,
            username=settings.username,
            password=password,
        )

    async def get_settings(self, workspace_id: UUID) -> DocspellSettingsResponse | None:
        """Get Docspell settings for workspace.

        Args:
            workspace_id: Workspace ID

        Returns:
            Settings response or None if not configured
        """
        settings = await self.repository.get_by_workspace(workspace_id)
        if not settings:
            return None
        return self._to_response(settings)

    async def create_settings(
        self, workspace_id: UUID, data: DocspellSettingsCreate
    ) -> DocspellSettingsResponse:
        """Create Docspell settings for workspace.

        Args:
            workspace_id: Workspace ID
            data: Settings creation data

        Returns:
            Created settings response

        Raises:
            AppError: If settings already exist
        """
        existing = await self.repository.get_by_workspace(workspace_id)
        if existing:
            raise AppError(ErrorCode.DOCSPELL_SETTINGS_EXISTS, status_code=400)

        settings = WorkspaceDocspellSettings(
            workspace_id=workspace_id,
            base_url=data.base_url,
            collective_name=data.collective_name,
            username=data.username,
            password_encrypted=encrypt_password(data.password),
            sync_tags_enabled=data.sync_tags_enabled,
        )
        settings = await self.repository.add(settings)
        await self.repository.session.commit()
        await self.repository.session.refresh(settings)
        return self._to_response(settings)

    async def update_settings(
        self, workspace_id: UUID, data: DocspellSettingsUpdate
    ) -> DocspellSettingsResponse:
        """Update Docspell settings.

        Args:
            workspace_id: Workspace ID
            data: Settings update data

        Returns:
            Updated settings response

        Raises:
            AppError: If settings not found
        """
        settings = await self.repository.get_by_workspace(workspace_id)
        if not settings:
            raise AppError(ErrorCode.DOCSPELL_SETTINGS_NOT_FOUND, status_code=404)

        if data.base_url is not None:
            settings.base_url = data.base_url
        if data.collective_name is not None:
            settings.collective_name = data.collective_name
        if data.username is not None:
            settings.username = data.username
        if data.password is not None:
            settings.password_encrypted = encrypt_password(data.password)
        if data.sync_tags_enabled is not None:
            settings.sync_tags_enabled = data.sync_tags_enabled
        if data.is_enabled is not None:
            settings.is_enabled = data.is_enabled

        await self.repository.session.commit()
        await self.repository.session.refresh(settings)
        return self._to_response(settings)

    async def delete_settings(self, workspace_id: UUID) -> bool:
        """Delete Docspell settings.

        Args:
            workspace_id: Workspace ID

        Returns:
            True if deleted

        Raises:
            AppError: If settings not found
        """
        settings = await self.repository.get_by_workspace(workspace_id)
        if not settings:
            raise AppError(ErrorCode.DOCSPELL_SETTINGS_NOT_FOUND, status_code=404)
        await self.repository.session.delete(settings)
        await self.repository.session.commit()
        return True

    async def test_connection(self, workspace_id: UUID) -> DocspellConnectionTest:
        """Test Docspell connection for workspace.

        Args:
            workspace_id: Workspace ID

        Returns:
            Connection test result
        """
        settings = await self.repository.get_by_workspace(workspace_id)
        if not settings:
            return DocspellConnectionTest(
                success=False, message="Docspell not configured"
            )

        client = self._get_client(settings)
        success, message, version = await client.test_connection()
        return DocspellConnectionTest(success=success, message=message, version=version)

    async def search_documents(
        self, workspace_id: UUID, query: str, limit: int = 20, offset: int = 0
    ) -> DocspellSearchResult:
        """Search for documents in Docspell.

        Args:
            workspace_id: Workspace ID
            query: Search query
            limit: Maximum results
            offset: Pagination offset

        Returns:
            Search results

        Raises:
            AppError: If Docspell not configured or disabled
        """
        settings = await self._get_enabled_settings(workspace_id)
        client = self._get_client(settings)
        return await client.search(query, limit, offset)

    async def get_document(
        self, workspace_id: UUID, document_id: str
    ) -> DocspellDocument | None:
        """Get a specific document from Docspell.

        Args:
            workspace_id: Workspace ID
            document_id: Docspell document ID

        Returns:
            Document if found, None otherwise

        Raises:
            AppError: If Docspell not configured or disabled
        """
        settings = await self._get_enabled_settings(workspace_id)
        client = self._get_client(settings)
        return await client.get_item(document_id)

    async def get_tags(self, workspace_id: UUID) -> list[DocspellTag]:
        """Get all tags from Docspell.

        Args:
            workspace_id: Workspace ID

        Returns:
            List of tags

        Raises:
            AppError: If Docspell not configured or disabled
        """
        settings = await self._get_enabled_settings(workspace_id)
        client = self._get_client(settings)
        return await client.get_tags()

    async def sync_tags(
        self, workspace_id: UUID, direction: str = "both"
    ) -> TagSyncResult:
        """Synchronize tags between Warehouse labels and Docspell tags.

        Args:
            workspace_id: Workspace ID
            direction: Sync direction ("to_docspell", "from_docspell", "both")

        Returns:
            Sync result with counts

        Raises:
            AppError: If Docspell not configured, disabled, or tag sync disabled
        """
        settings = await self._get_enabled_settings(workspace_id)
        if not settings.sync_tags_enabled:
            raise AppError(ErrorCode.DOCSPELL_TAG_SYNC_DISABLED, status_code=400)

        # Update last sync time
        settings.last_sync_at = datetime.now(UTC)
        await self.repository.session.commit()

        # TODO: Implement actual tag sync when labels repository is available
        # For now, return empty result
        return TagSyncResult(
            tags_created_in_warehouse=0,
            tags_created_in_docspell=0,
            tags_matched=0,
        )

    async def _get_enabled_settings(
        self, workspace_id: UUID
    ) -> WorkspaceDocspellSettings:
        """Get settings if enabled, raise error otherwise.

        Args:
            workspace_id: Workspace ID

        Returns:
            Enabled settings

        Raises:
            AppError: If not configured or disabled
        """
        settings = await self.repository.get_by_workspace(workspace_id)
        if not settings:
            raise AppError(ErrorCode.DOCSPELL_NOT_CONFIGURED, status_code=400)
        if not settings.is_enabled:
            raise AppError(ErrorCode.DOCSPELL_DISABLED, status_code=400)
        return settings

    def _to_response(
        self, settings: WorkspaceDocspellSettings
    ) -> DocspellSettingsResponse:
        """Convert model to response schema.

        Args:
            settings: Settings model

        Returns:
            Settings response (without password)
        """
        return DocspellSettingsResponse(
            id=settings.id,
            workspace_id=settings.workspace_id,
            base_url=settings.base_url,
            collective_name=settings.collective_name,
            username=settings.username,
            sync_tags_enabled=settings.sync_tags_enabled,
            is_enabled=settings.is_enabled,
            last_sync_at=settings.last_sync_at,
            created_at=settings.created_at,
            updated_at=settings.updated_at,
        )

    async def link_document(
        self, workspace_id: UUID, item_id: UUID, data: ItemDocspellLink
    ) -> AttachmentResponse:
        """Link a Docspell document to an item.

        Args:
            workspace_id: Workspace ID
            item_id: Item ID to link to
            data: Link data with docspell_item_id

        Returns:
            Created attachment response

        Raises:
            AppError: If item not found or Docspell not configured
        """
        # Verify Docspell is configured and enabled
        settings = await self._get_enabled_settings(workspace_id)

        # Verify item exists and belongs to workspace
        result = await self.repository.session.execute(
            select(Item).where(Item.id == item_id, Item.workspace_id == workspace_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)

        # Verify document exists in Docspell
        client = self._get_client(settings)
        doc = await client.get_item(data.docspell_item_id)
        if not doc:
            raise AppError(ErrorCode.DOCSPELL_DOCUMENT_NOT_FOUND, status_code=404)

        # Create attachment
        attachment_type = AttachmentType[data.attachment_type.upper()]
        attachment = Attachment(
            item_id=item_id,
            docspell_item_id=data.docspell_item_id,
            attachment_type=attachment_type,
            title=data.title or doc.name,
        )
        self.repository.session.add(attachment)
        await self.repository.session.commit()
        await self.repository.session.refresh(attachment)

        return AttachmentResponse(
            id=attachment.id,
            item_id=attachment.item_id,
            attachment_type=attachment.attachment_type.value,
            title=attachment.title,
            is_primary=attachment.is_primary,
            docspell_item_id=attachment.docspell_item_id,
            docspell_document=doc,
            created_at=attachment.created_at,
            updated_at=attachment.updated_at,
        )

    async def unlink_document(
        self, workspace_id: UUID, item_id: UUID, attachment_id: UUID
    ) -> bool:
        """Unlink a Docspell document from an item.

        Args:
            workspace_id: Workspace ID
            item_id: Item ID
            attachment_id: Attachment ID to remove

        Returns:
            True if deleted

        Raises:
            AppError: If attachment not found
        """
        # Verify item belongs to workspace
        result = await self.repository.session.execute(
            select(Item).where(Item.id == item_id, Item.workspace_id == workspace_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)

        # Get and delete attachment
        result = await self.repository.session.execute(
            select(Attachment).where(
                Attachment.id == attachment_id,
                Attachment.item_id == item_id,
                Attachment.docspell_item_id.isnot(None),
            )
        )
        attachment = result.scalar_one_or_none()
        if not attachment:
            raise AppError(ErrorCode.ATTACHMENT_NOT_FOUND, status_code=404)

        await self.repository.session.delete(attachment)
        await self.repository.session.commit()
        return True

    async def get_item_attachments(
        self, workspace_id: UUID, item_id: UUID
    ) -> list[AttachmentResponse]:
        """Get all Docspell attachments for an item.

        Args:
            workspace_id: Workspace ID
            item_id: Item ID

        Returns:
            List of attachments with Docspell document details
        """
        # Verify item belongs to workspace
        result = await self.repository.session.execute(
            select(Item).where(Item.id == item_id, Item.workspace_id == workspace_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise AppError(ErrorCode.ITEM_NOT_FOUND, status_code=404)

        # Get attachments with docspell links
        result = await self.repository.session.execute(
            select(Attachment).where(
                Attachment.item_id == item_id,
                Attachment.docspell_item_id.isnot(None),
            )
        )
        attachments = result.scalars().all()

        # Try to fetch Docspell document details if configured
        settings = await self.repository.get_by_workspace(workspace_id)
        client = self._get_client(settings) if settings and settings.is_enabled else None

        responses = []
        for att in attachments:
            doc = None
            if client and att.docspell_item_id:
                try:
                    doc = await client.get_item(att.docspell_item_id)
                except Exception:
                    pass  # Docspell may be unavailable

            responses.append(
                AttachmentResponse(
                    id=att.id,
                    item_id=att.item_id,
                    attachment_type=att.attachment_type.value,
                    title=att.title,
                    is_primary=att.is_primary,
                    docspell_item_id=att.docspell_item_id,
                    docspell_document=doc,
                    created_at=att.created_at,
                    updated_at=att.updated_at,
                )
            )

        return responses
