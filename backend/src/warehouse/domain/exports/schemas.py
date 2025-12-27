"""Export domain schemas."""

from datetime import datetime
from enum import Enum
from uuid import UUID

import msgspec


class ExportFormat(str, Enum):
    """Export format enum."""

    XLSX = "xlsx"
    JSON = "json"


class ExportResponse(msgspec.Struct):
    """Export audit record response."""

    id: UUID
    workspace_id: UUID
    exported_by: UUID | None
    format: str
    file_size_bytes: int | None
    record_counts: dict | None
    created_at: datetime


class ExportData(msgspec.Struct):
    """Complete workspace export data structure for JSON format."""

    exported_at: str
    workspace_id: str
    workspace_name: str
    categories: list[dict]
    locations: list[dict]
    containers: list[dict]
    items: list[dict]
    labels: list[dict]
    borrowers: list[dict]
    inventory: list[dict]
    loans: list[dict]
