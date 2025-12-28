# Home Warehouse System

A home warehouse management system for tracking inventory, locations, containers, and loans.

## Prerequisites

- [mise](https://mise.jdx.dev/) - Tool version manager
- Docker - For running PostgreSQL and Redis

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

#### Unit Tests

| Domain | Test Files | Status |
|--------|------------|--------|
| auth | 5 | Complete |
| inventory | 3 | Complete |
| items (+ categories) | 3 | Complete |
| loans (+ borrowers) | 3 | Complete |
| locations | 2 | Complete |
| notifications | 3 | Complete |
| favorites | 1 | Complete |
| analytics | 2 | Complete |
| containers | 2 | Complete |
| dashboard | 2 | Complete |
| email | 2 | Complete |
| exports | 2 | Complete |
| imports | 4 | Complete |

#### E2E Tests

| Feature | Test File | Status |
|---------|-----------|--------|
| auth | test_auth_flow.py | Complete |
| analytics | test_analytics_flow.py | Complete |
| borrowers | test_borrowers_flow.py | Complete |
| categories | test_categories_flow.py | Complete |
| containers | test_containers_flow.py | Complete |
| dashboard | test_dashboard_flow.py | Complete |
| favorites | test_favorites_flow.py | Complete |
| inventory | test_inventory_flow.py | Complete |
| items | test_items_flow.py | Complete |
| loans | test_loan_flow.py | Complete |
| locations | test_locations_flow.py | Complete |
| notifications | test_notifications_flow.py | Complete |
| exports | test_exports_flow.py | Complete |
| imports | test_imports_flow.py | Complete |
| password reset | test_password_reset_flow.py | Complete |

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
- [Claude Code](https://claude.ai/code) - AI coding assistant (see `.claude/CLAUDE.md` for project context)

## Environment Variables

The following environment variables are set by mise (for local development):

- `DATABASE_URL` - PostgreSQL connection string (default: `postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev`)
- `DBMATE_DATABASE_URL` - PostgreSQL connection string for dbmate migrations
- `APP_DEBUG` - Enable debug mode

Additional environment variables (see `backend/.env.example`):

- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379/0`)
- `SECRET_KEY` - JWT signing key (**must change in production**)
- `JWT_ALGORITHM` - JWT algorithm (default: `HS256`)
- `JWT_EXPIRATION_HOURS` - Token expiration time (default: `24`)

> **Note:** All credentials in this repository are examples for local development only. Do not use in production.

## Project Structure

```
.
├── backend/          # Python backend (Litestar)
│   ├── src/         # Source code
│   ├── db/          # Database migrations
│   └── e2e/         # End-to-end tests
├── frontend/        # Next.js frontend
└── docker-compose.yml  # PostgreSQL + Redis
```


## TODO

- [x] Workspaces for multi-user usage
- [x] Export/backup of data
  - Excel (.xlsx) with one sheet per entity, foreign keys resolved to names
  - JSON for migration/re-import
  - Endpoint: `GET /exports/workspace?format=xlsx|json`
  - Tracks exports in `auth.workspace_exports` for audit
- [ ] Integration with Docspell (document management)
  - Link items to Docspell documents (receipts, manuals, warranties)
  - Store Docspell document ID in `warehouse.attachments`
  - Search Docspell from warehouse UI via REST API
  - Auto-link: match item SKU/name with OCR-extracted text
  - Sync tags between warehouse labels and Docspell tags
- [x] Quick access features
  - Favorites: pin frequently accessed items/locations
  - Recently modified: quick view of recent changes
  - Location breadcrumbs: display "Garage → Shelf A → Box 3"
- [x] Bulk operations
  - CSV/Excel import for bulk adding items
  - Barcode lookup: scan product barcode → fetch info from Open Food Facts / UPC database
  - Item duplicate: "Add another like this"
- [ ] SSO authentication
  - Google, Facebook, GitHub OAuth providers
  - Link external accounts to existing users
- [x] Email notifications (Resend)
  - Password reset (multi-language: EN, ET, RU)
  - Loan reminders
  - Multi-language email templates
- [x] Obsidian integration
  - Link items to Obsidian notes (detailed descriptions, usage guides, project logs)
  - Store Obsidian vault path + note path in item metadata
  - Deep link to open note directly in Obsidian
- [x] User language preference
  - Language stored in database (profile page)
  - Emails sent in user's preferred language
  - Auto-redirect to user's language on login
- [ ] Companion app for bar codes, QR codes. Adding and identifying container, items

### Phase 2

- [x] Tracking & alerts (partial)
  - [x] Total value: sum of purchase_price per location/workspace
  - [ ] Activity log: who changed what, when. So there is no need for soft delete
  - [ ] Consumables list: items needing restocking (quantity = 0)
  - [x] Low stock alerts: notify when quantity < threshold
  - [x] Expiration alerts: items expiring soon (expiration_date field)
  - [x] Warranty expiring: reminder before warranty ends (warranty_expires field)
  - [x] Overdue loans: loans past due_date
- [ ] Approval pipeline for member role
  - Members' create/update/delete operations require owner/admin approval
  - Pending changes table: entity type, action, JSON payload, requester, status
  - Review queue UI for owner/admin to approve/reject
  - Notifications when changes need review
  - Members see "Pending approval" status instead of immediate success
