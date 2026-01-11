# Go Backend Implementation Plan

This document has been split into separate files for easier navigation. Please see the individual phase documents in the `go-implementation/` directory.

---

## 📚 Full Documentation

See **[go-implementation/README.md](./go-implementation/README.md)** for the complete table of contents.

---

## Quick Links

### Foundation
- [Phase 0: Project Setup](./go-implementation/phase-0-project-setup.md) - Go module setup, sqlc configuration, mise tasks, error codes
- [Phase 1: Auth Domain](./go-implementation/phase-1-auth-domain.md) - Users, workspaces, members, notifications

### Core Domains
- [Phase 2: Core Warehouse Domains](./go-implementation/phase-2-core-warehouse.md) - Categories, locations, containers
- [Phase 3: Item & Inventory Domains](./go-implementation/phase-3-item-inventory.md) - Items, inventory, labels
- [Phase 4: Loan Domain](./go-implementation/phase-4-loan.md) - Loans, borrowers, returns

### Extended Functionality
- [Phase 5: Supporting Domains](./go-implementation/phase-5-supporting.md) - Companies, attachments, movements, favorites, activity logs

### Integration & Testing
- [Phase 6: API Layer & Wiring](./go-implementation/phase-6-api-wiring.md) - Huma setup, middleware, DI
- [Phase 7: Implementation Order](./go-implementation/phase-7-implementation-order.md) - Step-by-step implementation guide
- [Phase 8: Testing Strategy](./go-implementation/phase-8-testing.md) - Unit tests, integration tests, test helpers

### Advanced Topics
- [Phase 9: Advanced Patterns](./go-implementation/phase-9-advanced-patterns.md) - Delta sync, search, performance optimizations

---

## Overview

The implementation follows a domain-driven design approach with test-driven development using:

- **Framework**: Huma v2 (OpenAPI) + Chi router
- **Database**: PostgreSQL with sqlc for type-safe queries
- **Migrations**: dbmate (shared with Python backend)
- **Testing**: testify for assertions, table-driven tests
- **Architecture**: Clean DDD with domain/service/repository layers

### Tech Stack
- **Backend**: Go 1.23+
- **API**: Huma v2 + Chi
- **Database Access**: sqlc + pgx/v5
- **Migrations**: dbmate
- **Testing**: testify/assert, testify/mock
- **Dev Tools**: Air (hot reload), golangci-lint

### Project Structure
```
go-backend/
├── cmd/server/          # Application entry point
├── internal/
│   ├── domain/          # Domain logic (auth, warehouse)
│   ├── shared/          # Shared utilities (errors, pagination)
│   ├── infra/           # Infrastructure (postgres, queries)
│   └── api/             # HTTP handlers and routing
├── db/
│   ├── migrations/      # SQL migrations (dbmate)
│   └── queries/         # SQL queries for sqlc
└── tests/               # Integration tests
```

---

## Getting Started

1. **Prerequisites**: Ensure `mise`, `go`, `sqlc`, and `dbmate` are installed
2. **Start with Phase 0**: [Project Setup](./go-implementation/phase-0-project-setup.md)
3. **Follow Implementation Order**: [Phase 7](./go-implementation/phase-7-implementation-order.md)
4. **Use TDD Approach**: Write tests first for each domain service

---

## File Organization Rationale

The original 3,518-line document has been split into 10 separate files (one per phase) to:
- **Improve readability**: Each file focuses on a specific domain or concern
- **Enable faster navigation**: Jump directly to relevant sections
- **Reduce cognitive load**: Work with manageable file sizes
- **Support parallel work**: Multiple developers can reference different phases simultaneously

Each phase document is self-contained with entity definitions, SQL queries, service logic, and test specifications.
