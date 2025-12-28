"""Application configuration."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load .env file from backend directory (or parent if running from src)
_backend_dir = Path(__file__).parent.parent.parent
_env_file = _backend_dir / ".env"
if _env_file.exists():
    load_dotenv(_env_file, override=True)
else:
    # Try parent directory (project root)
    _project_root = _backend_dir.parent
    _env_file = _project_root / ".env"
    if _env_file.exists():
        load_dotenv(_env_file, override=True)


@dataclass
class Config:
    """Application configuration."""

    database_url: str
    redis_url: str
    secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    # Email configuration (Resend)
    resend_api_key: str = ""
    email_from_address: str = "noreply@example.com"
    app_url: str = "http://localhost:3000"
    # OAuth configuration
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        return cls(
            database_url=os.getenv("DATABASE_URL", ""),
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            secret_key=os.getenv("SECRET_KEY", "change-me-in-production"),
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            jwt_expiration_hours=int(os.getenv("JWT_EXPIRATION_HOURS", "24")),
            resend_api_key=os.getenv("RESEND_API_KEY", ""),
            email_from_address=os.getenv("EMAIL_FROM_ADDRESS", "noreply@example.com"),
            app_url=os.getenv("APP_URL", "http://localhost:3000"),
            google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
            google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET", ""),
            github_client_id=os.getenv("GITHUB_CLIENT_ID", ""),
            github_client_secret=os.getenv("GITHUB_CLIENT_SECRET", ""),
        )


