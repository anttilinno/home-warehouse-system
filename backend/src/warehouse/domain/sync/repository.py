"""Sync domain repository."""

from datetime import datetime
from typing import Sequence
from uuid import UUID

from sqlalchemy import delete, select

from warehouse.domain.activity_log.models import ActivityEntity
from warehouse.domain.sync.models import DeletedRecord
from warehouse.lib.base import BaseRepository


class DeletedRecordRepository(BaseRepository[DeletedRecord]):
    """Repository for deleted records (tombstones)."""

    model_type = DeletedRecord

    async def list_deleted_since(
        self,
        workspace_id: UUID,
        since: datetime | None = None,
        entity_types: list[ActivityEntity] | None = None,
        limit: int = 1000,
    ) -> Sequence[DeletedRecord]:
        """Get deleted records since timestamp."""
        stmt = select(DeletedRecord).where(
            DeletedRecord.workspace_id == workspace_id
        )

        if since is not None:
            stmt = stmt.where(DeletedRecord.deleted_at > since)

        if entity_types:
            stmt = stmt.where(DeletedRecord.entity_type.in_(entity_types))

        stmt = stmt.order_by(DeletedRecord.deleted_at.asc()).limit(limit)

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def record_deletion(
        self,
        workspace_id: UUID,
        entity_type: ActivityEntity,
        entity_id: UUID,
        deleted_by: UUID | None = None,
    ) -> DeletedRecord:
        """Record a deletion for sync tracking."""
        record = DeletedRecord(
            workspace_id=workspace_id,
            entity_type=entity_type,
            entity_id=entity_id,
            deleted_by=deleted_by,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def cleanup_old_tombstones(
        self,
        workspace_id: UUID,
        older_than: datetime,
    ) -> int:
        """Remove tombstones older than the given date."""
        stmt = delete(DeletedRecord).where(
            DeletedRecord.workspace_id == workspace_id,
            DeletedRecord.deleted_at < older_than,
        )
        result = await self.session.execute(stmt)
        return result.rowcount
