"""Smoke tests for app factory and database config."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_400_BAD_REQUEST, HTTP_500_INTERNAL_SERVER_ERROR
from sqlalchemy.exc import IntegrityError

from warehouse import app as app_module
from warehouse.app import create_app, integrity_error_handler, general_exception_handler
from warehouse.config import Config
from warehouse.database import get_db_config
from warehouse.domain.auth.controllers import AuthController
from warehouse.domain.inventory.controllers import InventoryController
from warehouse.domain.items.controllers import CategoryController, ItemController
from warehouse.domain.loans.controllers import BorrowerController, LoanController
from warehouse.domain.locations.controllers import LocationController


def test_get_db_config_uses_connection_string():
    cfg = Config(database_url="postgresql://user:pass@localhost/db", redis_url="redis://localhost:6379/0", secret_key="x")

    db_cfg = get_db_config(cfg)

    assert db_cfg.connection_string == "postgresql://user:pass@localhost/db"
    assert db_cfg.session_config.expire_on_commit is False


def test_create_app_uses_provided_config_and_registers_routes(monkeypatch):
    cfg = Config(database_url="postgres://url", redis_url="redis://localhost:6379/0", secret_key="key")
    fake_db_config = SimpleNamespace()
    captured = {}

    def fake_get_db_config(c):
        captured["config"] = c
        return fake_db_config

    class FakeSQLAlchemyPlugin:
        def __init__(self, db_config):
            captured["db_config"] = db_config

    monkeypatch.setattr(app_module, "get_db_config", fake_get_db_config)
    monkeypatch.setattr(app_module, "SQLAlchemyPlugin", FakeSQLAlchemyPlugin)

    app = create_app(config=cfg)

    assert captured["config"] is cfg
    assert captured["db_config"] is fake_db_config
    assert app is not None


class TestIntegrityErrorHandler:
    """Tests for database integrity error handling."""

    def test_email_unique_violation(self):
        request = MagicMock()
        orig_error = MagicMock()
        orig_error.__str__ = lambda self: "duplicate key value violates unique constraint users_email_key"
        exc = IntegrityError("INSERT", {}, orig_error)

        response = integrity_error_handler(request, exc)

        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.content["detail"] == "Email already exists"

    def test_sku_unique_violation(self):
        request = MagicMock()
        orig_error = MagicMock()
        orig_error.__str__ = lambda self: "duplicate key value violates unique constraint items_sku_key"
        exc = IntegrityError("INSERT", {}, orig_error)

        response = integrity_error_handler(request, exc)

        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.content["detail"] == "SKU already exists"

    def test_generic_unique_violation(self):
        request = MagicMock()
        orig_error = MagicMock()
        orig_error.__str__ = lambda self: "duplicate key value violates unique constraint some_other_key"
        exc = IntegrityError("INSERT", {}, orig_error)

        response = integrity_error_handler(request, exc)

        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.content["detail"] == "A record with this value already exists"

    def test_foreign_key_violation(self):
        request = MagicMock()
        orig_error = MagicMock()
        orig_error.__str__ = lambda self: "violates foreign key constraint"
        exc = IntegrityError("INSERT", {}, orig_error)

        response = integrity_error_handler(request, exc)

        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.content["detail"] == "Referenced record does not exist"

    def test_other_integrity_error(self):
        request = MagicMock()
        orig_error = MagicMock()
        orig_error.__str__ = lambda self: "some other database error"
        exc = IntegrityError("INSERT", {}, orig_error)

        response = integrity_error_handler(request, exc)

        assert response.status_code == HTTP_400_BAD_REQUEST
        assert response.content["detail"] == "Database constraint violation"


class TestGeneralExceptionHandler:
    """Tests for general exception handling."""

    def test_general_exception_in_production(self, monkeypatch):
        monkeypatch.setenv("APP_DEBUG", "false")
        request = MagicMock()
        exc = ValueError("Something went wrong")

        response = general_exception_handler(request, exc)

        assert response.status_code == HTTP_500_INTERNAL_SERVER_ERROR
        assert response.content["detail"] == "An unexpected error occurred"

    def test_general_exception_in_debug(self, monkeypatch):
        monkeypatch.setenv("APP_DEBUG", "true")
        request = MagicMock()
        exc = ValueError("Something went wrong")

        response = general_exception_handler(request, exc)

        assert response.status_code == HTTP_500_INTERNAL_SERVER_ERROR
        assert response.content["detail"] == "ValueError: Something went wrong"
        assert "traceback" in response.content
        assert "ValueError" in response.content["traceback"]
        assert response.content["exception_type"] == "ValueError"

    def test_http_exception_passthrough(self):
        request = MagicMock()
        exc = HTTPException(status_code=404, detail="Not found")

        response = general_exception_handler(request, exc)

        assert response.status_code == 404
        assert response.content["detail"] == "Not found"
