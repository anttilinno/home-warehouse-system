"""End-to-end tests for borrowers against the real app."""

from uuid import uuid7

import pytest


@pytest.mark.asyncio
async def test_borrower_crud_flow(client):
    suffix = uuid7().hex
    create_resp = await client.post(
        "/borrowers/",
        json={
            "name": f"Borrower-{suffix}",
            "email": f"{suffix}@example.com",
            "phone": "555-1234",
            "notes": "initial",
        },
    )
    assert create_resp.status_code == 201
    borrower_id = create_resp.json()["id"]

    list_resp = await client.get("/borrowers/")
    assert list_resp.status_code == 200
    assert any(b["id"] == borrower_id for b in list_resp.json())

    get_resp = await client.get(f"/borrowers/{borrower_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["email"] == f"{suffix}@example.com"

    update_resp = await client.patch(
        f"/borrowers/{borrower_id}",
        json={
            "name": "Borrower-Updated",
            "email": f"{suffix}@new.example.com",
            "phone": "999-9999",
            "notes": "updated",
        },
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Borrower-Updated"
    assert update_resp.json()["email"] == f"{suffix}@new.example.com"
    assert update_resp.json()["phone"] == "999-9999"
    assert update_resp.json()["notes"] == "updated"

    delete_resp = await client.delete(f"/borrowers/{borrower_id}")
    assert delete_resp.status_code in (200, 204)

    missing_resp = await client.get(f"/borrowers/{borrower_id}")
    assert missing_resp.status_code == 404


@pytest.mark.asyncio
async def test_update_missing_borrower_returns_404(client):
    resp = await client.patch(f"/borrowers/{uuid7()}", json={"name": "missing"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_borrower_with_loans_returns_400(client, test_workspace_id):
    suffix = uuid7().hex
    from uuid import UUID
    workspace_id = UUID(test_workspace_id)

    borrower_resp = await client.post(
        "/borrowers/",
        json={
            "name": f"Borrower-{suffix}",
            "email": f"{suffix}@example.com",
            "phone": "555-1234",
            "notes": "initial",
        },
    )
    borrower_id = borrower_resp.json()["id"]

    cat_resp = await client.post(
        "/categories/",
        json={"name": f"Loans-{suffix}", "description": "loan-cat"},
    )
    item_resp = await client.post(
        "/items/",
        json={
            "sku": f"SKU-LOAN-{suffix}",
            "name": "Loanable",
            "description": "loan item",
            "category_id": cat_resp.json()["id"],
        },
    )
    loc_resp = await client.post(
        "/locations/",
        json={"name": f"Loc-{suffix}", "zone": "A", "shelf": "1", "bin": "1", "description": None},
    )
    inv_resp = await client.post(
        "/inventory/",
        json={"item_id": item_resp.json()["id"], "location_id": loc_resp.json()["id"], "quantity": 5},
    )
    inventory_id = inv_resp.json()["id"]

    # Create loan synchronously for this test to ensure it blocks borrower deletion
    from warehouse.app import create_app
    from warehouse.config import Config
    import asyncio
    from warehouse.domain.loans.service import LoanService
    from warehouse.domain.loans.repository import LoanRepository
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from warehouse.database import get_db_config

    app = create_app()
    async with app.lifespan():
        import os
        engine = create_async_engine(
            os.getenv("DATABASE_URL", "postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev")
        )
        session_maker = async_sessionmaker(engine, expire_on_commit=False)

        async with session_maker() as session:
            repo = LoanRepository(session=session)
            service = LoanService(repository=repo)

            from warehouse.domain.loans.schemas import LoanCreate
            loan_data = LoanCreate(
                inventory_id=UUID(inventory_id),
                borrower_id=UUID(borrower_id),
                quantity=1,
                notes=None,
                due_date=None,
            )
            await service.create_loan(loan_data, workspace_id)
        await engine.dispose()

    delete_resp = await client.delete(f"/borrowers/{borrower_id}")
    assert delete_resp.status_code == 400
    detail = delete_resp.json().get("detail", "")
    assert "Borrower has existing loans" in detail
