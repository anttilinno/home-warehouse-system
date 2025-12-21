"""Tests for UserRepository helpers."""

from unittest.mock import AsyncMock

import pytest

from warehouse.domain.auth.repository import UserRepository
from warehouse.domain.auth.models import User


@pytest.mark.asyncio
async def test_get_by_email_delegates_to_get_one():
    repo = UserRepository(session=AsyncMock())
    repo.get_one_or_none = AsyncMock(return_value="user-by-email")  # type: ignore[assignment]

    user_by_email = await repo.get_by_email("a@example.com")

    repo.get_one_or_none.assert_awaited_once_with(email="a@example.com")
    assert user_by_email == "user-by-email"
    assert repo.model_type is User
