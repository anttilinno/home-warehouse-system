"""Litestar application factory."""

import logging
import os
import traceback

from litestar import Litestar, Request
from litestar.config.cors import CORSConfig
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.logging import LoggingConfig
from litestar.response import Response
from litestar.status_codes import HTTP_400_BAD_REQUEST, HTTP_500_INTERNAL_SERVER_ERROR
from advanced_alchemy.extensions.litestar import SQLAlchemyPlugin
from sqlalchemy.exc import IntegrityError

from warehouse.config import Config
from warehouse.database import get_db_config
from warehouse.domain.auth.controllers import AuthController
from warehouse.domain.containers.controllers import ContainerController
from warehouse.domain.dashboard.controllers import DashboardController
from warehouse.domain.exports.controllers import ExportController
from warehouse.domain.items.controllers import CategoryController, ItemController
from warehouse.domain.locations.controllers import LocationController
from warehouse.domain.inventory.controllers import InventoryController
from warehouse.domain.loans.controllers import BorrowerController, LoanController
from warehouse.domain.analytics.controllers import AnalyticsController
from warehouse.domain.favorites.controllers import FavoriteController
from warehouse.domain.imports.controllers import ImportController
from warehouse.domain.notifications.controllers import NotificationController

logger = logging.getLogger(__name__)


def integrity_error_handler(request: Request, exc: IntegrityError) -> Response:
    """Handle SQLAlchemy IntegrityError with meaningful messages."""
    error_message = str(exc.orig) if exc.orig else str(exc)

    # Parse common constraint violations
    if "unique" in error_message.lower() or "duplicate" in error_message.lower():
        if "email" in error_message.lower():
            detail = "Email already exists"
        elif "sku" in error_message.lower():
            detail = "SKU already exists"
        elif "slug" in error_message.lower():
            detail = "Slug already exists"
        else:
            detail = "A record with this value already exists"
        return Response(
            {"detail": detail, "error_type": "integrity_error"},
            status_code=HTTP_400_BAD_REQUEST,
        )

    if "foreign key" in error_message.lower():
        detail = "Referenced record does not exist"
        return Response(
            {"detail": detail, "error_type": "integrity_error"},
            status_code=HTTP_400_BAD_REQUEST,
        )

    # Generic integrity error
    logger.error(f"Database integrity error: {error_message}")
    return Response(
        {"detail": "Database constraint violation", "error_type": "integrity_error"},
        status_code=HTTP_400_BAD_REQUEST,
    )


def http_exception_handler(request: Request, exc: HTTPException) -> Response:
    """Handle HTTP exceptions without logging (expected errors)."""
    return Response(
        {"detail": exc.detail},
        status_code=exc.status_code,
    )


def general_exception_handler(request: Request, exc: Exception) -> Response:
    """Handle unhandled exceptions with logging."""
    logger.exception(f"Unhandled exception: {exc}")
    debug = os.getenv("APP_DEBUG", "false").lower() == "true"

    if debug:
        # Include full traceback in debug mode for frontend error display
        tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
        return Response(
            {
                "detail": f"{type(exc).__name__}: {str(exc)}",
                "error_type": "server_error",
                "traceback": "".join(tb),
                "exception_type": type(exc).__name__,
            },
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {"detail": "An unexpected error occurred", "error_type": "server_error"},
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
    )


def create_app(config: Config | None = None) -> Litestar:
    """Create and configure Litestar application."""
    if config is None:
        config = Config.from_env()

    db_config = get_db_config(config)

    cors_config = CORSConfig(
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app_dependencies = {
        "config": Provide(Config.from_env, sync_to_thread=False),
    }

    debug = os.getenv("APP_DEBUG", "false").lower() == "true"

    # Configure logging to suppress noisy Litestar exception logs for expected HTTP errors
    logging_config = LoggingConfig(
        loggers={
            "litestar": {"level": "WARNING", "handlers": ["console"]},
        }
    )

    return Litestar(
        route_handlers=[
            AuthController,
            ContainerController,
            DashboardController,
            ExportController,
            CategoryController,
            FavoriteController,
            ImportController,
            ItemController,
            LocationController,
            InventoryController,
            BorrowerController,
            LoanController,
            AnalyticsController,
            NotificationController,
        ],
        plugins=[SQLAlchemyPlugin(db_config)],
        cors_config=cors_config,
        dependencies=app_dependencies,
        exception_handlers={
            HTTPException: http_exception_handler,
            IntegrityError: integrity_error_handler,
            Exception: general_exception_handler,
        },
        logging_config=logging_config,
        debug=debug,
    )


app = create_app()

