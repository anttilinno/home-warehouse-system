"""Authentication domain controllers."""

from litestar import post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.exceptions import NotAuthorizedException
from litestar.status_codes import HTTP_201_CREATED

from warehouse.config import Config
from warehouse.domain.auth.repository import UserRepository
from warehouse.domain.auth.schemas import LoginRequest, TokenResponse, UserCreate, UserResponse
from warehouse.domain.auth.service import AuthService


def get_auth_service(repository: UserRepository, config: Config) -> AuthService:
    """Dependency for auth service."""
    return AuthService(repository, config)


class AuthController(Controller):
    """Authentication controller."""

    path = "/auth"
    dependencies = {"auth_service": Provide(get_auth_service)}

    @post("/register", status_code=HTTP_201_CREATED)
    async def register(
        self, data: UserCreate, auth_service: AuthService
    ) -> UserResponse:
        """Register a new user."""
        user = await auth_service.create_user(data)
        return UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )

    @post("/login")
    async def login(self, data: LoginRequest, auth_service: AuthService) -> TokenResponse:
        """Login and get access token."""
        user = await auth_service.authenticate(data)
        if not user:
            raise NotAuthorizedException("Invalid credentials")

        access_token = auth_service.create_access_token(user.id)
        return TokenResponse(access_token=access_token)

