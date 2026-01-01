"""Tests for sync domain service."""

import datetime
from datetime import UTC
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid7

import pytest

from warehouse.domain.sync.schemas import BatchOperation, BatchRequest
from warehouse.domain.sync.service import ConflictError, SyncService


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def user_id() -> UUID:
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def mock_session():
    """Mock SQLAlchemy session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.add = MagicMock()
    return session


def _make_mock_entity(entity_id: UUID, workspace_id: UUID, name: str = "Test"):
    """Create a mock entity with common attributes."""
    entity = MagicMock()
    entity.id = entity_id
    entity.workspace_id = workspace_id
    entity.name = name
    entity.created_at = datetime.datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)
    entity.updated_at = datetime.datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)
    return entity


def _make_mock_item(workspace_id: UUID):
    """Create a mock item."""
    item = _make_mock_entity(uuid7(), workspace_id, "Test Item")
    item.sku = "ITEM-001"
    item.description = "A test item"
    item.category_id = None
    item.short_code = "ABC123"
    item.obsidian_vault_path = None
    item.obsidian_note_path = None
    return item


def _make_mock_location(workspace_id: UUID):
    """Create a mock location."""
    loc = _make_mock_entity(uuid7(), workspace_id, "Garage")
    loc.zone = "A"
    loc.shelf = "1"
    loc.bin = "1"
    loc.description = "Main garage"
    loc.parent_location_id = None
    loc.short_code = "GAR001"
    return loc


def _make_mock_category(workspace_id: UUID):
    """Create a mock category."""
    cat = _make_mock_entity(uuid7(), workspace_id, "Tools")
    cat.description = "Hand tools"
    cat.parent_category_id = None
    return cat


def _make_mock_deleted_record(workspace_id: UUID):
    """Create a mock deleted record."""
    from warehouse.domain.activity_log.models import ActivityEntity

    record = MagicMock()
    record.id = uuid7()
    record.workspace_id = workspace_id
    record.entity_type = ActivityEntity.ITEM
    record.entity_id = uuid7()
    record.deleted_at = datetime.datetime(2024, 1, 16, 12, 0, 0, tzinfo=UTC)
    record.deleted_by = uuid7()
    return record


@pytest.fixture
def sync_service(mock_session) -> SyncService:
    """Create sync service with mocked session."""
    service = SyncService(session=mock_session)
    # Mock all repositories
    service.item_repo = AsyncMock()
    service.location_repo = AsyncMock()
    service.container_repo = AsyncMock()
    service.category_repo = AsyncMock()
    service.inventory_repo = AsyncMock()
    service.loan_repo = AsyncMock()
    service.borrower_repo = AsyncMock()
    service.deleted_repo = AsyncMock()
    return service


class TestGetDelta:
    """Tests for SyncService.get_delta."""

    async def test_get_delta_returns_all_entity_types(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
    ):
        """Test that get_delta returns data for all entity types."""
        sample_item = _make_mock_item(workspace_id)
        sample_location = _make_mock_location(workspace_id)
        sample_category = _make_mock_category(workspace_id)
        sample_deleted = _make_mock_deleted_record(workspace_id)

        sync_service.item_repo.list_modified_since = AsyncMock(return_value=[sample_item])
        sync_service.location_repo.list_modified_since = AsyncMock(return_value=[sample_location])
        sync_service.container_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.category_repo.list_modified_since = AsyncMock(return_value=[sample_category])
        sync_service.inventory_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.loan_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.borrower_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.deleted_repo.list_deleted_since = AsyncMock(return_value=[sample_deleted])

        result = await sync_service.get_delta(workspace_id=workspace_id)

        assert len(result.items) == 1
        assert result.items[0]["sku"] == "ITEM-001"
        assert len(result.locations) == 1
        assert result.locations[0]["name"] == "Garage"
        assert len(result.categories) == 1
        assert result.categories[0]["name"] == "Tools"
        assert len(result.deleted) == 1
        assert result.deleted[0].entity_type == "ITEM"

    async def test_get_delta_with_modified_since(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
    ):
        """Test that modified_since is passed to repositories."""
        sample_item = _make_mock_item(workspace_id)
        sync_service.item_repo.list_modified_since = AsyncMock(return_value=[sample_item])
        sync_service.location_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.container_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.category_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.inventory_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.loan_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.borrower_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.deleted_repo.list_deleted_since = AsyncMock(return_value=[])

        modified_since = datetime.datetime(2024, 1, 10, 0, 0, 0, tzinfo=UTC)
        await sync_service.get_delta(workspace_id=workspace_id, modified_since=modified_since)

        sync_service.item_repo.list_modified_since.assert_called_once_with(
            workspace_id=workspace_id,
            modified_since=modified_since,
            limit=501,
        )

    async def test_get_delta_with_entity_types_filter(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
    ):
        """Test that entity_types filter only fetches specified types."""
        sample_item = _make_mock_item(workspace_id)
        sync_service.item_repo.list_modified_since = AsyncMock(return_value=[sample_item])
        sync_service.deleted_repo.list_deleted_since = AsyncMock(return_value=[])

        result = await sync_service.get_delta(
            workspace_id=workspace_id,
            entity_types=["item"],
        )

        assert len(result.items) == 1
        assert len(result.locations) == 0
        sync_service.item_repo.list_modified_since.assert_called_once()

    async def test_get_delta_has_more_pagination(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
    ):
        """Test that has_more is True when limit is exceeded."""
        items = [_make_mock_item(workspace_id) for _ in range(6)]
        sync_service.item_repo.list_modified_since = AsyncMock(return_value=items)
        sync_service.location_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.container_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.category_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.inventory_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.loan_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.borrower_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.deleted_repo.list_deleted_since = AsyncMock(return_value=[])

        result = await sync_service.get_delta(workspace_id=workspace_id, limit=5)

        assert result.metadata.has_more is True
        assert len(result.items) == 5

    async def test_get_delta_metadata_server_time(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
    ):
        """Test that server_time is included in metadata."""
        sync_service.item_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.location_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.container_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.category_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.inventory_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.loan_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.borrower_repo.list_modified_since = AsyncMock(return_value=[])
        sync_service.deleted_repo.list_deleted_since = AsyncMock(return_value=[])

        result = await sync_service.get_delta(workspace_id=workspace_id)

        assert result.metadata.server_time is not None
        assert result.metadata.server_time.tzinfo is not None


class TestProcessBatch:
    """Tests for SyncService.process_batch."""

    async def test_batch_create_item(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
        user_id: UUID,
    ):
        """Test batch create operation."""
        new_item_id = uuid7()

        with patch.object(sync_service, "_process_operation", new_callable=AsyncMock) as mock_op:
            mock_op.return_value = new_item_id

            request = BatchRequest(
                operations=[
                    BatchOperation(
                        operation="create",
                        entity_type="item",
                        data={"sku": "NEW-001", "name": "New Item"},
                    )
                ],
                allow_partial=True,
            )

            result = await sync_service.process_batch(
                workspace_id=workspace_id,
                user_id=user_id,
                request=request,
            )

            assert result.success is True
            assert result.succeeded_count == 1
            assert result.failed_count == 0
            assert result.results[0].id == new_item_id

    async def test_batch_update_with_conflict(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
        user_id: UUID,
    ):
        """Test batch update with conflict detection."""
        sample_item = _make_mock_item(workspace_id)
        sync_service.item_repo.get_for_update = AsyncMock(
            return_value=(sample_item, True)
        )

        request = BatchRequest(
            operations=[
                BatchOperation(
                    operation="update",
                    entity_type="item",
                    id=sample_item.id,
                    data={"name": "Updated Name"},
                    updated_at=datetime.datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC),
                )
            ],
            allow_partial=True,
        )

        result = await sync_service.process_batch(
            workspace_id=workspace_id,
            user_id=user_id,
            request=request,
        )

        assert result.success is False
        assert result.failed_count == 1
        assert result.results[0].error_code == "SYNC_CONFLICT"
        assert result.results[0].conflict_data is not None

    async def test_batch_delete_records_tombstone(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
        user_id: UUID,
    ):
        """Test that delete operation records tombstone."""
        sample_item = _make_mock_item(workspace_id)
        sync_service.item_repo.get_one_or_none = AsyncMock(return_value=sample_item)
        sync_service.item_repo.delete = AsyncMock()
        sync_service.deleted_repo.record_deletion = AsyncMock()

        request = BatchRequest(
            operations=[
                BatchOperation(
                    operation="delete",
                    entity_type="item",
                    id=sample_item.id,
                )
            ],
            allow_partial=True,
        )

        result = await sync_service.process_batch(
            workspace_id=workspace_id,
            user_id=user_id,
            request=request,
        )

        assert result.success is True
        sync_service.deleted_repo.record_deletion.assert_called_once()

    async def test_batch_allow_partial_false_stops_on_error(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
        user_id: UUID,
    ):
        """Test that allow_partial=False stops processing on first error."""
        with patch.object(sync_service, "_process_operation", new_callable=AsyncMock) as mock_op:
            from warehouse.errors import AppError, ErrorCode

            mock_op.side_effect = [
                AppError(ErrorCode.VALIDATION_ERROR, "First error"),
                uuid7(),
            ]

            request = BatchRequest(
                operations=[
                    BatchOperation(
                        operation="create",
                        entity_type="item",
                        data={"sku": "ERR-001", "name": "Error Item"},
                    ),
                    BatchOperation(
                        operation="create",
                        entity_type="item",
                        data={"sku": "OK-001", "name": "OK Item"},
                    ),
                ],
                allow_partial=False,
            )

            result = await sync_service.process_batch(
                workspace_id=workspace_id,
                user_id=user_id,
                request=request,
            )

            assert result.failed_count == 1
            assert len(result.results) == 1

    async def test_batch_allow_partial_true_continues_on_error(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
        user_id: UUID,
    ):
        """Test that allow_partial=True continues processing after error."""
        with patch.object(sync_service, "_process_operation", new_callable=AsyncMock) as mock_op:
            from warehouse.errors import AppError, ErrorCode

            success_id = uuid7()
            mock_op.side_effect = [
                AppError(ErrorCode.VALIDATION_ERROR, "First error"),
                success_id,
            ]

            request = BatchRequest(
                operations=[
                    BatchOperation(
                        operation="create",
                        entity_type="item",
                        data={"sku": "ERR-001", "name": "Error Item"},
                    ),
                    BatchOperation(
                        operation="create",
                        entity_type="item",
                        data={"sku": "OK-001", "name": "OK Item"},
                    ),
                ],
                allow_partial=True,
            )

            result = await sync_service.process_batch(
                workspace_id=workspace_id,
                user_id=user_id,
                request=request,
            )

            assert result.failed_count == 1
            assert result.succeeded_count == 1
            assert len(result.results) == 2

    async def test_batch_unknown_entity_type(
        self,
        sync_service: SyncService,
        workspace_id: UUID,
        user_id: UUID,
    ):
        """Test batch operation with unknown entity type."""
        request = BatchRequest(
            operations=[
                BatchOperation(
                    operation="create",
                    entity_type="unknown_type",
                    data={"name": "Test"},
                )
            ],
            allow_partial=True,
        )

        result = await sync_service.process_batch(
            workspace_id=workspace_id,
            user_id=user_id,
            request=request,
        )

        assert result.success is False
        # KeyError is caught as generic Exception -> UNKNOWN_ERROR
        assert result.results[0].success is False


class TestConflictError:
    """Tests for ConflictError."""

    def test_conflict_error_contains_server_data(self):
        """Test that ConflictError contains server data."""
        server_data = {"id": "123", "name": "Server Version"}
        error = ConflictError("Record modified", server_data)

        assert error.server_data == server_data
        assert str(error) == "Record modified"
