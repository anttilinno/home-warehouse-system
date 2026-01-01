"""Sync domain service."""

from datetime import UTC, datetime
from typing import Any, Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.activity_log.models import ActivityEntity
from warehouse.domain.containers.models import Container
from warehouse.domain.containers.repository import ContainerRepository
from warehouse.domain.inventory.models import Inventory
from warehouse.domain.inventory.repository import InventoryRepository
from warehouse.domain.items.models import Category, Item
from warehouse.domain.items.repository import CategoryRepository, ItemRepository
from warehouse.domain.loans.models import Borrower, Loan
from warehouse.domain.loans.repository import BorrowerRepository, LoanRepository
from warehouse.domain.locations.models import Location
from warehouse.domain.locations.repository import LocationRepository
from warehouse.domain.sync.repository import DeletedRecordRepository
from warehouse.domain.sync.schemas import (
    BatchOperation,
    BatchOperationResult,
    BatchRequest,
    BatchResponse,
    DeletedRecordResponse,
    SyncMetadata,
    SyncResponse,
)
from warehouse.errors import AppError, ErrorCode


# Entity type string to ActivityEntity enum mapping
ENTITY_TYPE_MAP = {
    "item": ActivityEntity.ITEM,
    "location": ActivityEntity.LOCATION,
    "container": ActivityEntity.CONTAINER,
    "category": ActivityEntity.CATEGORY,
    "inventory": ActivityEntity.INVENTORY,
    "loan": ActivityEntity.LOAN,
    "borrower": ActivityEntity.BORROWER,
}


def _item_to_dict(item: Item) -> dict[str, Any]:
    """Convert Item to dict for sync response."""
    return {
        "id": str(item.id),
        "sku": item.sku,
        "name": item.name,
        "description": item.description,
        "category_id": str(item.category_id) if item.category_id else None,
        "short_code": item.short_code,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
        "obsidian_vault_path": item.obsidian_vault_path,
        "obsidian_note_path": item.obsidian_note_path,
    }


def _location_to_dict(location: Location) -> dict[str, Any]:
    """Convert Location to dict for sync response."""
    return {
        "id": str(location.id),
        "name": location.name,
        "zone": location.zone,
        "shelf": location.shelf,
        "bin": location.bin,
        "description": location.description,
        "parent_location_id": str(location.parent_location_id) if location.parent_location_id else None,
        "short_code": location.short_code,
        "created_at": location.created_at.isoformat(),
        "updated_at": location.updated_at.isoformat(),
    }


def _container_to_dict(container: Container) -> dict[str, Any]:
    """Convert Container to dict for sync response."""
    return {
        "id": str(container.id),
        "name": container.name,
        "location_id": str(container.location_id),
        "description": container.description,
        "capacity": container.capacity,
        "short_code": container.short_code,
        "created_at": container.created_at.isoformat(),
        "updated_at": container.updated_at.isoformat(),
    }


def _category_to_dict(category: Category) -> dict[str, Any]:
    """Convert Category to dict for sync response."""
    return {
        "id": str(category.id),
        "name": category.name,
        "parent_category_id": str(category.parent_category_id) if category.parent_category_id else None,
        "description": category.description,
        "created_at": category.created_at.isoformat(),
        "updated_at": category.updated_at.isoformat(),
    }


def _inventory_to_dict(inventory: Inventory) -> dict[str, Any]:
    """Convert Inventory to dict for sync response."""
    return {
        "id": str(inventory.id),
        "item_id": str(inventory.item_id),
        "location_id": str(inventory.location_id),
        "quantity": inventory.quantity,
        "expiration_date": inventory.expiration_date.isoformat() if inventory.expiration_date else None,
        "warranty_expires": inventory.warranty_expires.isoformat() if inventory.warranty_expires else None,
        "created_at": inventory.created_at.isoformat(),
        "updated_at": inventory.updated_at.isoformat(),
    }


def _loan_to_dict(loan: Loan) -> dict[str, Any]:
    """Convert Loan to dict for sync response."""
    return {
        "id": str(loan.id),
        "inventory_id": str(loan.inventory_id),
        "borrower_id": str(loan.borrower_id),
        "quantity": loan.quantity,
        "loaned_at": loan.loaned_at.isoformat(),
        "due_date": loan.due_date.isoformat() if loan.due_date else None,
        "returned_at": loan.returned_at.isoformat() if loan.returned_at else None,
        "notes": loan.notes,
        "created_at": loan.created_at.isoformat(),
        "updated_at": loan.updated_at.isoformat(),
    }


def _borrower_to_dict(borrower: Borrower) -> dict[str, Any]:
    """Convert Borrower to dict for sync response."""
    return {
        "id": str(borrower.id),
        "name": borrower.name,
        "email": borrower.email,
        "phone": borrower.phone,
        "notes": borrower.notes,
        "created_at": borrower.created_at.isoformat(),
        "updated_at": borrower.updated_at.isoformat(),
    }


class SyncService:
    """Service for PWA offline sync operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.item_repo = ItemRepository(session=session)
        self.location_repo = LocationRepository(session=session)
        self.container_repo = ContainerRepository(session=session)
        self.category_repo = CategoryRepository(session=session)
        self.inventory_repo = InventoryRepository(session=session)
        self.loan_repo = LoanRepository(session=session)
        self.borrower_repo = BorrowerRepository(session=session)
        self.deleted_repo = DeletedRecordRepository(session=session)

    async def get_delta(
        self,
        workspace_id: UUID,
        modified_since: datetime | None = None,
        entity_types: list[str] | None = None,
        limit: int = 500,
    ) -> SyncResponse:
        """Get all changes since a timestamp."""
        server_time = datetime.now(UTC)

        # Determine which entity types to fetch
        types_to_fetch = entity_types or list(ENTITY_TYPE_MAP.keys())

        results: dict[str, list[dict[str, Any]]] = {
            "items": [],
            "locations": [],
            "containers": [],
            "categories": [],
            "inventory": [],
            "loans": [],
            "borrowers": [],
        }
        has_more = False
        max_updated_at = modified_since

        # Fetch each entity type
        if "item" in types_to_fetch:
            items = await self.item_repo.list_modified_since(
                workspace_id=workspace_id,
                modified_since=modified_since,
                limit=limit + 1,
            )
            if len(items) > limit:
                has_more = True
                items = items[:limit]
            results["items"] = [_item_to_dict(i) for i in items]
            max_updated_at = self._update_max_timestamp(max_updated_at, items)

        if "location" in types_to_fetch:
            locations = await self.location_repo.list_modified_since(
                workspace_id=workspace_id,
                modified_since=modified_since,
                limit=limit + 1,
            )
            if len(locations) > limit:
                has_more = True
                locations = locations[:limit]
            results["locations"] = [_location_to_dict(loc) for loc in locations]
            max_updated_at = self._update_max_timestamp(max_updated_at, locations)

        if "container" in types_to_fetch:
            containers = await self.container_repo.list_modified_since(
                workspace_id=workspace_id,
                modified_since=modified_since,
                limit=limit + 1,
            )
            if len(containers) > limit:
                has_more = True
                containers = containers[:limit]
            results["containers"] = [_container_to_dict(c) for c in containers]
            max_updated_at = self._update_max_timestamp(max_updated_at, containers)

        if "category" in types_to_fetch:
            categories = await self.category_repo.list_modified_since(
                workspace_id=workspace_id,
                modified_since=modified_since,
                limit=limit + 1,
            )
            if len(categories) > limit:
                has_more = True
                categories = categories[:limit]
            results["categories"] = [_category_to_dict(c) for c in categories]
            max_updated_at = self._update_max_timestamp(max_updated_at, categories)

        if "inventory" in types_to_fetch:
            inventory = await self.inventory_repo.list_modified_since(
                workspace_id=workspace_id,
                modified_since=modified_since,
                limit=limit + 1,
            )
            if len(inventory) > limit:
                has_more = True
                inventory = inventory[:limit]
            results["inventory"] = [_inventory_to_dict(inv) for inv in inventory]
            max_updated_at = self._update_max_timestamp(max_updated_at, inventory)

        if "loan" in types_to_fetch:
            loans = await self.loan_repo.list_modified_since(
                workspace_id=workspace_id,
                modified_since=modified_since,
                limit=limit + 1,
            )
            if len(loans) > limit:
                has_more = True
                loans = loans[:limit]
            results["loans"] = [_loan_to_dict(loan) for loan in loans]
            max_updated_at = self._update_max_timestamp(max_updated_at, loans)

        if "borrower" in types_to_fetch:
            borrowers = await self.borrower_repo.list_modified_since(
                workspace_id=workspace_id,
                modified_since=modified_since,
                limit=limit + 1,
            )
            if len(borrowers) > limit:
                has_more = True
                borrowers = borrowers[:limit]
            results["borrowers"] = [_borrower_to_dict(b) for b in borrowers]
            max_updated_at = self._update_max_timestamp(max_updated_at, borrowers)

        # Get deleted records
        entity_enums = [
            ENTITY_TYPE_MAP[t] for t in types_to_fetch if t in ENTITY_TYPE_MAP
        ]
        deleted_records = await self.deleted_repo.list_deleted_since(
            workspace_id=workspace_id,
            since=modified_since,
            entity_types=entity_enums if entity_enums else None,
            limit=limit,
        )

        return SyncResponse(
            metadata=SyncMetadata(
                server_time=server_time,
                has_more=has_more,
                next_cursor=max_updated_at if has_more else None,
            ),
            items=results["items"],
            locations=results["locations"],
            containers=results["containers"],
            categories=results["categories"],
            inventory=results["inventory"],
            loans=results["loans"],
            borrowers=results["borrowers"],
            deleted=[
                DeletedRecordResponse(
                    entity_type=r.entity_type.value,
                    entity_id=r.entity_id,
                    deleted_at=r.deleted_at,
                )
                for r in deleted_records
            ],
        )

    def _update_max_timestamp(
        self,
        current_max: datetime | None,
        entities: Sequence[Any],
    ) -> datetime | None:
        """Update the maximum timestamp from a list of entities."""
        for entity in entities:
            if hasattr(entity, "updated_at") and entity.updated_at:
                if current_max is None or entity.updated_at > current_max:
                    current_max = entity.updated_at
        return current_max

    async def process_batch(
        self,
        workspace_id: UUID,
        user_id: UUID,
        request: BatchRequest,
    ) -> BatchResponse:
        """Process batch create/update/delete operations with conflict detection."""
        results: list[BatchOperationResult] = []
        succeeded = 0
        failed = 0

        for idx, op in enumerate(request.operations):
            try:
                result_id = await self._process_operation(
                    workspace_id=workspace_id,
                    user_id=user_id,
                    operation=op,
                )
                results.append(BatchOperationResult(
                    index=idx,
                    success=True,
                    id=result_id,
                ))
                succeeded += 1
            except ConflictError as e:
                results.append(BatchOperationResult(
                    index=idx,
                    success=False,
                    error="Conflict: record was modified on server",
                    error_code="SYNC_CONFLICT",
                    conflict_data=e.server_data,
                ))
                failed += 1
                if not request.allow_partial:
                    break
            except AppError as e:
                results.append(BatchOperationResult(
                    index=idx,
                    success=False,
                    error=e.message,
                    error_code=e.code.code,
                ))
                failed += 1
                if not request.allow_partial:
                    break
            except Exception as e:
                results.append(BatchOperationResult(
                    index=idx,
                    success=False,
                    error=str(e),
                    error_code="UNKNOWN_ERROR",
                ))
                failed += 1
                if not request.allow_partial:
                    break

        # Commit all successful operations
        if succeeded > 0:
            await self.session.commit()

        return BatchResponse(
            success=failed == 0,
            results=results,
            succeeded_count=succeeded,
            failed_count=failed,
        )

    async def _process_operation(
        self,
        workspace_id: UUID,
        user_id: UUID,
        operation: BatchOperation,
    ) -> UUID | None:
        """Process a single batch operation."""
        entity_type = operation.entity_type.lower()
        op_type = operation.operation.lower()

        if entity_type not in ENTITY_TYPE_MAP:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                f"Unknown entity type: {entity_type}",
                status_code=400,
            )

        # Get the appropriate repository
        repo = self._get_repo_for_entity(entity_type)

        if op_type == "delete":
            if not operation.id:
                raise AppError(
                    ErrorCode.VALIDATION_ERROR,
                    "ID required for delete operation",
                    status_code=400,
                )
            entity = await repo.get_one_or_none(id=operation.id, workspace_id=workspace_id)
            if entity:
                await repo.delete(entity.id)
                # Record tombstone
                await self.deleted_repo.record_deletion(
                    workspace_id=workspace_id,
                    entity_type=ENTITY_TYPE_MAP[entity_type],
                    entity_id=operation.id,
                    deleted_by=user_id,
                )
            return operation.id

        elif op_type == "update":
            if not operation.id:
                raise AppError(
                    ErrorCode.VALIDATION_ERROR,
                    "ID required for update operation",
                    status_code=400,
                )
            if not operation.data:
                raise AppError(
                    ErrorCode.VALIDATION_ERROR,
                    "Data required for update operation",
                    status_code=400,
                )

            # Check for conflicts
            entity, conflict = await repo.get_for_update(
                id=operation.id,
                workspace_id=workspace_id,
                expected_updated_at=operation.updated_at,
            )

            if entity is None:
                raise AppError(
                    ErrorCode.NOT_FOUND,
                    f"{entity_type} not found",
                    status_code=404,
                )

            if conflict:
                raise ConflictError(
                    f"{entity_type} was modified on server",
                    self._entity_to_dict(entity_type, entity),
                )

            # Update the entity
            for key, value in operation.data.items():
                if hasattr(entity, key):
                    setattr(entity, key, value)

            await self.session.flush()
            return entity.id

        elif op_type == "create":
            if not operation.data:
                raise AppError(
                    ErrorCode.VALIDATION_ERROR,
                    "Data required for create operation",
                    status_code=400,
                )

            # Create new entity
            model_class = repo.model_type
            entity = model_class(workspace_id=workspace_id, **operation.data)
            self.session.add(entity)
            await self.session.flush()
            return entity.id

        else:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                f"Unknown operation: {op_type}",
                status_code=400,
            )

    def _get_repo_for_entity(self, entity_type: str) -> Any:
        """Get repository for entity type."""
        repos = {
            "item": self.item_repo,
            "location": self.location_repo,
            "container": self.container_repo,
            "category": self.category_repo,
            "inventory": self.inventory_repo,
            "loan": self.loan_repo,
            "borrower": self.borrower_repo,
        }
        return repos[entity_type]

    def _entity_to_dict(self, entity_type: str, entity: Any) -> dict[str, Any]:
        """Convert entity to dict for conflict response."""
        converters = {
            "item": _item_to_dict,
            "location": _location_to_dict,
            "container": _container_to_dict,
            "category": _category_to_dict,
            "inventory": _inventory_to_dict,
            "loan": _loan_to_dict,
            "borrower": _borrower_to_dict,
        }
        return converters[entity_type](entity)


class ConflictError(Exception):
    """Exception raised when optimistic locking fails."""

    def __init__(self, message: str, server_data: dict[str, Any]):
        super().__init__(message)
        self.server_data = server_data
