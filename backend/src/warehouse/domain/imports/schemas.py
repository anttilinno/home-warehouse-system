"""Import domain schemas."""

from enum import Enum
from typing import Any

import msgspec


class EntityType(str, Enum):
    """Entity types that can be imported."""

    CATEGORIES = "categories"
    LOCATIONS = "locations"
    CONTAINERS = "containers"
    ITEMS = "items"
    BORROWERS = "borrowers"
    INVENTORY = "inventory"


class ImportError(msgspec.Struct):
    """Single import error."""

    row: int
    field: str | None
    message: str


class ImportResult(msgspec.Struct):
    """Result of an import operation."""

    entity_type: str
    total_rows: int
    created: int
    updated: int
    skipped: int
    errors: list[ImportError]


class BarcodeProduct(msgspec.Struct):
    """Product information from barcode lookup."""

    barcode: str
    name: str | None
    brand: str | None
    category: str | None
    description: str | None
    image_url: str | None
    source: str  # "openfoodfacts" or "upcitemdb"


class BarcodeNotFound(msgspec.Struct):
    """Response when barcode is not found."""

    barcode: str
    found: bool = False
    message: str = "Product not found"
