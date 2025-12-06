"""Authentication domain service."""

from datetime import datetime, timedelta
from uuid import UUID

import jwt
from passlib.context import CryptContext

from warehouse.config import Config
from warehouse.domain.auth.models import User
from warehouse.domain.auth.repository import UserRepository
from warehouse.domain.auth.schemas import LoginRequest, UserCreate

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class AuthService:
    """Authentication service."""

    def __init__(self, repository: UserRepository, config: Config):
        """Initialize auth service."""
        self.repository = repository
        self.config = config

    def hash_password(self, password: str) -> str:
        """Hash a password."""
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password."""
        return pwd_context.verify(plain_password, hashed_password)

    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user."""
        existing = await self.repository.get_by_username(user_data.username)
        if existing:
            raise ValueError("Username already exists")

        existing = await self.repository.get_by_email(user_data.email)
        if existing:
            raise ValueError("Email already exists")

        hashed_password = self.hash_password(user_data.password)
        user = User(
            username=user_data.username,
            email=user_data.email,
            password_hash=hashed_password,
        )
        return await self.repository.add(user)

    async def authenticate(self, login_data: LoginRequest) -> User | None:
        """Authenticate a user."""
        user = await self.repository.get_by_username(login_data.username)
        if not user or not user.is_active:
            return None

        if not self.verify_password(login_data.password, user.password_hash):
            return None

        return user

    def create_access_token(self, user_id: UUID) -> str:
        """Create a JWT access token."""
        expires = datetime.utcnow() + timedelta(hours=self.config.jwt_expiration_hours)
        payload = {
            "sub": str(user_id),
            "exp": expires,
        }
        return jwt.encode(payload, self.config.secret_key, algorithm=self.config.jwt_algorithm)

