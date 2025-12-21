"""Tests for BaseRepository helpers."""

from unittest.mock import AsyncMock

import pytest

from warehouse.lib.base import BaseRepository
from warehouse.domain.locations.models import Location


class DummyRepo(BaseRepository[Location]):
    """Concrete repo for testing get_by_id delegation."""

    model_type = Location


@pytest.mark.asyncio
async def test_get_by_id_delegates_to_get_one():
    repo = DummyRepo(session=AsyncMock())
    repo.get_one_or_none = AsyncMock(return_value="entity")  # type: ignore[assignment]

    result = await repo.get_by_id("identifier")

    repo.get_one_or_none.assert_awaited_once_with(id="identifier")
    assert result == "entity"
