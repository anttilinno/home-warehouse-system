# Home Warehouse System

A multi-tenant home inventory management system for organizing everything you own.

## Features

- **Inventory tracking** - Items, locations, containers with hierarchical organization
- **Loan management** - Track who borrowed what and when it's due
- **Workspaces** - Multi-user collaboration with role-based access (owner, admin, member, viewer)
- **Smart alerts** - Low stock, expiring items, warranty reminders, overdue loans
- **Bulk operations** - CSV/Excel import, barcode lookup (Open Food Facts, UPC databases)
- **Integrations** - Docspell (documents), Obsidian (notes)
- **Export** - Excel and JSON formats for backup and migration
- **Multi-language** - UI and email notifications in EN, ET, RU

See [docs/setup.md](docs/setup.md) for prerequisites and setup instructions.

## Quickstart

After setup, run everything with a single command:

```bash
mise run start
```

This starts PostgreSQL, Redis, runs migrations, and launches both backend and frontend dev servers.

See [docs/development.md](docs/development.md) for development commands.

See [docs/database.md](docs/database.md) for database schema documentation.

See [docs/docspell.md](docs/docspell.md) for Docspell integration setup.

See [docs/roadmap.md](docs/roadmap.md) for planned features.
