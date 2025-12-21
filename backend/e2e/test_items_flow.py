"""End-to-end tests for items against the real app."""

import os
from uuid import uuid7

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from warehouse.domain.items.repository import CategoryRepository, ItemRepository
from warehouse.domain.items.schemas import ItemCreate
from warehouse.domain.items.service import CategoryService, ItemService


@pytest.mark.asyncio
async def test_item_crud_flow(client):
    suffix = uuid7().hex

    # Category prerequisite
    category_resp = await client.post(
        "/categories/",
        json={"name": f"Items-{suffix}", "description": "items-cat"},
    )
    assert category_resp.status_code == 201
    category_id = category_resp.json()["id"]

    # Second category for update path
    category_resp_2 = await client.post(
        "/categories/",
        json={"name": f"Items2-{suffix}", "description": "items-cat-2"},
    )
    assert category_resp_2.status_code == 201
    category_id_2 = category_resp_2.json()["id"]

    create_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-{suffix}",
            "name": "Widget",
            "description": "First",
            "category_id": category_id,
        },
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    list_resp = await client.get("/items/")
    assert list_resp.status_code == 200
    assert any(i["id"] == item_id for i in list_resp.json())

    get_resp = await client.get(f"/items/{item_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["sku"] == f"SKU-{suffix}"

    update_resp = await client.patch(
        f"/items/{item_id}",
        json={"name": "Widget-Updated", "description": "Updated", "category_id": category_id_2},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Widget-Updated"
    assert update_resp.json()["description"] == "Updated"
    assert update_resp.json()["category_id"] == category_id_2

    delete_resp = await client.delete(f"/items/{item_id}")
    assert delete_resp.status_code in (200, 204)

    missing_resp = await client.get(f"/items/{item_id}")
    assert missing_resp.status_code == 404


@pytest.mark.asyncio
async def test_get_missing_item_returns_404(client):
    resp = await client.get(f"/items/{uuid7()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_item_update_and_delete_missing(client):
    missing_id = uuid7()

    update_resp = await client.patch(
        f"/items/{missing_id}",
        json={"name": "Missing", "description": "None"},
    )
    assert update_resp.status_code == 404

    delete_resp = await client.delete(f"/items/{missing_id}")
    assert delete_resp.status_code == 404


@pytest.mark.asyncio
async def test_item_service_branches(client, test_workspace_id):
    suffix = uuid7().hex
    from uuid import UUID
    workspace_id = UUID(test_workspace_id)

    # Category and item setup
    cat_resp = await client.post(
        "/categories/",
        json={"name": f"Svc-{suffix}", "description": None},
    )
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SVC-{suffix}",
            "name": "SvcItem",
            "description": None,
            "category_id": cat_id,
        },
    )
    assert item_resp.status_code == 201

    engine = create_async_engine(
        os.getenv("DATABASE_URL", "postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev")
    )
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as session:
        cat_repo = CategoryRepository(session=session)
        cat_service = CategoryService(cat_repo)
        fetched_cat = await cat_service.get_category(cat_id, workspace_id)
        assert fetched_cat is not None

        item_repo = ItemRepository(session=session)
        item_service = ItemService(item_repo)
        # Duplicate SKU raises AppError
        from warehouse.errors import AppError, ErrorCode
        with pytest.raises(AppError) as exc_info:
            await item_service.create_item(
                ItemCreate(
                    sku=f"SVC-{suffix}",
                    name="Other",
                    description=None,
                    category_id=cat_id,
                ),
                workspace_id,
            )
        assert exc_info.value.code == ErrorCode.ITEM_DUPLICATE_SKU
    await engine.dispose()
