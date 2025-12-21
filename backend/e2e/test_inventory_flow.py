"""End-to-end tests for inventory flow against the real app."""

import os
from uuid import uuid7

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from warehouse.domain.inventory.repository import InventoryRepository
from warehouse.domain.inventory.schemas import InventoryCreate
from warehouse.domain.inventory.service import InventoryService
from warehouse.errors import AppError


@pytest.mark.asyncio
async def test_full_inventory_flow(client):
    suffix = uuid7().hex
    # Category
    cat_resp = await client.post(
        "/categories/",
        json={"name": f"Tools-{suffix}", "description": None},
    )
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    # Item
    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-{suffix}",
            "name": "Hammer",
            "description": "Steel",
            "category_id": cat_id,
        },
    )
    assert item_resp.status_code == 201
    item_id = item_resp.json()["id"]

    # Location
    loc_resp = await client.post(
        "/locations/",
        json={"name": f"Rack-{suffix}", "zone": "A", "shelf": "1", "bin": "B", "description": "rack"},
    )
    assert loc_resp.status_code == 201
    loc_id = loc_resp.json()["id"]

    # Inventory create
    inv_resp = await client.post(
        "/inventory/",
        json={"item_id": item_id, "location_id": loc_id, "quantity": 5},
    )
    assert inv_resp.status_code == 201
    inv_id = inv_resp.json()["id"]

    # List inventory
    list_resp = await client.get("/inventory/")
    assert list_resp.status_code == 200
    assert any(entry["id"] == inv_id for entry in list_resp.json())

    # Get inventory
    get_resp = await client.get(f"/inventory/{inv_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["item_id"] == item_id

    # Update inventory
    upd_resp = await client.patch(f"/inventory/{inv_id}", json={"quantity": 8})
    assert upd_resp.status_code == 200
    assert upd_resp.json()["quantity"] == 8

    # Adjust stock
    adj_resp = await client.patch(f"/inventory/{inv_id}/adjust", json={"quantity_change": -3})
    assert adj_resp.status_code == 200
    assert adj_resp.json()["quantity"] == 5

    # Delete inventory
    del_resp = await client.delete(f"/inventory/{inv_id}")
    assert del_resp.status_code in (200, 204)
    # Verify gone
    missing_resp = await client.get(f"/inventory/{inv_id}")
    assert missing_resp.status_code == 404

    # Negative: get missing inventory id
    missing = uuid7()
    missing_resp2 = await client.get(f"/inventory/{missing}")
    assert missing_resp2.status_code == 404


@pytest.mark.asyncio
async def test_inventory_negative_paths(client, test_workspace_id):
    # Create prerequisites
    suffix = uuid7().hex
    from uuid import UUID
    workspace_id = UUID(test_workspace_id)

    cat = await client.post(
        "/categories/",
        json={"name": f"InvNeg-{suffix}", "description": None},
    )
    item = await client.post(
        "/items/",
        json={
            "sku": f"INVNEG-{suffix}",
            "name": "NegItem",
            "description": None,
            "category_id": cat.json()["id"],
        },
    )
    loc = await client.post(
        "/locations/",
        json={"name": f"InvLoc-{suffix}", "zone": "Z", "shelf": "9", "bin": "9", "description": None},
    )

    inv = await client.post(
        "/inventory/",
        json={"item_id": item.json()["id"], "location_id": loc.json()["id"], "quantity": 1},
    )
    inv_id = inv.json()["id"]

    missing_id = uuid7()

    # Update missing inventory -> 404 branch
    upd_missing = await client.patch(f"/inventory/{missing_id}", json={"quantity": 10})
    assert upd_missing.status_code == 404

    # Adjust missing inventory -> 404 branch
    adj_missing = await client.patch(f"/inventory/{missing_id}/adjust", json={"quantity_change": 1})
    assert adj_missing.status_code == 404

    # Delete missing inventory -> 404 branch
    del_missing = await client.delete(f"/inventory/{missing_id}")
    assert del_missing.status_code == 404

    # Negative stock adjust -> 400
    adj_negative = await client.patch(f"/inventory/{inv_id}/adjust", json={"quantity_change": -5})
    assert adj_negative.status_code == 400
    detail = adj_negative.json().get("detail", "")
    assert "Stock cannot be negative" in detail

    # Duplicate inventory create -> 400
    dup_resp = await client.post(
        "/inventory/",
        json={"item_id": item.json()["id"], "location_id": loc.json()["id"], "quantity": 1},
    )
    assert dup_resp.status_code == 400
    dup_detail = dup_resp.json().get("detail", "")
    assert "Inventory record already exists" in dup_detail

    # Direct service call to cover get_by_item_and_location and duplicate guard.
    engine = create_async_engine(
        os.getenv("DATABASE_URL", "postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev")
    )
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as session:
        repo = InventoryRepository(session=session)
        service = InventoryService(repo)
        found = await service.get_by_item_and_location(item.json()["id"], loc.json()["id"], workspace_id)
        assert found is not None
        with pytest.raises(AppError):
            await service.create_inventory(
                InventoryCreate(
                    item_id=item.json()["id"], location_id=loc.json()["id"], quantity=2
                ),
                workspace_id,
            )
    await engine.dispose()

