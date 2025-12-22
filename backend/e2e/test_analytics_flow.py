"""End-to-end tests for analytics flow against the real app."""

from uuid import uuid7

import pytest


@pytest.mark.asyncio
async def test_analytics_endpoint(client, test_workspace_id):
    """Test the analytics endpoint returns complete data."""
    suffix = uuid7().hex

    # Setup: Create some data to have meaningful analytics
    # Create category
    category_resp = await client.post(
        "/categories/",
        json={"name": f"AnalyticsCat-{suffix}", "description": "for analytics"},
    )
    assert category_resp.status_code == 201
    category_id = category_resp.json()["id"]

    # Create item
    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-ANA-{suffix}",
            "name": "AnalyticsItem",
            "description": "item for analytics",
            "category_id": category_id,
        },
    )
    assert item_resp.status_code == 201
    item_id = item_resp.json()["id"]

    # Create location
    loc_resp = await client.post(
        "/locations/",
        json={"name": f"AnalyticsLoc-{suffix}", "zone": "A", "shelf": "1", "bin": "1", "description": None},
    )
    assert loc_resp.status_code == 201
    location_id = loc_resp.json()["id"]

    # Create inventory
    inv_resp = await client.post(
        "/inventory/",
        json={"item_id": item_id, "location_id": location_id, "quantity": 50},
    )
    assert inv_resp.status_code == 201

    # Create borrower
    borrower_resp = await client.post(
        "/borrowers/",
        json={"name": f"AnalyticsBorrower-{suffix}", "email": f"{suffix}@analytics.test", "phone": "111", "notes": None},
    )
    assert borrower_resp.status_code == 201

    # Get analytics
    analytics_resp = await client.get("/analytics/")
    assert analytics_resp.status_code == 200

    data = analytics_resp.json()

    # Verify response structure
    assert "inventory_by_status" in data
    assert "inventory_by_condition" in data
    assert "category_breakdown" in data
    assert "location_breakdown" in data
    assert "loan_stats" in data
    assert "asset_value" in data
    assert "top_borrowers" in data
    assert "total_items" in data
    assert "total_inventory_records" in data
    assert "total_locations" in data
    assert "total_containers" in data

    # Verify we have some data
    assert data["total_items"] >= 1
    assert data["total_inventory_records"] >= 1
    assert data["total_locations"] >= 1

    # Verify loan_stats structure
    loan_stats = data["loan_stats"]
    assert "total_loans" in loan_stats
    assert "active_loans" in loan_stats
    assert "returned_loans" in loan_stats
    assert "overdue_loans" in loan_stats

    # Verify asset_value structure
    asset_value = data["asset_value"]
    assert "total_value" in asset_value
    assert "currency_code" in asset_value
    assert "item_count" in asset_value


@pytest.mark.asyncio
async def test_analytics_with_loans(client, test_workspace_id):
    """Test analytics includes loan statistics."""
    suffix = uuid7().hex
    from uuid import UUID

    # Setup prerequisites
    borrower_resp = await client.post(
        "/borrowers/",
        json={"name": f"LoanAnalytics-{suffix}", "email": f"{suffix}@loan.test", "phone": "222", "notes": None},
    )
    borrower_id = borrower_resp.json()["id"]

    category_resp = await client.post(
        "/categories/",
        json={"name": f"LoanCat-{suffix}", "description": "loan analytics"},
    )
    category_id = category_resp.json()["id"]

    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-LOAN-ANA-{suffix}",
            "name": "LoanAnalyticsItem",
            "description": None,
            "category_id": category_id,
        },
    )
    item_id = item_resp.json()["id"]

    loc_resp = await client.post(
        "/locations/",
        json={"name": f"LoanLoc-{suffix}", "zone": "L", "shelf": "1", "bin": "1", "description": None},
    )
    location_id = loc_resp.json()["id"]

    inv_resp = await client.post(
        "/inventory/",
        json={"item_id": item_id, "location_id": location_id, "quantity": 10},
    )
    inventory_id = inv_resp.json()["id"]

    # Create loan directly via service (bypass async queue)
    from warehouse.domain.loans.jobs import create_loan_job

    loan_data = {
        "workspace_id": test_workspace_id,
        "inventory_id": inventory_id,
        "borrower_id": borrower_id,
        "quantity": 1,
        "due_date": None,
        "notes": "for analytics test",
    }
    await create_loan_job(loan_data)

    # Get analytics and verify loan stats
    analytics_resp = await client.get("/analytics/")
    assert analytics_resp.status_code == 200

    data = analytics_resp.json()
    assert data["loan_stats"]["total_loans"] >= 1
    assert data["loan_stats"]["active_loans"] >= 1
