# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Home Warehouse System - a multi-tenant home inventory management system for tracking items, locations, containers, and loans. Supports workspaces for multi-user collaboration with role-based access control.

## Tech Stack

- **Backend**: Python 3.14, Litestar framework, Granian ASGI server
- **Frontend**: Next.js 16, React 19, shadcn/ui, Tailwind CSS 4
- **Database**: PostgreSQL with dbmate migrations
- **Package Management**: uv (Python), bun (JavaScript)
- **Tool Management**: mise

## Common Commands

All commands are run via mise:

```bash
# Database
mise run dc-up          # Start all containers (PostgreSQL + Redis)
mise run dc-down        # Stop all containers
mise run migrate        # Run database migrations
mise run migrate-new    # Create new migration
mise run db-reset       # Drop and recreate database with fresh migrations
mise run db-fresh       # Complete reset including data volume

# Backend
mise run dev            # Run backend dev server (with auto-reload)
mise run test           # Run all tests
mise run test-unit      # Run unit tests only
mise run test-e2e       # Run E2E tests
mise run lint           # Run linter
mise run format         # Format code
mise run rq-worker      # Run RQ worker for loan jobs

# Frontend
mise run fe-install     # Install frontend dependencies
mise run fe-dev         # Run frontend dev server
mise run fe-build       # Build frontend for production
```

## Database Architecture

The database uses two schemas:
- **auth**: User authentication, workspaces, and role-based permissions
- **warehouse**: Core inventory functionality (multi-tenant via workspace_id)

### Auth Schema
- **users**: User authentication (email, full_name, password_hash, is_superuser)
- **workspaces**: Isolated environments with name, slug, description
- **workspace_members**: User-workspace links with roles (owner, admin, member, viewer)

### Warehouse Schema
All tables include `workspace_id` for multi-tenant isolation.

Key entities:
- **categories**: Hierarchical categories (self-referencing parent_category_id)
- **locations**: Hierarchical storage locations (parent_location, zone, shelf, bin, short_code)
- **containers**: Storage containers within locations (short_code for QR labels)
- **items**: Item catalog with SKU, category, brand, model, serial_number, manufacturer, search_vector, short_code
- **labels**: Structured labels with colors for categorizing items
- **item_labels**: Many-to-many junction table for item-label relationships
- **inventory**: Physical instances of items at locations/containers with condition, status, pricing
- **container_tags**: RFID/NFC/QR tags for containers
- **borrowers**: People who borrow items
- **loans**: Tracks inventory loans (references inventory, not items directly)
- **inventory_movements**: Movement history tracking

### ENUMs
- **workspace_role_enum**: owner, admin, member, viewer
- **item_condition_enum**: NEW, EXCELLENT, GOOD, FAIR, POOR, DAMAGED, FOR_REPAIR
- **item_status_enum**: AVAILABLE, IN_USE, RESERVED, ON_LOAN, IN_TRANSIT, DISPOSED, MISSING
- **tag_type_enum**: RFID, NFC, QR
- **attachment_type_enum**: PHOTO, MANUAL, RECEIPT, WARRANTY, OTHER

All tables use UUIDv7 for primary keys. See DATABASE.md for full schema documentation.

## Testing

- **99% coverage** on backend
- Unit tests: Domain services, repositories, schemas, controllers under `src/warehouse/domain/**/tests/`
- Core tests: `src/warehouse/tests/` and `src/warehouse/lib/tests/`
- E2E tests: `e2e/` directory (requires running Postgres)
- Controllers tested by invoking handlers directly with mocked services

## Environment

- `DATABASE_URL`: PostgreSQL connection string for async driver (default: `postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev`)
- `DBMATE_DATABASE_URL`: PostgreSQL connection string for dbmate migrations
- `APP_DEBUG`: Enable debug mode

## Project Structure

```
.
├── backend/              # Python backend (Litestar)
│   ├── src/             # Source code
│   ├── db/migrations/   # Database migrations (dbmate)
│   └── e2e/             # End-to-end tests
├── frontend/            # Next.js frontend
└── docker-compose.yml   # PostgreSQL service
```
