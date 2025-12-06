"""Database configuration and session management."""

from advanced_alchemy import SQLAlchemyAsyncConfig

from warehouse.config import Config


def get_db_config(config: Config) -> SQLAlchemyAsyncConfig:
    """Create database configuration."""
    return SQLAlchemyAsyncConfig(
        connection_string=config.database_url,
    )

