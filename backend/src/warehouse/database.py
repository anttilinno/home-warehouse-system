"""Database configuration and session management."""

from advanced_alchemy.config.asyncio import AsyncSessionConfig
from advanced_alchemy.extensions.litestar.plugins.init.config.asyncio import SQLAlchemyAsyncConfig

from warehouse.config import Config


def get_db_config(config: Config) -> SQLAlchemyAsyncConfig:
    """Create database configuration."""
    return SQLAlchemyAsyncConfig(
        connection_string=config.database_url,
        session_config=AsyncSessionConfig(expire_on_commit=False),
        set_default_exception_handler=False,  # Use our custom handlers instead
    )

