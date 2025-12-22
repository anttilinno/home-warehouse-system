"""End-to-end tests for dashboard flow against the real app."""

from uuid import uuid7

import pytest


@pytest.mark.asyncio
async def test_dashboard_stats_endpoint(client):
    """Test the dashboard stats endpoint."""
    suffix = uuid7().hex

    # Create some data
    category_resp = await client.post(
        "/categories/",
        json={"name": f"DashCat-{suffix}", "description": "dashboard test"},
    )
    assert category_resp.status_code == 201

    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-DASH-{suffix}",
            "name": "DashboardItem",
            "description": None,
            "category_id": category_resp.json()["id"],
        },
    )
    assert item_resp.status_code == 201

    loc_resp = await client.post(
        "/locations/",
        json={"name": f"DashLoc-{suffix}", "zone": "D", "shelf": "1", "bin": "1", "description": None},
    )
    assert loc_resp.status_code == 201

    # Get stats
    stats_resp = await client.get("/dashboard/stats")
    assert stats_resp.status_code == 200

    stats = stats_resp.json()
    assert "total_items" in stats
    assert "total_locations" in stats
    assert "active_loans" in stats
    assert "total_categories" in stats

    assert stats["total_items"] >= 1
    assert stats["total_locations"] >= 1
    assert stats["total_categories"] >= 1


@pytest.mark.asyncio
async def test_dashboard_extended_stats_endpoint(client):
    """Test the dashboard extended stats endpoint."""
    suffix = uuid7().hex

    # Create basic data
    category_resp = await client.post(
        "/categories/",
        json={"name": f"ExtCat-{suffix}", "description": "extended stats test"},
    )
    category_id = category_resp.json()["id"]

    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-EXT-{suffix}",
            "name": "ExtendedItem",
            "description": None,
            "category_id": category_id,
        },
    )
    item_id = item_resp.json()["id"]

    loc_resp = await client.post(
        "/locations/",
        json={"name": f"ExtLoc-{suffix}", "zone": "E", "shelf": "1", "bin": "1", "description": None},
    )
    location_id = loc_resp.json()["id"]

    # Create inventory
    await client.post(
        "/inventory/",
        json={"item_id": item_id, "location_id": location_id, "quantity": 10},
    )

    # Get extended stats
    stats_resp = await client.get("/dashboard/stats/extended")
    assert stats_resp.status_code == 200

    stats = stats_resp.json()
    # Basic stats
    assert "total_items" in stats
    assert "total_locations" in stats
    assert "active_loans" in stats
    assert "total_categories" in stats
    # Extended stats
    assert "total_inventory_value" in stats
    assert "currency_code" in stats
    assert "out_of_stock_count" in stats
    assert "low_stock_count" in stats
    assert "expiring_soon_count" in stats
    assert "warranty_expiring_count" in stats
    assert "overdue_loans_count" in stats


@pytest.mark.asyncio
async def test_dashboard_recently_modified(client):
    """Test the dashboard recently modified endpoint."""
    suffix = uuid7().hex

    # Create data
    category_resp = await client.post(
        "/categories/",
        json={"name": f"RecentCat-{suffix}", "description": "recent test"},
    )
    category_id = category_resp.json()["id"]

    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-RECENT-{suffix}",
            "name": "RecentItem",
            "description": None,
            "category_id": category_id,
        },
    )
    item_id = item_resp.json()["id"]

    loc_resp = await client.post(
        "/locations/",
        json={"name": f"RecentLoc-{suffix}", "zone": "R", "shelf": "1", "bin": "1", "description": None},
    )
    location_id = loc_resp.json()["id"]

    # Create inventory
    inv_resp = await client.post(
        "/inventory/",
        json={"item_id": item_id, "location_id": location_id, "quantity": 25},
    )
    assert inv_resp.status_code == 201
    inventory_id = inv_resp.json()["id"]

    # Get recently modified
    recent_resp = await client.get("/dashboard/recent?limit=5")
    assert recent_resp.status_code == 200

    recent = recent_resp.json()
    assert isinstance(recent, list)
    # Our new item should be in the list
    assert any(r["id"] == inventory_id for r in recent)

    # Verify structure
    if recent:
        item = recent[0]
        assert "id" in item
        assert "item_name" in item
        assert "item_sku" in item
        assert "location_name" in item
        assert "quantity" in item
        assert "updated_at" in item


@pytest.mark.asyncio
async def test_dashboard_out_of_stock(client):
    """Test the dashboard out of stock endpoint."""
    suffix = uuid7().hex

    # Create data with zero quantity
    category_resp = await client.post(
        "/categories/",
        json={"name": f"OOSCat-{suffix}", "description": "out of stock test"},
    )
    category_id = category_resp.json()["id"]

    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-OOS-{suffix}",
            "name": "OutOfStockItem",
            "description": None,
            "category_id": category_id,
        },
    )
    item_id = item_resp.json()["id"]

    loc_resp = await client.post(
        "/locations/",
        json={"name": f"OOSLoc-{suffix}", "zone": "O", "shelf": "1", "bin": "1", "description": None},
    )
    location_id = loc_resp.json()["id"]

    # Create inventory with zero quantity
    inv_resp = await client.post(
        "/inventory/",
        json={"item_id": item_id, "location_id": location_id, "quantity": 0},
    )
    assert inv_resp.status_code == 201
    inventory_id = inv_resp.json()["id"]

    # Get out of stock
    oos_resp = await client.get("/dashboard/alerts/out-of-stock")
    assert oos_resp.status_code == 200

    oos = oos_resp.json()
    assert isinstance(oos, list)
    assert any(r["id"] == inventory_id for r in oos)


@pytest.mark.asyncio
async def test_dashboard_low_stock(client):
    """Test the dashboard low stock endpoint."""
    suffix = uuid7().hex

    # Create data with low quantity (1-4)
    category_resp = await client.post(
        "/categories/",
        json={"name": f"LowCat-{suffix}", "description": "low stock test"},
    )
    category_id = category_resp.json()["id"]

    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-LOW-{suffix}",
            "name": "LowStockItem",
            "description": None,
            "category_id": category_id,
        },
    )
    item_id = item_resp.json()["id"]

    loc_resp = await client.post(
        "/locations/",
        json={"name": f"LowLoc-{suffix}", "zone": "L", "shelf": "1", "bin": "1", "description": None},
    )
    location_id = loc_resp.json()["id"]

    # Create inventory with low quantity
    inv_resp = await client.post(
        "/inventory/",
        json={"item_id": item_id, "location_id": location_id, "quantity": 2},
    )
    assert inv_resp.status_code == 201
    inventory_id = inv_resp.json()["id"]

    # Get low stock
    low_resp = await client.get("/dashboard/alerts/low-stock")
    assert low_resp.status_code == 200

    low = low_resp.json()
    assert isinstance(low, list)
    assert any(r["id"] == inventory_id for r in low)


@pytest.mark.asyncio
async def test_dashboard_expiring_soon(client):
    """Test the dashboard expiring soon endpoint."""
    # This endpoint should return items expiring in next 30 days
    # For now, just test the endpoint returns successfully
    resp = await client.get("/dashboard/alerts/expiring")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_dashboard_warranty_expiring(client):
    """Test the dashboard warranty expiring endpoint."""
    # This endpoint should return items with warranty expiring in next 30 days
    # For now, just test the endpoint returns successfully
    resp = await client.get("/dashboard/alerts/warranty-expiring")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_dashboard_overdue_loans(client, test_workspace_id):
    """Test the dashboard overdue loans endpoint."""
    # Simply test that the endpoint works and returns the expected structure
    # Creating actual overdue loans requires complex setup with proper FK relationships
    overdue_resp = await client.get("/dashboard/alerts/overdue-loans")
    assert overdue_resp.status_code == 200

    overdue = overdue_resp.json()
    assert isinstance(overdue, list)

    # If there are any overdue loans, verify the structure
    if overdue:
        loan = overdue[0]
        assert "id" in loan
        assert "borrower_name" in loan
        assert "item_name" in loan
        assert "quantity" in loan
        assert "due_date" in loan
        assert "days_overdue" in loan
