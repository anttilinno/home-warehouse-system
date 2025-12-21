# Home Warehouse System

A home warehouse management system for tracking inventory, locations, containers, and loans.

## Prerequisites

- [mise](https://mise.jdx.dev/) - Tool version manager
- Docker - For running PostgreSQL database

## Setup

1. Install mise if you haven't already:
   ```bash
   curl https://mise.run | sh
   ```

2. Install project dependencies:
   ```bash
   mise install
   ```

3. Start the database and Redis:
   ```bash
   mise run dc-up
   ```

4. Run database migrations:
   ```bash
   mise run migrate
   ```

5. Install frontend dependencies:
   ```bash
   mise run fe-install
   ```

## Development

### Database Commands

- **Start all containers (PostgreSQL + Redis):**
  ```bash
  mise run dc-up
  ```

- **Stop all containers:**
  ```bash
  mise run dc-down
  ```

- **Run database migrations:**
  ```bash
  mise run migrate
  ```

- **Create new migration:**
  ```bash
  mise run migrate-new
  ```

- **Reset database (drop and recreate with fresh migrations):**
  ```bash
  mise run db-reset
  ```

- **Fresh database (complete reset including data volume):**
  ```bash
  mise run db-fresh
  ```

### Backend Commands

The backend is built with Litestar and runs on Granian ASGI server.

- **Run backend development server:**
  ```bash
  mise run dev
  ```
  Server runs with auto-reload enabled.

- **Run all tests:**
  ```bash
  mise run test
  ```

- **Run unit tests only:**
  ```bash
  mise run test-unit
  ```

- **Run E2E tests:**
  ```bash
  mise run test-e2e
  ```

- **Run linter:**
  ```bash
  mise run lint
  ```

- **Format code:**
  ```bash
  mise run format
  ```

- **Run RQ worker for loan jobs:**
  ```bash
  mise run rq-worker
  ```

- **Seed database with sample data:**
  ```bash
  mise run seed
  ```

### Test Coverage

Backend test coverage: **93%** (163 tests, 4 skipped)

| Module | Coverage |
|--------|----------|
| Auth | 96-100% |
| Inventory | 100% |
| Items | 97-100% |
| Loans | 100% (services/controllers) |
| Locations | 100% |
| Containers | 27-56% (needs tests) |
| Dashboard | 26-86% (needs tests) |

### Frontend Commands

The frontend is built with Next.js 16, React 19, shadcn/ui, and Tailwind CSS 4.

- **Install frontend dependencies:**
  ```bash
  mise run fe-install
  ```

- **Run frontend development server:**
  ```bash
  mise run fe-dev
  ```

- **Build frontend for production:**
  ```bash
  mise run fe-build
  ```

## Tools Managed by mise

- Python 3.14
- uv - Python package manager
- bun - JavaScript runtime and package manager
- dbmate - Database migration tool

## Environment Variables

The following environment variables are set by mise:

- `DATABASE_URL` - PostgreSQL connection string for async driver (default: `postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev`)
- `DBMATE_DATABASE_URL` - PostgreSQL connection string for dbmate migrations
- `APP_DEBUG` - Enable debug mode

## Project Structure

```
.
├── backend/          # Python backend (Litestar)
│   ├── src/         # Source code
│   ├── db/          # Database migrations
│   └── e2e/         # End-to-end tests
├── frontend/        # Next.js frontend
└── docker-compose.yml  # PostgreSQL service
```


## TODO

[x] Workspaces for multi-user usage
[ ] Export/backup of data
    - Excel (.xlsx) with one sheet per entity, foreign keys resolved to names
    - JSON for migration/re-import
    - Endpoint: `GET /workspaces/{id}/export?format=xlsx|json`
    - Tracks exports in `auth.workspace_exports` for audit
[ ] Integration with Docspell (document management)
    - Link items to Docspell documents (receipts, manuals, warranties)
    - Store Docspell document ID in `warehouse.attachments`
    - Search Docspell from warehouse UI via REST API
    - Auto-link: match item SKU/name with OCR-extracted text
    - Sync tags between warehouse labels and Docspell tags
[ ] Quick access features
    - Favorites: pin frequently accessed items/locations
    - Recently modified: quick view of recent changes
    - Location breadcrumbs: display "Garage → Shelf A → Box 3"
[ ] Bulk operations
    - CSV/Excel import for bulk adding items
    - Barcode lookup: scan product barcode → fetch info from Open Food Facts / UPC database
    - Item templates: "Add another like this"
[ ] SSO authentication
    - Google, Facebook, GitHub OAuth providers
    - Link external accounts to existing users
[ ] Email notifications (Resend)
    - Password reset, loan reminders, alerts
    - 3,000 emails/month free tier
[ ] Obsidian integration
    - Link items to Obsidian notes (detailed descriptions, usage guides, project logs)
    - Store Obsidian vault path + note path in item metadata
    - Deep link to open note directly in Obsidian
[ ] Tracking & alerts
    - Total value: sum of purchase_price per location/workspace
    - Activity log: who changed what, when
    - Consumables list: items needing restocking (quantity = 0)
    - Low stock alerts: notify when quantity < threshold
    - Expiration alerts: items expiring soon
    - Warranty expiring: reminder before warranty ends
    - Overdue loans: loans past due_date
