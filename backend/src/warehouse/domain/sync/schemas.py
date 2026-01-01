"""Sync domain schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

import msgspec


class DeletedRecordResponse(msgspec.Struct):
    """Schema for deleted record response."""

    entity_type: str
    entity_id: UUID
    deleted_at: datetime


class SyncMetadata(msgspec.Struct):
    """Metadata for sync response."""

    server_time: datetime
    has_more: bool
    next_cursor: datetime | None = None


class SyncResponse(msgspec.Struct):
    """Response for delta sync."""

    metadata: SyncMetadata
    items: list[Any]
    locations: list[Any]
    containers: list[Any]
    categories: list[Any]
    inventory: list[Any]
    loans: list[Any]
    borrowers: list[Any]
    deleted: list[DeletedRecordResponse]


# Batch operation schemas
class BatchOperation(msgspec.Struct):
    """Single operation in a batch."""

    operation: str  # "create", "update", "delete"
    entity_type: str  # "item", "location", etc.
    id: UUID | None = None  # Required for update/delete
    data: dict[str, Any] | None = None  # Required for create/update
    updated_at: datetime | None = None  # For conflict detection on updates


class BatchRequest(msgspec.Struct):
    """Batch operation request."""

    operations: list[BatchOperation]
    allow_partial: bool = True  # Continue on errors


class BatchOperationResult(msgspec.Struct):
    """Result of a single batch operation."""

    index: int
    success: bool
    id: UUID | None = None
    error: str | None = None
    error_code: str | None = None
    conflict_data: dict[str, Any] | None = None  # Current server data on conflict


class BatchResponse(msgspec.Struct):
    """Response for batch operations."""

    success: bool
    results: list[BatchOperationResult]
    succeeded_count: int
    failed_count: int
