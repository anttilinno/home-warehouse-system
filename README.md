# Home Warehouse System

A multi-tenant home inventory management system for tracking items, locations, containers, and loans. Built with Go, Next.js, and PostgreSQL.

## Features

- **Multi-tenant Workspaces** - Isolated environments for different users/teams with role-based access control
- **Approval Pipeline** - Member changes require admin approval for data integrity
- **Item Management** - Track items with SKU, brand, model, serial numbers
- **Item Photos** - Multiple photos per item with thumbnails, captions, and automatic compression
- **Location Hierarchy** - Organize storage by rooms, zones, shelves, bins
- **Container Management** - Group items in boxes and containers
- **Loan Tracking** - Monitor who borrowed what and when
- **Background Import System** - Bulk import data via CSV files
- **Real-time Updates** - SSE-based live updates for import progress and approvals
- **PWA Support** - Progressive Web App with offline capability and cached photos

## Quick Start

See [CLAUDE.md](.claude/CLAUDE.md) for detailed setup instructions.

```bash
# Start infrastructure (PostgreSQL + Redis)
mise run dc-up

# Run migrations
mise run migrate

# Start backend API server
mise run dev

# Start background worker (in another terminal)
mise run worker

# Start frontend (in another terminal)
mise run fe-dev
```

## Background Import System

The system supports asynchronous bulk imports via CSV files:

- Upload CSV files via the web interface
- Monitor import progress in real-time with SSE
- View detailed error reports for failed rows
- Retry failed imports

### Supported Entity Types

- Items (products/catalog)
- Inventory (physical instances)
- Locations (storage hierarchy)
- Containers (boxes, bins)
- Categories (hierarchical)
- Borrowers (loan recipients)

### Running the Worker

The import worker processes background jobs from the Redis queue. You need to run the worker alongside the API server to enable CSV imports.

```bash
# Start the worker (requires Redis to be running)
mise run worker

# Or build and run the binary
mise run build-worker
./backend/bin/worker
```

**Important**: The worker must be running for CSV imports to be processed. Without it, import jobs will queue but not execute.

For detailed CSV format requirements and usage instructions, see the [Import User Guide](docs/IMPORT_USER_GUIDE.md).

## Project Structure

```
.
├── backend/             # Go backend (API server)
│   ├── cmd/
│   │   ├── server/      # API server entry point
│   │   └── worker/      # Import worker entry point
│   ├── internal/        # Application code
│   │   ├── api/         # HTTP handlers, middleware, router
│   │   ├── domain/      # Business logic (DDD)
│   │   ├── infra/       # Infrastructure (DB, queue, events)
│   │   └── worker/      # Background job processors
│   ├── db/
│   │   ├── migrations/  # Database migrations
│   │   └── queries/     # sqlc queries
│   └── tests/           # Integration tests
├── frontend/            # Next.js frontend (PWA)
├── docs/                # Documentation
└── docker-compose.yml   # PostgreSQL + Redis services
```

## Documentation

- [CLAUDE.md](.claude/CLAUDE.md) - Developer setup and common commands
- [Roadmap](docs/ROADMAP.md) - Feature roadmap and planned improvements
- [Database Schema](docs/DATABASE.md) - Complete database documentation
- [Approval Pipeline](docs/APPROVAL_PIPELINE.md) - Role-based change approval system
- [Import User Guide](docs/IMPORT_USER_GUIDE.md) - CSV bulk import instructions
- [Item Photos](docs/ITEM_PHOTOS.md) - Photo management feature documentation

## Tech Stack

- **Backend**: Go 1.25, Chi router, sqlc, PostgreSQL
- **Frontend**: Next.js 16, React 19, shadcn/ui, Tailwind CSS 4
- **Infrastructure**: Redis (job queue), Server-Sent Events (real-time updates)
- **Database**: PostgreSQL with dbmate migrations
- **Tools**: mise (task runner), bun (JS package manager)

## License

[Your License Here]