"""Docspell integration schemas."""

from datetime import datetime
from uuid import UUID

import msgspec


class DocspellSettingsCreate(msgspec.Struct):
    """Schema for creating Docspell settings."""

    base_url: str
    collective_name: str
    username: str
    password: str
    sync_tags_enabled: bool = False


class DocspellSettingsUpdate(msgspec.Struct):
    """Schema for updating Docspell settings."""

    base_url: str | None = None
    collective_name: str | None = None
    username: str | None = None
    password: str | None = None
    sync_tags_enabled: bool | None = None
    is_enabled: bool | None = None


class DocspellSettingsResponse(msgspec.Struct):
    """Schema for Docspell settings response (password excluded)."""

    id: UUID
    workspace_id: UUID
    base_url: str
    collective_name: str
    username: str
    sync_tags_enabled: bool
    is_enabled: bool
    last_sync_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DocspellConnectionTest(msgspec.Struct):
    """Result of testing Docspell connection."""

    success: bool
    message: str
    version: str | None = None


class DocspellDocument(msgspec.Struct):
    """Docspell document (item) representation."""

    id: str
    name: str
    date: str | None = None
    correspondent: str | None = None
    tags: list[str] = []
    preview_url: str | None = None
    detail_url: str | None = None


class DocspellSearchResult(msgspec.Struct):
    """Docspell search results."""

    items: list[DocspellDocument]
    total: int


class DocspellTag(msgspec.Struct):
    """Docspell tag representation."""

    id: str
    name: str
    category: str | None = None


class ItemDocspellLink(msgspec.Struct):
    """Schema for linking an item to a Docspell document."""

    docspell_item_id: str
    attachment_type: str = "OTHER"
    title: str | None = None


class AttachmentResponse(msgspec.Struct, kw_only=True):
    """Response schema for an attachment."""

    id: UUID
    item_id: UUID
    attachment_type: str
    title: str | None
    is_primary: bool
    docspell_item_id: str | None
    created_at: datetime
    updated_at: datetime
    docspell_document: DocspellDocument | None = None


class TagSyncRequest(msgspec.Struct):
    """Request to sync tags."""

    direction: str = "both"


class TagSyncResult(msgspec.Struct):
    """Result of tag synchronization."""

    tags_created_in_warehouse: int
    tags_created_in_docspell: int
    tags_matched: int
    errors: list[str] = []
