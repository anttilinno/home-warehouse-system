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
    for key in ["DATABASE_URL", "SECRET_KEY", "JWT_ALGORITHM", "JWT_EXPIRATION_HOURS"]:
        monkeypatch.delenv(key, raising=False)

    cfg = Config.from_env()

    assert cfg.database_url == ""
    assert cfg.secret_key == "change-me-in-production"
    assert cfg.jwt_algorithm == "HS256"
    assert cfg.jwt_expiration_hours == 24
