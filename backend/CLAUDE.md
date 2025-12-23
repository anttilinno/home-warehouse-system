# Backend CLAUDE.md

Backend-specific guidance for Claude Code when working in the `backend/` directory.

## Tech Stack

- **Python 3.14** with type hints
- **Litestar** - ASGI web framework
- **Advanced Alchemy** - SQLAlchemy integration for Litestar
- **asyncpg** - Async PostgreSQL driver
- **msgspec** - Fast serialization/deserialization
- **Granian** - ASGI server
- **RQ (Redis Queue)** - Background job processing
- **Passlib + Argon2** - Password hashing
- **PyJWT** - JWT token handling

## Project Structure

```
backend/
├── src/warehouse/
│   ├── app.py              # Litestar application factory
│   ├── config.py           # Configuration settings
│   ├── database.py         # Database connection setup
│   ├── errors.py           # Custom exception classes
│   ├── lib/                # Shared utilities
│   │   ├── base.py         # Base repository/service classes
│   │   ├── workspace.py    # Workspace context utilities
│   │   └── rq.py           # Redis Queue helpers
│   ├── domain/             # Domain modules (see below)
│   └── tests/              # Core tests
├── db/migrations/          # dbmate SQL migrations
├── e2e/                    # End-to-end tests
├── scripts/                # Utility scripts
└── pyproject.toml          # Project configuration
```

## Domain Module Structure

Each domain module follows the same pattern:

```
domain/<module>/
├── __init__.py
├── models.py       # SQLAlchemy ORM models
├── schemas.py      # msgspec Structs for request/response DTOs
├── repository.py   # Data access layer (extends BaseRepository)
├── service.py      # Business logic layer (extends BaseService)
├── controllers.py  # Litestar route handlers
└── tests/          # Unit tests for the module
```

### Domain Modules

- **auth** - User authentication, JWT, workspaces, members
- **items** - Item catalog (products/things to track)
- **inventory** - Physical instances of items at locations
- **locations** - Storage locations (hierarchical)
- **containers** - Storage containers within locations
- **loans** - Item lending/borrowing system
- **notifications** - User notifications
- **dashboard** - Dashboard statistics and summaries
- **analytics** - Reporting and analytics

## Architecture Patterns

### Repository Pattern
```python
from warehouse.lib.base import BaseRepository

class ItemRepository(BaseRepository[Item]):
    model_type = Item
```

### Service Pattern
```python
from warehouse.lib.base import BaseService

class ItemService(BaseService[Item]):
    repository: ItemRepository

    async def create_item(self, data: ItemCreate, workspace_id: UUID) -> Item:
        # Business logic here
        return await self.repository.add(Item(**data.to_dict(), workspace_id=workspace_id))
```

### Controller Pattern
```python
from litestar import Controller, get, post

class ItemController(Controller):
    path = "/items"
    dependencies = {"service": Provide(provide_item_service)}

    @get()
    async def list_items(self, service: ItemService) -> list[ItemResponse]:
        return await service.list()
```

## Multi-Tenancy

All warehouse data is isolated by `workspace_id`. Services automatically filter by the current user's workspace context.

```python
# Workspace context is injected via dependency injection
async def provide_workspace_context(request: Request) -> WorkspaceContext:
    # Returns current user's workspace
```

## Testing

### Running Tests
```bash
mise run test           # All tests
mise run test-unit      # Unit tests only (no DB)
mise run test-e2e       # E2E tests (requires PostgreSQL)
```

### Test Structure
- **Unit tests**: `src/warehouse/domain/<module>/tests/` - Mock dependencies
- **Core tests**: `src/warehouse/tests/` and `src/warehouse/lib/tests/`
- **E2E tests**: `e2e/` - Full integration with real database

### Writing Tests
```python
import pytest
from unittest.mock import AsyncMock

@pytest.fixture
def mock_repository():
    return AsyncMock(spec=ItemRepository)

async def test_create_item(mock_repository):
    service = ItemService(repository=mock_repository)
    # Test service logic with mocked repository
```

## Database

### Migrations
Migrations use dbmate with raw SQL files in `db/migrations/`:
```bash
mise run migrate        # Apply migrations
mise run migrate-new    # Create new migration
mise run db-reset       # Reset database
```

### Schemas
- **auth** - Users, workspaces, workspace_members
- **warehouse** - All inventory-related tables

### Key Conventions
- UUIDv7 for all primary keys
- `workspace_id` on all warehouse tables for multi-tenancy
- `created_at`, `updated_at` timestamps on all tables
- Soft deletes where appropriate

## Common Commands

```bash
mise run dev            # Start dev server with auto-reload
mise run test           # Run all tests
mise run lint           # Run ruff linter
mise run format         # Format code with ruff
mise run rq-worker      # Start background job worker
```

## Environment Variables

```bash
DATABASE_URL=postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
APP_DEBUG=true
```

## Code Style

- **Linter**: ruff (line length 100)
- **Type hints**: Required for function signatures
- **Async**: All database operations are async
- **Imports**: Sorted by ruff (isort compatible)
