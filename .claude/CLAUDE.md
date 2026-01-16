# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Home Warehouse System - a multi-tenant home inventory management system for tracking items, locations, containers, and loans. Supports workspaces for multi-user collaboration with role-based access control.

## Tech Stack

- **Backend**: Go 1.25, Chi router, sqlc for type-safe SQL
- **Frontend**: Next.js 16, React 19, shadcn/ui, Tailwind CSS 4, PWA (Serwist)
- **Database**: PostgreSQL with dbmate migrations
- **Package Management**: bun (JavaScript)
- **Tool Management**: mise

See `frontend/CLAUDE.md` for detailed frontend documentation.

## Project Structure

```
.
├── backend/              # Go backend
│   ├── cmd/
│   │   ├── server/      # API server entry point
│   │   └── worker/      # Background worker entry point
│   ├── internal/        # Application code (domain, handlers, middleware)
│   ├── db/migrations/   # Database migrations (dbmate)
│   └── tests/           # Integration tests
├── frontend/            # Next.js frontend - see frontend/CLAUDE.md
└── docker-compose.yml   # PostgreSQL + Redis services
```

## Common Commands

All commands are run via mise:

```bash
# Infrastructure
mise run dc-up          # Start all containers (PostgreSQL + Redis)
mise run dc-down        # Stop all containers

# Database
mise run migrate        # Run database migrations
mise run migrate-new    # Create new migration
mise run db-reset       # Drop and recreate database with fresh migrations
mise run db-fresh       # Complete reset including data volume

# Backend (Go)
mise run dev            # Run backend dev server (with hot reload via air)
mise run worker         # Run background import worker
mise run build          # Build backend binary
mise run build-worker   # Build worker binary
mise run test           # Run all tests
mise run test-unit      # Run unit tests only
mise run test-integration # Run integration tests
mise run lint           # Run golangci-lint
mise run fmt            # Format Go code
mise run sqlc           # Generate sqlc code from queries

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
- **pending_changes**: Change approval queue for member role (stores create/update/delete operations pending admin approval)

### ENUMs
- **workspace_role_enum**: owner, admin, member, viewer
- **item_condition_enum**: NEW, EXCELLENT, GOOD, FAIR, POOR, DAMAGED, FOR_REPAIR
- **item_status_enum**: AVAILABLE, IN_USE, RESERVED, ON_LOAN, IN_TRANSIT, DISPOSED, MISSING
- **tag_type_enum**: RFID, NFC, QR
- **attachment_type_enum**: PHOTO, MANUAL, RECEIPT, WARRANTY, OTHER
- **pending_change_action_enum**: create, update, delete
- **pending_change_status_enum**: pending, approved, rejected

All tables use UUIDv7 for primary keys. See DATABASE.md for full schema documentation.

## Approval Pipeline

The system includes a role-based approval pipeline that intercepts CRUD operations from members and routes them through admin approval:

- **Owner/Admin**: Changes applied immediately (bypass approval)
- **Member**: Create/update/delete operations require admin approval (202 Accepted response)
- **Viewer**: Read-only access (no changes allowed)

When a member submits a change, it's stored in `pending_changes` table with status "pending". Admins can review, approve (applies the change), or reject (with reason) through the approval queue UI. Real-time SSE notifications inform users of approval decisions.

See `docs/APPROVAL_PIPELINE.md` for complete documentation and `frontend/docs/PENDING_CHANGES_INTEGRATION.md` for frontend integration guide.

## Environment Variables

```bash
# Database
GO_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_dev?sslmode=disable
DBMATE_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_dev?sslmode=disable

# Backend
JWT_SECRET=your-secret-key
APP_DEBUG=true
REDIS_URL=redis://localhost:6379

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```
