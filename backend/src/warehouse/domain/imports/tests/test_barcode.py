"""Tests for the imports domain barcode lookup."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from conftest import (
    MOCK_HTTPX_ASYNC_CLIENT,
    MOCK_LOOKUP_OPENFOODFACTS,
    MOCK_LOOKUP_UPCITEMDB,
    TEST_BRAND,
    TEST_IMAGE_URL,
    TEST_PRODUCT_NAME,
)
from warehouse.domain.imports.barcode import (
    lookup_barcode,
    lookup_openfoodfacts,
    lookup_upcitemdb,
)
from warehouse.domain.imports.schemas import BarcodeNotFound, BarcodeProduct


class TestLookupOpenFoodFacts:
    """Tests for lookup_openfoodfacts function."""

    @pytest.mark.asyncio
    async def test_returns_product_when_found(self):
        """Test that product is returned when found."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": TEST_PRODUCT_NAME,
                "brands": TEST_BRAND,
                "categories": "Category A, Category B",
                "generic_name": "Generic description",
                "image_url": TEST_IMAGE_URL,
            },
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_openfoodfacts("1234567890123")

        assert isinstance(result, BarcodeProduct)
        assert result.barcode == "1234567890123"
        assert result.name == TEST_PRODUCT_NAME
        assert result.brand == TEST_BRAND
        assert result.category == "Category A"
        assert result.source == "openfoodfacts"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        """Test that None is returned when product not found."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": 0}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_openfoodfacts("0000000000000")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_http_error(self):
        """Test that None is returned on HTTP error."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_openfoodfacts("1234567890123")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_timeout(self):
        """Test that None is returned on timeout."""
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_openfoodfacts("1234567890123")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self):
        """Test that None is returned on generic exception."""
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("Connection error"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_openfoodfacts("1234567890123")

        assert result is None

    @pytest.mark.asyncio
    async def test_handles_empty_categories(self):
        """Test that empty categories are handled."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": TEST_PRODUCT_NAME,
                "categories": "",
            },
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_openfoodfacts("1234567890123")

        assert result.category is None


class TestLookupUPCItemDB:
    """Tests for lookup_upcitemdb function."""

    @pytest.mark.asyncio
    async def test_returns_product_when_found(self):
        """Test that product is returned when found."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "items": [
                {
                    "title": "Test Product",
                    "brand": "Test Brand",
                    "category": "Electronics",
                    "description": "A test product",
                    "images": ["https://example.com/image.jpg"],
                }
            ]
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_upcitemdb("1234567890123")

        assert isinstance(result, BarcodeProduct)
        assert result.barcode == "1234567890123"
        assert result.name == TEST_PRODUCT_NAME
        assert result.brand == TEST_BRAND
        assert result.category == "Electronics"
        assert result.source == "upcitemdb"

    @pytest.mark.asyncio
    async def test_returns_none_when_empty_items(self):
        """Test that None is returned when items list is empty."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"items": []}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_upcitemdb("0000000000000")

        assert result is None

    @pytest.mark.asyncio
    async def test_handles_missing_images(self):
        """Test that missing images are handled."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "items": [
                {
                    "title": "Test Product",
                    "images": None,
                }
            ]
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch(MOCK_HTTPX_ASYNC_CLIENT, return_value=mock_client):
            result = await lookup_upcitemdb("1234567890123")

        assert result.image_url is None


class TestLookupBarcode:
    """Tests for lookup_barcode function."""

    @pytest.mark.asyncio
    async def test_returns_product_from_openfoodfacts(self):
        """Test that product from Open Food Facts is returned first."""
        off_product = BarcodeProduct(
            barcode="1234567890123",
            name="OFF Product",
            brand="OFF Brand",
            category="Food",
            description="From Open Food Facts",
            image_url=None,
            source="openfoodfacts",
        )

        with patch(
            MOCK_LOOKUP_OPENFOODFACTS,
            new_callable=AsyncMock,
        ) as mock_off:
            mock_off.return_value = off_product

            result = await lookup_barcode("1234567890123")

        assert result == off_product
        assert result.source == "openfoodfacts"

    @pytest.mark.asyncio
    async def test_falls_back_to_upcitemdb(self):
        """Test that UPC Item DB is used as fallback."""
        upc_product = BarcodeProduct(
            barcode="1234567890123",
            name="UPC Product",
            brand="UPC Brand",
            category="Electronics",
            description="From UPC Item DB",
            image_url=None,
            source="upcitemdb",
        )

        with patch(
            MOCK_LOOKUP_OPENFOODFACTS,
            new_callable=AsyncMock,
        ) as mock_off, patch(
            MOCK_LOOKUP_UPCITEMDB,
            new_callable=AsyncMock,
        ) as mock_upc:
            mock_off.return_value = None
            mock_upc.return_value = upc_product

            result = await lookup_barcode("1234567890123")

        assert result == upc_product
        assert result.source == "upcitemdb"

    @pytest.mark.asyncio
    async def test_returns_not_found_when_both_fail(self):
        """Test that BarcodeNotFound is returned when both APIs fail."""
        with patch(
            MOCK_LOOKUP_OPENFOODFACTS,
            new_callable=AsyncMock,
        ) as mock_off, patch(
            MOCK_LOOKUP_UPCITEMDB,
            new_callable=AsyncMock,
        ) as mock_upc:
            mock_off.return_value = None
            mock_upc.return_value = None

            result = await lookup_barcode("0000000000000")

        assert isinstance(result, BarcodeNotFound)
        assert result.barcode == "0000000000000"
        assert result.found is False

    @pytest.mark.asyncio
    async def test_strips_barcode_whitespace(self):
        """Test that barcode whitespace is stripped."""
        with patch(
            MOCK_LOOKUP_OPENFOODFACTS,
            new_callable=AsyncMock,
        ) as mock_off, patch(
            MOCK_LOOKUP_UPCITEMDB,
            new_callable=AsyncMock,
        ) as mock_upc:
            mock_off.return_value = None
            mock_upc.return_value = None

            result = await lookup_barcode("  1234567890123  ")

        assert result.barcode == "1234567890123"


class TestBarcodeSchemas:
    """Tests for barcode schemas."""

    def test_barcode_product_schema(self):
        """Test BarcodeProduct schema."""
        product = BarcodeProduct(
            barcode="1234567890123",
            name="Test Product",
            brand="Test Brand",
            category="Electronics",
            description="A test product",
            image_url="https://example.com/image.jpg",
            source="openfoodfacts",
        )
        assert product.barcode == "1234567890123"
        assert product.name == "Test Product"
        assert product.source == "openfoodfacts"

    def test_barcode_not_found_schema(self):
        """Test BarcodeNotFound schema defaults."""
        not_found = BarcodeNotFound(barcode="0000000000000")
        assert not_found.barcode == "0000000000000"
        assert not_found.found is False
        assert not_found.message == "Product not found"
