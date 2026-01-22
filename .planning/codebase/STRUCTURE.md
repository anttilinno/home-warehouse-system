# Codebase Structure

**Analysis Date:** 2026-01-22

## Directory Layout

```
home-warehouse-system/
├── backend/                          # Go REST API and background worker
│   ├── cmd/                          # Executable entry points
│   │   ├── server/main.go            # API server (port 8080)
│   │   ├── worker/main.go            # Background import worker
│   │   ├── seed/                     # Database seeding utility
│   │   └── photo-admin/              # Photo management utility
│   ├── internal/                     # Application code (not exported)
│   │   ├── api/                      # HTTP API layer
│   │   │   ├── router.go             # Main router setup, route registration
│   │   │   ├── middleware/           # Request middleware (auth, approval, logging)
│   │   │   ├── health/               # Health check endpoints
│   │   │   └── docs.go               # Documentation route configuration
│   │   ├── config/                   # Configuration loading
│   │   ├── domain/                   # Business logic (18+ subdomains)
│   │   │   ├── auth/                 # User authentication and authorization
│   │   │   │   ├── user/             # User entity, service, handler
│   │   │   │   ├── workspace/        # Workspace management (multi-tenancy)
│   │   │   │   ├── member/           # Workspace member roles and permissions
│   │   │   │   ├── notification/     # Notification entity and service
│   │   │   │   └── pushsubscription/ # Push notification subscriptions
│   │   │   ├── warehouse/            # Core inventory (multi-tenant via workspace_id)
│   │   │   │   ├── item/             # Item entity, service, handler
│   │   │   │   ├── inventory/        # Inventory instances (items at locations)
│   │   │   │   ├── location/         # Hierarchical storage locations
│   │   │   │   ├── container/        # Storage containers within locations
│   │   │   │   ├── category/         # Item categories (hierarchical)
│   │   │   │   ├── label/            # Item labels and tagging
│   │   │   │   ├── borrower/         # People who borrow items
│   │   │   │   ├── loan/             # Loan tracking and returns
│   │   │   │   ├── itemphoto/        # Item photos with thumbnails
│   │   │   │   ├── attachment/       # Attachments (manuals, receipts, warranties)
│   │   │   │   ├── company/          # Vendor/manufacturer data
│   │   │   │   ├── activity/         # Activity audit trail
│   │   │   │   ├── movement/         # Inventory movement history
│   │   │   │   ├── deleted/          # Soft delete tracking
│   │   │   │   ├── favorite/         # User favorites (items, locations)
│   │   │   │   ├── importjob/        # CSV import job tracking
│   │   │   │   └── pendingchange/    # Approval workflow (member changes)
│   │   ├── auth/                     # Third-party authentication (future)
│   │   ├── analytics/                # Analytics and reporting
│   │   ├── barcode/                  # Barcode lookup (public endpoint)
│   │   ├── batch/                    # Batch operations (PWA offline sync)
│   │   ├── events/                   # Domain events (SSE broadcasting)
│   │   ├── importexport/             # CSV import/export and workspace backup
│   │   ├── sync/                     # PWA offline sync operations
│   │   ├── infra/                    # Infrastructure/external integrations
│   │   │   ├── postgres/             # PostgreSQL repository implementations
│   │   │   │   ├── *_repository.go   # 20+ repository implementations
│   │   │   │   ├── errors.go         # PostgreSQL error conversion
│   │   │   │   └── transaction_manager.go
│   │   │   ├── queries/              # sqlc-generated code from SQL queries
│   │   │   │   └── models.go         # Generated database models
│   │   │   ├── events/               # SSE broadcaster implementation
│   │   │   ├── queue/                # Redis queue for background jobs
│   │   │   ├── storage/              # Local filesystem storage abstraction
│   │   │   ├── imageprocessor/       # Image thumbnail generation
│   │   │   ├── webpush/              # Web push notification service
│   │   │   └── tests/                # Infra-level test utilities
│   │   ├── worker/                   # Background job processing
│   │   │   └── import_worker.go      # CSV import job processor
│   │   ├── shared/                   # Shared utilities
│   │   │   ├── apierror/             # Custom error types and utilities
│   │   │   ├── events/               # Event types for domain events
│   │   │   ├── jwt/                  # JWT token service
│   │   │   └── utils/                # Pagination, CSV parsing utilities
│   │   ├── testutil/                 # Test utilities and fixtures
│   │   └── utils/                    # General utilities
│   ├── db/                           # Database layer
│   │   ├── migrations/               # dbmate migrations (001_initial_schema.sql, etc.)
│   │   ├── queries/                  # SQL query files (*.sql) for sqlc
│   │   │   ├── items.sql             # Item queries
│   │   │   ├── inventory.sql         # Inventory queries
│   │   │   ├── locations.sql         # Location queries
│   │   │   └── ... (20+ files)
│   │   ├── schema.sql                # Generated complete schema
│   │   └── seeds/                    # Optional test data seeds
│   ├── tests/                        # Integration tests
│   │   ├── integration/              # End-to-end API tests
│   │   ├── testdb/                   # Test database utilities
│   │   └── testfixtures/             # Test data fixtures
│   ├── uploads/                      # Item photo storage (runtime)
│   │   └── photos/
│   ├── bin/                          # Compiled binaries
│   ├── Makefile                      # (or use mise.toml for commands)
│   └── go.mod / go.sum               # Go module definitions
│
├── frontend/                         # Next.js 16 React 19 web application
│   ├── app/                          # Next.js app directory
│   │   ├── layout.tsx                # Root layout (HTML wrapper)
│   │   ├── sw.ts                     # Service worker (PWA)
│   │   ├── globals.css               # Global styles
│   │   └── [locale]/                 # i18n directory
│   │       ├── layout.tsx            # Main layout with providers and sidebar
│   │       ├── (auth)/               # Authentication pages
│   │       │   ├── login/page.tsx
│   │       │   ├── register/page.tsx
│   │       │   └── layout.tsx
│   │       ├── (dashboard)/          # Protected workspace pages
│   │       │   ├── page.tsx          # Dashboard landing
│   │       │   ├── layout.tsx        # Dashboard layout with workspace context
│   │       │   ├── items/            # Item management pages
│   │       │   ├── locations/        # Location management pages
│   │       │   ├── containers/       # Container management pages
│   │       │   ├── loans/            # Loan management pages
│   │       │   └── ... (more features)
│   │       └── (marketing)/          # Public marketing pages
│   │           └── page.tsx
│   ├── components/                   # Reusable React components
│   │   ├── ui/                       # shadcn/ui components (Button, Dialog, etc.)
│   │   ├── layout/                   # Layout components (Header, Sidebar, Footer)
│   │   ├── shared/                   # Shared components (dialogs, forms, tables)
│   │   ├── items/                    # Item-specific components
│   │   ├── dashboard/                # Dashboard-specific components
│   │   ├── settings/                 # Settings pages
│   │   ├── providers/                # Context providers (Auth, Theme, etc.)
│   │   ├── marketing/                # Marketing/landing components
│   │   └── pwa/                      # PWA-specific components
│   ├── features/                     # Feature-specific code (auth flows, etc.)
│   │   └── auth/                     # Authentication feature
│   │       └── components/           # Auth-specific components
│   ├── lib/                          # Utility libraries and functions
│   │   ├── api/                      # API client functions
│   │   │   ├── client.ts             # Base HTTP client wrapper
│   │   │   ├── auth.ts               # Auth API calls
│   │   │   ├── items.ts              # Items API calls
│   │   │   ├── inventory.ts          # Inventory API calls
│   │   │   ├── borrowers.ts          # Borrowers API calls
│   │   │   └── ... (10+ modules)
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useWorkspace.ts       # Current workspace context hook
│   │   │   ├── useAuth.ts            # Current user auth hook
│   │   │   └── ... (15+ hooks)
│   │   ├── contexts/                 # React context definitions
│   │   │   ├── AuthContext.tsx       # User auth context
│   │   │   ├── WorkspaceContext.tsx  # Current workspace context
│   │   │   └── ... (3+ contexts)
│   │   ├── types/                    # TypeScript type definitions
│   │   │   └── api.ts                # Generated/manual API types
│   │   ├── utils/                    # Utility functions
│   │   │   ├── format.ts             # Formatting utilities
│   │   │   ├── validation.ts         # Form validation
│   │   │   └── ... (utility modules)
│   │   └── config/                   # Frontend config
│   │       └── api.ts                # API base URL configuration
│   ├── public/                       # Static assets
│   │   ├── images/                   # Image assets
│   │   └── screenshots/              # PWA screenshots
│   ├── styles/                       # Global styles
│   ├── e2e/                          # Playwright end-to-end tests
│   ├── playwright/                   # Playwright config and auth
│   ├── types/                        # Global TypeScript types
│   ├── i18n/                         # Internationalization config (multiple languages)
│   ├── messages/                     # i18n translation files
│   ├── config/                       # Configuration files
│   ├── package.json                  # Node dependencies (bun install)
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── next.config.ts                # Next.js configuration (PWA, middleware)
│   ├── tailwind.config.ts            # Tailwind CSS configuration
│   ├── tailwind.css                  # Tailwind overrides
│   └── playwright.config.ts          # E2E test configuration
│
├── db/                               # Shared database configuration
│   └── (may contain database-wide config)
│
├── docker/                           # Docker configuration
│   └── postgres/                     # PostgreSQL Dockerfile and init scripts
│
├── docs/                             # Project documentation
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── APPROVAL_PIPELINE.md
│   └── ... (more docs)
│
├── .mise.toml                        # Tool version management and command definitions
├── .github/                          # GitHub Actions workflows
├── docker-compose.yml                # Local development services (PostgreSQL, Redis)
├── .gitignore                        # Git ignore rules
└── README.md                         # Project overview
```

## Directory Purposes

**backend/cmd/:**
- **server/main.go**: API server entry point. Loads config, connects to DB, creates router, listens on port 8080
- **worker/main.go**: Background worker entry point. Connects to DB and Redis, polls queue for import jobs, processes CSV
- **seed/**: Database seeding tool for populating test data
- **photo-admin/**: Administrative tool for managing photos (cleanup, optimization)

**backend/internal/api/:**
- **router.go**: Central route registration. Initializes all repositories, services, and registers them with Huma API. 400+ lines showing layer dependencies
- **middleware/**: Request processing middleware (auth validation, workspace context extraction, approval interception, error handling)
- **health/**: Health check endpoint for monitoring and load balancer integration

**backend/internal/domain/{*}/:**
Each domain subdirectory follows identical structure:
- **entity.go**: Entity definition with private fields, getters, constructor (NewXxx), and Reconstruct
- **service.go**: ServiceInterface (public contract) and Service struct with business logic
- **repository.go**: Repository interface defining persistence contract
- **handler.go**: RegisterRoutes function registering HTTP handlers via Huma
- **errors.go**: Domain-specific error types
- **service_test.go / handler_test.go**: Unit and handler tests
Example: `backend/internal/domain/warehouse/item/`

**backend/internal/infra/postgres/:**
- **{entity}_repository.go**: 20+ repository implementations using sqlc-generated queries
- **errors.go**: PostgreSQL error conversion (e.g., unique constraint → domain error)
- **transaction_manager.go**: ACID transaction management for multi-step operations
- **{entity}_repository_test.go**: Integration tests against test database

**backend/internal/infra/queries/:**
- **models.go**: sqlc-generated database models (auto-generated from SQL)
- **queries.go**: sqlc-generated query methods (auto-generated from SQL)
- Regenerate with: `mise run sqlc` (runs sqlc on `backend/db/queries/*.sql`)

**backend/db/migrations/:**
- **001_initial_schema.sql**: Auth and warehouse schemas, 30+ tables, enums, indexes
- **002_push_subscriptions.sql**: PWA push subscription support
- Run with: `mise run migrate` (uses dbmate)

**backend/db/queries/:**
- **items.sql / inventory.sql / etc**: SQL query definitions for sqlc code generation
- Each file contains multiple named queries (GetItem, ListItems, UpdateItem, etc.)
- Generated Go methods available in `backend/internal/infra/queries/`

**frontend/app/[locale]/(dashboard)/:**
Protected workspace pages. Layout wraps with workspace context provider. Routes:
- `items/` - Item CRUD, search, labeling, archiving
- `locations/` - Location hierarchy, QR labels
- `containers/` - Container management within locations
- `loans/` - Loan tracking and returns
- `borrowers/` - Borrower management
- And 5+ more feature routes

**frontend/lib/api/:**
API client modules. One module per domain:
- `items.ts`: getAllItems, createItem, updateItem, deleteItem, searchItems
- `inventory.ts`: getInventoryItems, createInventory, moveItem, etc.
- `locations.ts`, `containers.ts`, `categories.ts`, etc.
- Each exports functions that call backend APIs via `client.ts`

**frontend/lib/hooks/:**
Custom React hooks for state management:
- `useWorkspace()`: Current workspace context
- `useAuth()`: Current user, login/logout
- `useLocalStorage()`: Persistent client-side storage
- Domain-specific: `useItems()`, `useInventory()`, etc. (fetch + cache)

**frontend/lib/contexts/:**
React Context definitions:
- `AuthContext`: User authentication state, isLoading, error
- `WorkspaceContext`: Current workspace ID, members, permissions
- Providers wrap app layout to provide context to all components

## Key File Locations

**Entry Points:**
- Backend API: `backend/cmd/server/main.go` (port 8080)
- Backend Worker: `backend/cmd/worker/main.go` (processes Redis jobs)
- Frontend: `frontend/app/layout.tsx` → `frontend/app/[locale]/layout.tsx`

**Configuration:**
- Backend: `backend/internal/config/config.go` (loads env vars)
- Frontend: `frontend/lib/config/api.ts` (NEXT_PUBLIC_API_URL)
- Environment: `frontend/.env.local`, backend uses env vars directly

**Core Logic:**
- Repositories: `backend/internal/infra/postgres/*_repository.go` (20+ files)
- Services: `backend/internal/domain/warehouse/**/service.go` (18+ domains)
- Handlers: `backend/internal/domain/warehouse/**/handler.go` (route registration)

**Testing:**
- Backend unit tests: `backend/internal/**/*_test.go` (alongside code)
- Backend integration tests: `backend/tests/integration/`
- Frontend E2E tests: `frontend/e2e/` (Playwright)

## Naming Conventions

**Files:**
- Entity definitions: `entity.go` (one per domain package)
- Service implementations: `service.go` (one per domain)
- Repository interface: `repository.go` (interface definition)
- Repository implementations: `{entity}_repository.go` in infra/postgres
- HTTP handlers: `handler.go` (route handlers and registration)
- Errors: `errors.go` (domain-specific error types)
- Tests: `{entity}_test.go` or `{file}_test.go`
- Utilities: Snake case `csv_parser.go`, `image_processor.go`

**Functions:**
- Constructors: `NewXxx()` (e.g., `NewItem()`, `NewService()`)
- Reconstructors: `Reconstruct()` (hydrate from DB row)
- Getters: `Xxx()` (e.g., `ID()`, `Name()`, `WorkspaceID()`)
- Repository methods: `Save()`, `FindByID()`, `FindByX()`, `Delete()`
- Service methods: `Create()`, `GetByID()`, `List()`, `Update()`, `Delete()`
- Handler registration: `RegisterRoutes(api huma.API, svc ServiceInterface, ...)`
- Middleware: `JWTAuth()`, `Workspace()`, `ApprovalMiddleware()`

**Types:**
- Entities: `Item`, `Inventory`, `Location` (PascalCase, singular)
- Services: `Service` or `ItemService` (interface: `ServiceInterface`)
- Repositories: `Repository` interface, `ItemRepository` implementation
- Input DTO: `CreateInput`, `UpdateInput`, `ListXxxsInput` (Input suffix)
- Response DTO: `XxxResponse`, `XxxListResponse` (Response suffix)
- Requests: `CreateItemRequest`, `UpdateItemRequest` (Request suffix, in handler)
- Errors: `ErrItemNotFound`, `ErrSKUTaken`, `ErrInvalidMinStock` (Err prefix)

**Directories:**
- Domains: singular nouns `item`, `inventory`, `location`, `loan` (lowercase)
- Infrastructure: `postgres`, `queue`, `storage`, `imageprocessor` (camelCase/snake_case)
- Features: plural `items`, `locations` (in Next.js routes)

## Where to Add New Code

**New Feature (Domain Entity):**
1. Create domain directory: `backend/internal/domain/warehouse/{entity}/`
2. Create files: `entity.go`, `service.go`, `repository.go`, `handler.go`, `errors.go`
3. Create repository implementation: `backend/internal/infra/postgres/{entity}_repository.go`
4. Add SQL queries: `backend/db/queries/{entity}.sql`
5. Run `mise run sqlc` to generate code
6. Register service and handler in `backend/internal/api/router.go` (lines 150-215)
7. Tests: `{entity}_test.go` alongside implementation

**New Component/Module (Frontend):**
1. UI component: `frontend/components/{feature}/{ComponentName}.tsx`
2. Feature page: `frontend/app/[locale]/(dashboard)/{feature}/page.tsx`
3. API calls: `frontend/lib/api/{entity}.ts`
4. Types: Add to `frontend/lib/types/api.ts`
5. Hook (if needed): `frontend/lib/hooks/use{Feature}.ts`

**Utilities:**
- Shared Go utilities: `backend/internal/shared/` (errors, JWT, pagination)
- Shared frontend utilities: `frontend/lib/utils/` (formatting, validation)

**Tests:**
- Backend unit tests: Create `{file}_test.go` in same directory as code
- Backend integration tests: `backend/tests/integration/{feature}_test.go`
- Frontend E2E tests: `frontend/e2e/{feature}.spec.ts`

## Special Directories

**backend/uploads/photos/:**
- Purpose: Photo storage for item images (runtime generated)
- Generated: Yes (created during photo uploads)
- Committed: No (.gitignore excludes)

**backend/internal/infra/queries/:**
- Purpose: Auto-generated sqlc code from SQL queries
- Generated: Yes (`mise run sqlc`)
- Committed: Yes (committed to support development without sqlc setup)

**frontend/.next/:**
- Purpose: Next.js build artifacts
- Generated: Yes (durante `npm run build`)
- Committed: No

**frontend/playwright/.auth/:**
- Purpose: Playwright authentication cache
- Generated: Yes (first test run)
- Committed: No

**backend/db/schema.sql:**
- Purpose: Complete database schema (informational)
- Generated: No (manually maintained alongside migrations)
- Committed: Yes (for reference and documentation)

---

*Structure analysis: 2026-01-22*
