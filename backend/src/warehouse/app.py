"""Litestar application factory."""

from litestar import Litestar
from litestar.config.cors import CORSConfig

from warehouse.config import Config
from warehouse.database import get_db_config
from warehouse.domain.auth.controllers import AuthController
from warehouse.domain.items.controllers import CategoryController, ItemController
from warehouse.domain.locations.controllers import LocationController
from warehouse.domain.inventory.controllers import InventoryController
from warehouse.domain.loans.controllers import BorrowerController, LoanController


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

    return Litestar(
        route_handlers=[
            AuthController,
            CategoryController,
            ItemController,
            LocationController,
            InventoryController,
            BorrowerController,
            LoanController,
        ],
        plugins=[db_config.plugin],
        cors_config=cors_config,
    )


app = create_app()

