"""Tests for InventoryRepository helpers."""

from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest

from warehouse.domain.inventory.models import Inventory
from warehouse.domain.inventory.repository import InventoryRepository


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.mark.asyncio
async def test_get_by_item_and_location_delegates_get_one(workspace_id: UUID):
    repo = InventoryRepository(session=AsyncMock())
    repo.get_one_or_none = AsyncMock(return_value="inventory")  # type: ignore[assignment]
    item_id = uuid7()
    location_id = uuid7()

    result = await repo.get_by_item_and_location(item_id, location_id, workspace_id)

    repo.get_one_or_none.assert_awaited_once_with(item_id=item_id, location_id=location_id, workspace_id=workspace_id)
    assert result == "inventory"
    assert repo.model_type is Inventory
