"""Controller tests for auth domain."""

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid7
from unittest.mock import AsyncMock, Mock

import pytest
from litestar.exceptions import NotAuthorizedException

from warehouse.domain.auth.controllers import AuthController
from warehouse.domain.auth.schemas import LoginRequest, UserCreate


@pytest.fixture
def auth_service_mock() -> AsyncMock:
    service = AsyncMock()
    service.create_user = AsyncMock()
    service.authenticate = AsyncMock()
    service.create_access_token = Mock(return_value="token")
    return service


@pytest.fixture
def controller() -> AuthController:
    return AuthController(owner=None)


async def _call(handler, controller: AuthController, **kwargs):
    """Invoke the underlying handler function directly."""
    return await handler.fn(controller, **kwargs)


@pytest.mark.asyncio
async def test_register_maps_response(controller: AuthController, auth_service_mock: AsyncMock):
    now = datetime.now(UTC)
    user = SimpleNamespace(
        id=uuid7(),
        email="alice@example.com",
        full_name="Alice Smith",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    auth_service_mock.create_user.return_value = user
    payload = UserCreate(email="alice@example.com", full_name="Alice Smith", password="pw")

    resp = await _call(controller.register, controller, data=payload, auth_service=auth_service_mock)

    auth_service_mock.create_user.assert_awaited_once_with(payload)
    assert resp.id == user.id
    assert resp.email == "alice@example.com"
    assert resp.full_name == "Alice Smith"
    assert resp.is_active is True
    assert resp.created_at == now
    assert resp.updated_at == now


@pytest.mark.asyncio
async def test_login_success(controller: AuthController, auth_service_mock: AsyncMock):
    now = datetime.now(UTC)
    user = SimpleNamespace(
        id=uuid7(),
        email="alice@example.com",
        full_name="Alice Smith",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    auth_service_mock.authenticate.return_value = user
    auth_service_mock.create_access_token.return_value = "token"
    payload = LoginRequest(email="alice@example.com", password="pw")

    resp = await _call(controller.login, controller, data=payload, auth_service=auth_service_mock)

    auth_service_mock.authenticate.assert_awaited_once_with(payload)
    auth_service_mock.create_access_token.assert_called_once_with(user.id)
    assert resp.access_token == "token"
    assert resp.token_type == "bearer"
    assert resp.user.email == "alice@example.com"


@pytest.mark.asyncio
async def test_login_invalid_credentials_raises(controller: AuthController, auth_service_mock: AsyncMock):
    from warehouse.errors import AppError, ErrorCode
    from litestar.exceptions import HTTPException

    auth_service_mock.authenticate.side_effect = AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, status_code=401)
    payload = LoginRequest(email="alice@example.com", password="wrong")

    with pytest.raises(HTTPException, match="401"):
        await _call(controller.login, controller, data=payload, auth_service=auth_service_mock)

    auth_service_mock.create_access_token.assert_not_called()
