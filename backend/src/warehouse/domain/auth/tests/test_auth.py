"""Tests for the auth domain service and schemas."""

from datetime import UTC, datetime, timedelta
from uuid import uuid7
from unittest.mock import AsyncMock

import jwt
import pytest

from warehouse.config import Config
from warehouse.domain.auth.models import User
from warehouse.domain.auth.schemas import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from warehouse.domain.auth.service import AuthService


@pytest.fixture
def config() -> Config:
    """Minimal config for token generation."""
    return Config(
        database_url="sqlite://",
        redis_url="redis://localhost:6379/0",
        secret_key="secret-key",
        jwt_algorithm="HS256",
        jwt_expiration_hours=1,
    )


@pytest.fixture
def repository_mock():
    """Mocked user repository with async methods."""
    repo = AsyncMock()
    repo.get_by_email = AsyncMock()
    repo.add = AsyncMock()
    return repo


@pytest.fixture
def service(repository_mock: AsyncMock, config: Config) -> AuthService:
    """Auth service wired with mock repository and config."""
    return AuthService(repository=repository_mock, config=config)


def _make_user(**kwargs) -> User:
    """Helper to construct a User instance."""
    defaults = {
        "id": uuid7(),
        "email": "alice@example.com",
        "full_name": "Alice Smith",
        "password_hash": "hashed",
        "is_active": True,
        "date_format": "DD.MM.YYYY HH:mm",
        "language": "en",
        "theme": "system",
    }
    defaults.update(kwargs)
    return User(**defaults)


def test_hash_and_verify_password(service: AuthService):
    password = "super-secret"
    hashed = service.hash_password(password)

    assert hashed != password
    assert service.verify_password(password, hashed) is True
    assert service.verify_password("wrong", hashed) is False


@pytest.mark.asyncio
async def test_create_user_success(service: AuthService, repository_mock: AsyncMock):
    repository_mock.get_by_email.return_value = None
    new_user = _make_user()
    repository_mock.add.return_value = new_user
    user_data = UserCreate(email="alice@example.com", full_name="Alice Smith", password="pw")

    result = await service.create_user(user_data)

    repository_mock.get_by_email.assert_awaited_once_with("alice@example.com")
    repository_mock.add.assert_awaited_once()
    created_user = repository_mock.add.await_args.args[0]
    assert created_user.email == "alice@example.com"
    assert created_user.full_name == "Alice Smith"
    assert created_user.password_hash != "pw"
    assert result is new_user


@pytest.mark.asyncio
async def test_create_user_duplicate_email(service: AuthService, repository_mock: AsyncMock):
    repository_mock.get_by_email.return_value = _make_user()
    user_data = UserCreate(email="alice@example.com", full_name="Alice Smith", password="pw")

    from warehouse.errors import AppError, ErrorCode

    with pytest.raises(AppError) as exc_info:
        await service.create_user(user_data)

    assert exc_info.value.code == ErrorCode.AUTH_EMAIL_EXISTS

    repository_mock.get_by_email.assert_awaited_once_with("alice@example.com")
    repository_mock.add.assert_not_awaited()


@pytest.mark.asyncio
async def test_authenticate_success(service: AuthService, repository_mock: AsyncMock):
    password = "pw"
    hashed = service.hash_password(password)
    user = _make_user(password_hash=hashed)
    repository_mock.get_by_email.return_value = user
    login = LoginRequest(email=user.email, password=password)

    result = await service.authenticate(login)

    repository_mock.get_by_email.assert_awaited_once_with(user.email)
    assert result is user


@pytest.mark.asyncio
async def test_authenticate_wrong_password(service: AuthService, repository_mock: AsyncMock):
    from warehouse.errors import AppError, ErrorCode

    user = _make_user(password_hash=service.hash_password("pw"))
    repository_mock.get_by_email.return_value = user
    login = LoginRequest(email=user.email, password="wrong")

    with pytest.raises(AppError) as exc_info:
        await service.authenticate(login)

    assert exc_info.value.code == ErrorCode.AUTH_INVALID_CREDENTIALS
    repository_mock.get_by_email.assert_awaited_once_with(user.email)


@pytest.mark.asyncio
async def test_authenticate_inactive_user(service: AuthService, repository_mock: AsyncMock):
    from warehouse.errors import AppError, ErrorCode

    user = _make_user(is_active=False)
    repository_mock.get_by_email.return_value = user
    login = LoginRequest(email=user.email, password="pw")

    with pytest.raises(AppError) as exc_info:
        await service.authenticate(login)

    assert exc_info.value.code == ErrorCode.AUTH_INACTIVE_USER
    repository_mock.get_by_email.assert_awaited_once_with(user.email)


@pytest.mark.asyncio
async def test_authenticate_user_not_found(service: AuthService, repository_mock: AsyncMock):
    from warehouse.errors import AppError, ErrorCode

    repository_mock.get_by_email.return_value = None
    login = LoginRequest(email="missing@example.com", password="pw")

    with pytest.raises(AppError) as exc_info:
        await service.authenticate(login)

    assert exc_info.value.code == ErrorCode.AUTH_INVALID_CREDENTIALS
    repository_mock.get_by_email.assert_awaited_once_with("missing@example.com")


def test_create_access_token(service: AuthService, config: Config):
    user_id = uuid7()

    token = service.create_access_token(user_id)

    decoded = jwt.decode(token, config.secret_key, algorithms=[config.jwt_algorithm])
    assert decoded["sub"] == str(user_id)
    exp = datetime.fromtimestamp(decoded["exp"], UTC)
    delta = exp - datetime.now(UTC)
    assert timedelta(minutes=-1) < delta < timedelta(hours=config.jwt_expiration_hours, minutes=5)


def test_schema_user_create_and_response():
    user_id = uuid7()
    now = datetime.now(UTC)
    create = UserCreate(email="a@example.com", full_name="Alice Smith", password="pw")
    resp = UserResponse(
        id=user_id,
        email="a@example.com",
        full_name="Alice Smith",
        is_active=True,
        date_format="DD.MM.YYYY HH:mm",
        language="en",
        theme="system",
        created_at=now,
        updated_at=now,
    )
    token = TokenResponse(access_token="token", user=resp, workspaces=[])

    assert create.email == "a@example.com"
    assert resp.id == user_id
    assert resp.is_active is True
    assert token.token_type == "bearer"
    assert token.user.email == "a@example.com"
    assert token.workspaces == []

    with pytest.raises(TypeError):
        UserCreate(email="a@example.com")  # type: ignore[call-arg]

