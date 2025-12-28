"""End-to-end tests for imports against the real app."""

import io
from uuid import uuid7

import pytest
from openpyxl import Workbook


def _create_csv_bytes(headers: list[str], rows: list[list[str]]) -> bytes:
    """Helper to create CSV file bytes."""
    lines = [",".join(headers)]
    for row in rows:
        lines.append(",".join(row))
    return "\n".join(lines).encode("utf-8")


def _create_xlsx_bytes(headers: list[str], rows: list[list]) -> bytes:
    """Helper to create Excel file bytes."""
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


@pytest.mark.asyncio
async def test_import_categories_csv(client):
    """Test importing categories from CSV."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["name", "description"],
        [
            [f"Import-Cat-1-{suffix}", "First category"],
            [f"Import-Cat-2-{suffix}", "Second category"],
        ],
    )

    resp = await client.post(
        "/imports/upload?entity_type=categories",
        files={"data": ("categories.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["entity_type"] == "categories"
    assert result["created"] == 2
    assert result["skipped"] == 0
    assert len(result["errors"]) == 0

    # Verify categories were created
    list_resp = await client.get("/categories/")
    assert list_resp.status_code == 200
    category_names = [c["name"] for c in list_resp.json()]
    assert f"Import-Cat-1-{suffix}" in category_names
    assert f"Import-Cat-2-{suffix}" in category_names


@pytest.mark.asyncio
async def test_import_categories_xlsx(client):
    """Test importing categories from Excel."""
    suffix = uuid7().hex
    xlsx_content = _create_xlsx_bytes(
        ["name", "description"],
        [
            [f"ImportXlsx-Cat-{suffix}", "Excel category"],
        ],
    )

    resp = await client.post(
        "/imports/upload?entity_type=categories",
        files={"data": ("categories.xlsx", xlsx_content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 1


@pytest.mark.asyncio
async def test_import_locations_csv(client):
    """Test importing locations from CSV."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["name", "zone", "shelf", "bin", "description"],
        [
            [f"Import-Loc-{suffix}", "A", "1", "1", "Test location"],
        ],
    )

    resp = await client.post(
        "/imports/upload?entity_type=locations",
        files={"data": ("locations.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 1


@pytest.mark.asyncio
async def test_import_items_csv(client):
    """Test importing items from CSV."""
    suffix = uuid7().hex

    # Create a category first for items
    cat_resp = await client.post(
        "/categories/",
        json={"name": f"ImportItems-Cat-{suffix}"},
    )
    assert cat_resp.status_code == 201
    category_name = f"ImportItems-Cat-{suffix}"

    csv_content = _create_csv_bytes(
        ["sku", "name", "description", "category"],
        [
            [f"IMP-{suffix}-001", f"Import-Item-1-{suffix}", "First item", category_name],
            [f"IMP-{suffix}-002", f"Import-Item-2-{suffix}", "Second item", ""],
        ],
    )

    resp = await client.post(
        "/imports/upload?entity_type=items",
        files={"data": ("items.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 2


@pytest.mark.asyncio
async def test_import_borrowers_csv(client):
    """Test importing borrowers from CSV."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["name", "email", "phone", "notes"],
        [
            [f"Import-Borrower-{suffix}", f"borrower-{suffix}@example.com", "555-1234", "Test borrower"],
        ],
    )

    resp = await client.post(
        "/imports/upload?entity_type=borrowers",
        files={"data": ("borrowers.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 1


@pytest.mark.asyncio
async def test_import_skips_duplicates(client):
    """Test that import skips existing records."""
    suffix = uuid7().hex

    # Create a category first
    await client.post(
        "/categories/",
        json={"name": f"DupeTest-{suffix}"},
    )

    # Try to import the same category
    csv_content = _create_csv_bytes(
        ["name", "description"],
        [[f"DupeTest-{suffix}", "Should be skipped"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=categories",
        files={"data": ("categories.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1


@pytest.mark.asyncio
async def test_import_reports_errors(client):
    """Test that import reports validation errors."""
    # Missing required name field
    csv_content = _create_csv_bytes(
        ["description"],
        [["No name provided"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=categories",
        files={"data": ("categories.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "name"


@pytest.mark.asyncio
async def test_import_invalid_entity_type(client):
    """Test that invalid entity type returns error."""
    csv_content = _create_csv_bytes(["name"], [["Test"]])

    resp = await client.post(
        "/imports/upload?entity_type=invalid_type",
        files={"data": ("data.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert len(result["errors"]) > 0
    assert "Invalid entity type" in str(result["errors"])


@pytest.mark.asyncio
async def test_import_containers_requires_location(client):
    """Test that container import requires valid location."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["name", "location", "description"],
        [[f"Container-{suffix}", "NonExistentLocation", "Test container"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=containers",
        files={"data": ("containers.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert "not found" in result["errors"][0]["message"].lower()


@pytest.mark.asyncio
async def test_import_containers_with_valid_location(client):
    """Test that containers can be imported with valid location."""
    suffix = uuid7().hex

    # Create location first
    loc_resp = await client.post(
        "/locations/",
        json={"name": f"ContainerLoc-{suffix}"},
    )
    assert loc_resp.status_code == 201

    csv_content = _create_csv_bytes(
        ["name", "location", "description"],
        [[f"Container-{suffix}", f"ContainerLoc-{suffix}", "Test container"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=containers",
        files={"data": ("containers.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 1


@pytest.mark.asyncio
async def test_import_requires_auth(unauth_client):
    """Test that import endpoint requires authentication."""
    csv_content = _create_csv_bytes(["name"], [["Test"]])

    resp = await unauth_client.post(
        "/imports/upload?entity_type=categories",
        files={"data": ("categories.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_barcode_lookup_endpoint(client):
    """Test barcode lookup endpoint returns valid response."""
    # Use a test barcode
    resp = await client.get("/imports/barcode/0000000000000")
    assert resp.status_code == 200
    result = resp.json()
    # Response should have barcode field
    assert result["barcode"] == "0000000000000"
    # Response is either BarcodeProduct (with source) or BarcodeNotFound (with found=False)
    assert "source" in result or result.get("found") is False
