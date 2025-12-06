"""Application configuration."""

import os
from dataclasses import dataclass


@dataclass
class Config:
    """Application configuration."""

    database_url: str
    secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        return cls(
            database_url=os.getenv("DATABASE_URL", ""),
            secret_key=os.getenv("SECRET_KEY", "change-me-in-production"),
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            jwt_expiration_hours=int(os.getenv("JWT_EXPIRATION_HOURS", "24")),
        )


