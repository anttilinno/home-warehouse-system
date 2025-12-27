"""Barcode lookup services using public APIs."""

import logging
from typing import Any

import httpx

from warehouse.domain.imports.schemas import BarcodeProduct, BarcodeNotFound

logger = logging.getLogger(__name__)


async def lookup_openfoodfacts(barcode: str) -> BarcodeProduct | None:
    """Look up product by barcode using Open Food Facts API.

    Args:
        barcode: Product barcode (EAN/UPC)

    Returns:
        BarcodeProduct if found, None otherwise
    """
    url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)

            if response.status_code != 200:
                return None

            data = response.json()
            if data.get("status") != 1:
                return None

            product = data.get("product", {})

            return BarcodeProduct(
                barcode=barcode,
                name=product.get("product_name"),
                brand=product.get("brands"),
                category=product.get("categories", "").split(",")[0].strip() or None,
                description=product.get("generic_name"),
                image_url=product.get("image_url"),
                source="openfoodfacts",
            )

    except httpx.TimeoutException:
        logger.warning(f"Timeout looking up barcode {barcode} on Open Food Facts")
        return None
    except Exception as e:
        logger.error(f"Error looking up barcode {barcode} on Open Food Facts: {e}")
        return None


async def lookup_upcitemdb(barcode: str) -> BarcodeProduct | None:
    """Look up product by barcode using UPC Item DB API.

    Note: The trial API is rate limited (100 requests/day).

    Args:
        barcode: Product barcode (EAN/UPC)

    Returns:
        BarcodeProduct if found, None otherwise
    """
    url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={"Accept": "application/json"},
                timeout=10.0,
            )

            if response.status_code != 200:
                return None

            data = response.json()
            items = data.get("items", [])

            if not items:
                return None

            item = items[0]

            return BarcodeProduct(
                barcode=barcode,
                name=item.get("title"),
                brand=item.get("brand"),
                category=item.get("category"),
                description=item.get("description"),
                image_url=(item.get("images") or [None])[0],
                source="upcitemdb",
            )

    except httpx.TimeoutException:
        logger.warning(f"Timeout looking up barcode {barcode} on UPC Item DB")
        return None
    except Exception as e:
        logger.error(f"Error looking up barcode {barcode} on UPC Item DB: {e}")
        return None


async def lookup_barcode(barcode: str) -> BarcodeProduct | BarcodeNotFound:
    """Look up product by barcode using multiple APIs.

    Tries Open Food Facts first, then falls back to UPC Item DB.

    Args:
        barcode: Product barcode (EAN/UPC)

    Returns:
        BarcodeProduct if found, BarcodeNotFound otherwise
    """
    # Clean the barcode
    barcode = barcode.strip()

    # Try Open Food Facts first (no rate limits)
    result = await lookup_openfoodfacts(barcode)
    if result:
        return result

    # Fall back to UPC Item DB
    result = await lookup_upcitemdb(barcode)
    if result:
        return result

    return BarcodeNotFound(barcode=barcode)
