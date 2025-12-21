"""Tests for Item and Category repositories."""

from uuid import UUID, uuid7
from unittest.mock import AsyncMock

import pytest

from warehouse.domain.items.models import Category, Item
from warehouse.domain.items.repository import CategoryRepository, ItemRepository


@pytest.fixture
def workspace_id() -> UUID:
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.mark.asyncio
async def test_category_repository_model_type():
    repo = CategoryRepository(session=AsyncMock())
    assert repo.model_type is Category


@pytest.mark.asyncio
async def test_item_repository_get_by_sku_delegates_get_one(workspace_id: UUID):
    repo = ItemRepository(session=AsyncMock())
    repo.get_one_or_none = AsyncMock(return_value="item")  # type: ignore[assignment]

    result = await repo.get_by_sku("SKU-1", workspace_id)

    repo.get_one_or_none.assert_awaited_once_with(sku="SKU-1", workspace_id=workspace_id)
    assert result == "item"
    assert repo.model_type is Item
