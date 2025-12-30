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


# ===================== ERROR PATH TESTS =====================


@pytest.mark.asyncio
async def test_import_categories_parent_not_found(client):
    """Test that import reports error when parent category not found."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["name", "parent_category"],
        [[f"Child-{suffix}", "NonExistentParent"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=categories",
        files={"data": ("categories.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert "parent" in result["errors"][0]["field"].lower()
    assert "not found" in result["errors"][0]["message"].lower()


@pytest.mark.asyncio
async def test_import_locations_missing_name(client):
    """Test that location import requires name field."""
    csv_content = _create_csv_bytes(
        ["zone", "shelf"],
        [["A", "1"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=locations",
        files={"data": ("locations.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "name"


@pytest.mark.asyncio
async def test_import_locations_parent_not_found(client):
    """Test that import reports error when parent location not found."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["name", "parent_location"],
        [[f"ChildLoc-{suffix}", "NonExistentParent"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=locations",
        files={"data": ("locations.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert "parent" in result["errors"][0]["field"].lower()
    assert "not found" in result["errors"][0]["message"].lower()


@pytest.mark.asyncio
async def test_import_locations_skips_duplicates(client):
    """Test that location import skips existing records."""
    suffix = uuid7().hex

    # Create a location first
    await client.post(
        "/locations/",
        json={"name": f"DupeLoc-{suffix}"},
    )

    # Try to import the same location
    csv_content = _create_csv_bytes(
        ["name", "zone"],
        [[f"DupeLoc-{suffix}", "A"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=locations",
        files={"data": ("locations.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1


@pytest.mark.asyncio
async def test_import_containers_missing_name(client):
    """Test that container import requires name field."""
    suffix = uuid7().hex

    # Create location first
    await client.post("/locations/", json={"name": f"ContLoc-{suffix}"})

    csv_content = _create_csv_bytes(
        ["location", "description"],
        [[f"ContLoc-{suffix}", "No name"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=containers",
        files={"data": ("containers.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "name"


@pytest.mark.asyncio
async def test_import_containers_missing_location_field(client):
    """Test that container import requires location field."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["name", "description"],
        [[f"Container-{suffix}", "No location specified"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=containers",
        files={"data": ("containers.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "location"
    assert "required" in result["errors"][0]["message"].lower()


@pytest.mark.asyncio
async def test_import_containers_skips_duplicates(client):
    """Test that container import skips existing records."""
    suffix = uuid7().hex

    # Create location first
    loc_resp = await client.post("/locations/", json={"name": f"DupeContLoc-{suffix}"})
    assert loc_resp.status_code == 201
    location_id = loc_resp.json()["id"]

    # Create container first
    await client.post(
        "/containers/",
        json={"name": f"DupeCont-{suffix}", "location_id": location_id},
    )

    # Try to import the same container
    csv_content = _create_csv_bytes(
        ["name", "location"],
        [[f"DupeCont-{suffix}", f"DupeContLoc-{suffix}"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=containers",
        files={"data": ("containers.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1


@pytest.mark.asyncio
async def test_import_items_missing_sku(client):
    """Test that item import requires SKU field."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["name", "description"],
        [[f"Item-{suffix}", "No SKU"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=items",
        files={"data": ("items.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "sku"


@pytest.mark.asyncio
async def test_import_items_missing_name(client):
    """Test that item import requires name field."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["sku", "description"],
        [[f"SKU-{suffix}", "No name"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=items",
        files={"data": ("items.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "name"


@pytest.mark.asyncio
async def test_import_items_category_not_found(client):
    """Test that import reports error when category not found."""
    suffix = uuid7().hex
    csv_content = _create_csv_bytes(
        ["sku", "name", "category"],
        [[f"SKU-{suffix}", f"Item-{suffix}", "NonExistentCategory"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=items",
        files={"data": ("items.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "category"
    assert "not found" in result["errors"][0]["message"].lower()


@pytest.mark.asyncio
async def test_import_items_skips_duplicate_sku(client):
    """Test that item import skips existing SKUs."""
    suffix = uuid7().hex

    # Create item first
    await client.post(
        "/items/",
        json={"sku": f"DUPE-{suffix}", "name": f"DupeItem-{suffix}"},
    )

    # Try to import the same SKU
    csv_content = _create_csv_bytes(
        ["sku", "name"],
        [[f"DUPE-{suffix}", "Different Name"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=items",
        files={"data": ("items.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1


@pytest.mark.asyncio
async def test_import_borrowers_missing_name(client):
    """Test that borrower import requires name field."""
    csv_content = _create_csv_bytes(
        ["email", "phone"],
        [["test@example.com", "555-1234"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=borrowers",
        files={"data": ("borrowers.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "name"


@pytest.mark.asyncio
async def test_import_borrowers_skips_duplicates(client):
    """Test that borrower import skips existing records."""
    suffix = uuid7().hex

    # Create borrower first
    await client.post(
        "/borrowers/",
        json={"name": f"DupeBorrower-{suffix}"},
    )

    # Try to import the same borrower
    csv_content = _create_csv_bytes(
        ["name", "email"],
        [[f"DupeBorrower-{suffix}", "new@example.com"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=borrowers",
        files={"data": ("borrowers.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1


@pytest.mark.asyncio
async def test_import_inventory_missing_item(client):
    """Test that inventory import requires item field."""
    suffix = uuid7().hex

    # Create location first
    await client.post("/locations/", json={"name": f"InvLoc-{suffix}"})

    csv_content = _create_csv_bytes(
        ["location", "quantity"],
        [[f"InvLoc-{suffix}", "5"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=inventory",
        files={"data": ("inventory.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "item"


@pytest.mark.asyncio
async def test_import_inventory_missing_location(client):
    """Test that inventory import requires location field."""
    suffix = uuid7().hex

    # Create item first
    await client.post(
        "/items/",
        json={"sku": f"INV-{suffix}", "name": f"InvItem-{suffix}"},
    )

    csv_content = _create_csv_bytes(
        ["item", "quantity"],
        [[f"INV-{suffix}", "5"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=inventory",
        files={"data": ("inventory.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "location"


@pytest.mark.asyncio
async def test_import_inventory_item_not_found(client):
    """Test that inventory import reports error when item not found."""
    suffix = uuid7().hex

    # Create location first
    await client.post("/locations/", json={"name": f"InvLoc2-{suffix}"})

    csv_content = _create_csv_bytes(
        ["item", "location", "quantity"],
        [["NonExistentItem", f"InvLoc2-{suffix}", "5"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=inventory",
        files={"data": ("inventory.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "item"
    assert "not found" in result["errors"][0]["message"].lower()


@pytest.mark.asyncio
async def test_import_inventory_location_not_found(client):
    """Test that inventory import reports error when location not found."""
    suffix = uuid7().hex

    # Create item first
    await client.post(
        "/items/",
        json={"sku": f"INV2-{suffix}", "name": f"InvItem2-{suffix}"},
    )

    csv_content = _create_csv_bytes(
        ["item", "location", "quantity"],
        [[f"INV2-{suffix}", "NonExistentLocation", "5"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=inventory",
        files={"data": ("inventory.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "location"
    assert "not found" in result["errors"][0]["message"].lower()


@pytest.mark.asyncio
async def test_import_inventory_invalid_quantity(client):
    """Test that inventory import reports error for invalid quantity."""
    suffix = uuid7().hex

    # Create item and location first
    await client.post(
        "/items/",
        json={"sku": f"INV3-{suffix}", "name": f"InvItem3-{suffix}"},
    )
    await client.post("/locations/", json={"name": f"InvLoc3-{suffix}"})

    csv_content = _create_csv_bytes(
        ["item", "location", "quantity"],
        [[f"INV3-{suffix}", f"InvLoc3-{suffix}", "not-a-number"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=inventory",
        files={"data": ("inventory.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert len(result["errors"]) > 0
    assert result["errors"][0]["field"] == "quantity"
    assert "invalid" in result["errors"][0]["message"].lower()


@pytest.mark.asyncio
async def test_import_inventory_success(client):
    """Test successful inventory import."""
    suffix = uuid7().hex

    # Create item and location first
    await client.post(
        "/items/",
        json={"sku": f"INV4-{suffix}", "name": f"InvItem4-{suffix}"},
    )
    await client.post("/locations/", json={"name": f"InvLoc4-{suffix}"})

    csv_content = _create_csv_bytes(
        ["item", "location", "quantity"],
        [[f"INV4-{suffix}", f"InvLoc4-{suffix}", "10"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=inventory",
        files={"data": ("inventory.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["entity_type"] == "inventory"
    assert result["created"] == 1
    assert len(result["errors"]) == 0


@pytest.mark.asyncio
async def test_import_inventory_skips_duplicates(client):
    """Test that inventory import skips existing item+location combinations."""
    suffix = uuid7().hex

    # Create item and location first
    item_resp = await client.post(
        "/items/",
        json={"sku": f"INV5-{suffix}", "name": f"InvItem5-{suffix}"},
    )
    item_id = item_resp.json()["id"]

    loc_resp = await client.post("/locations/", json={"name": f"InvLoc5-{suffix}"})
    location_id = loc_resp.json()["id"]

    # Create inventory first
    await client.post(
        "/inventory/",
        json={"item_id": item_id, "location_id": location_id, "quantity": 5},
    )

    # Try to import the same item+location combination
    csv_content = _create_csv_bytes(
        ["item", "location", "quantity"],
        [[f"INV5-{suffix}", f"InvLoc5-{suffix}", "20"]],
    )

    resp = await client.post(
        "/imports/upload?entity_type=inventory",
        files={"data": ("inventory.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1
