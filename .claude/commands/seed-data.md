# Seed Test Data

Add test data to the database. Use argument to specify what type: `expiring`, `warranty`, `low-stock`, `overdue`, `locations`, or `all`.

## Database Connection

```python
DATABASE_URL = "postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev"

engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async with async_session() as session:
    # Get workspace
    result = await session.execute(text("SELECT id FROM auth.workspaces LIMIT 1"))
    workspace_id = result.fetchone()[0]

    # Your queries here...
    await session.commit()

await engine.dispose()
```

## Run Command

```bash
mise exec -- uv run python << 'EOF'
import asyncio
from datetime import date, timedelta
from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev"

async def seed():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(text("SELECT id FROM auth.workspaces LIMIT 1"))
        workspace_id = result.fetchone()[0]
        print(f"Workspace: {workspace_id}")

        # ADD YOUR DATA HERE

        await session.commit()
    await engine.dispose()

asyncio.run(seed())
EOF
```

## Key Tables

- `warehouse.items` - Item catalog (sku, name, description, category_id)
- `warehouse.inventory` - Stock (item_id, location_id, quantity, expiration_date, warranty_expires)
- `warehouse.locations` - Storage locations (name, parent_location, zone, shelf, bin)
- `warehouse.loans` - Loans (inventory_id, borrower_id, due_date, returned_at)
- `warehouse.borrowers` - Borrowers (name, email, phone)

## Example: Add Expiring Items

```python
# Update existing inventory with expiration dates
result = await session.execute(text("""
    SELECT id FROM warehouse.inventory
    WHERE workspace_id = :ws_id LIMIT 3
"""), {"ws_id": workspace_id})

today = date.today()
for i, (inv_id,) in enumerate(result.fetchall()):
    exp_date = today + timedelta(days=5 + i * 7)
    await session.execute(text("""
        UPDATE warehouse.inventory
        SET expiration_date = :exp_date
        WHERE id = :inv_id
    """), {"exp_date": exp_date, "inv_id": inv_id})
```

## Example: Create Location Hierarchy

```python
parent_id = None
for name in ["Building A", "Floor 2", "Section N", "Aisle 5", "Rack 12"]:
    loc_id = str(uuid4())
    await session.execute(text("""
        INSERT INTO warehouse.locations (id, workspace_id, parent_location, name)
        VALUES (:id, :ws_id, :parent_id, :name)
    """), {"id": loc_id, "ws_id": workspace_id, "parent_id": parent_id, "name": name})
    parent_id = loc_id
```
