# Home Warehouse System

A multi-tenant home inventory management system for organizing everything you own.

## Tech Stack

- **Backend**: Go (Chi router, Huma, sqlc)
- **Frontend**: Next.js 16, React 19, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL 18
- **Cache/Queue**: Redis

## Features

- **Inventory tracking** - Items, locations, containers with hierarchical organization
- **Loan management** - Track who borrowed what and when it's due
- **Workspaces** - Multi-user collaboration with role-based access (owner, admin, member, viewer)
- **Smart alerts** - Low stock, expiring items, warranty reminders, overdue loans
- **Bulk operations** - CSV/Excel import, barcode lookup (Open Food Facts, UPC databases)
- **Integrations** - Docspell (documents), Obsidian (notes)
- **Export** - Excel and JSON formats for backup and migration
- **Multi-language** - UI and email notifications in EN, ET, RU

## Prerequisites

- [mise](https://mise.jdx.dev/) - Runtime manager
- Docker and Docker Compose

## Quickstart

```bash
# Install tools
mise trust && mise install

# Start everything (PostgreSQL, Redis, backend, frontend)
mise run start
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Go backend on http://localhost:8080
- Next.js frontend on http://localhost:3001

## Project Structure

```
.
├── go-backend/          # Go backend (API server)
│   ├── cmd/server/      # Entry point
│   ├── internal/        # Application code
│   │   ├── api/         # HTTP handlers, middleware, router
│   │   ├── domain/      # Business logic (DDD)
│   │   └── jobs/        # Background jobs
│   ├── db/
│   │   ├── migrations/  # Database migrations
│   │   └── queries/     # sqlc queries
│   └── tests/           # Integration tests
├── frontend2/           # Next.js frontend
├── db/                  # Schema dump
├── docker/              # Docker configs
└── docs/                # Documentation
```

## Development Commands

```bash
# Backend
mise run dev              # Start backend with hot reload
mise run test             # Run tests
mise run test-cover       # Run tests with coverage
mise run lint             # Run linter
mise run fmt              # Format code

# Frontend
mise run fe-dev           # Start frontend dev server
mise run fe-build         # Build frontend
mise run fe-install       # Install dependencies

# Database
mise run migrate          # Run migrations
mise run migrate-new      # Create new migration
mise run migrate-status   # Check migration status
mise run db-fresh         # Reset database completely

# Infrastructure
mise run dc-up            # Start containers
mise run dc-down          # Stop containers
```

## Documentation

- [docs/SETUP.md](docs/SETUP.md) - Detailed setup instructions
- [docs/DATABASE.md](docs/DATABASE.md) - Database schema documentation
- [docs/DOCSPELL.md](docs/DOCSPELL.md) - Docspell integration
- [docs/ROADMAP.md](docs/ROADMAP.md) - Planned features
