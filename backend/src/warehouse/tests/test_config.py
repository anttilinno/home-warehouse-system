"""Tests for configuration loading."""

import os

from warehouse.config import Config


def test_config_from_env_reads_values(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    monkeypatch.setenv("SECRET_KEY", "secret")
    monkeypatch.setenv("JWT_ALGORITHM", "HS512")
    monkeypatch.setenv("JWT_EXPIRATION_HOURS", "12")

    cfg = Config.from_env()

    assert cfg.database_url == "sqlite://"
    assert cfg.secret_key == "secret"
    assert cfg.jwt_algorithm == "HS512"
    assert cfg.jwt_expiration_hours == 12


def test_config_defaults_when_env_missing(monkeypatch):
    for key in ["DATABASE_URL", "SECRET_KEY", "JWT_ALGORITHM", "JWT_EXPIRATION_HOURS", "REDIS_URL"]:
        monkeypatch.delenv(key, raising=False)

    cfg = Config.from_env()

    assert cfg.database_url == ""
    assert cfg.secret_key == "change-me-in-production"
    assert cfg.jwt_algorithm == "HS256"
    assert cfg.jwt_expiration_hours == 24
    assert cfg.redis_url == "redis://localhost:6379/0"


def test_config_redis_url_from_env(monkeypatch):
    """Test redis_url is read from environment."""
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    monkeypatch.setenv("REDIS_URL", "redis://redis-server:6380/1")

    cfg = Config.from_env()

    assert cfg.redis_url == "redis://redis-server:6380/1"


def test_config_dataclass_creation():
    """Test Config can be instantiated directly."""
    cfg = Config(
        database_url="postgres://localhost/test",
        redis_url="redis://localhost:6379/0",
        secret_key="test-secret",
        jwt_algorithm="HS384",
        jwt_expiration_hours=8,
    )

    assert cfg.database_url == "postgres://localhost/test"
    assert cfg.redis_url == "redis://localhost:6379/0"
    assert cfg.secret_key == "test-secret"
    assert cfg.jwt_algorithm == "HS384"
    assert cfg.jwt_expiration_hours == 8
