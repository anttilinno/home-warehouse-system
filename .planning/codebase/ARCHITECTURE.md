# Architecture

**Analysis Date:** 2026-01-22

## Pattern Overview

**Overall:** Clean Architecture with Domain-Driven Design (DDD) principles and Layered Architecture

**Key Characteristics:**
- **Domain-centric organization**: Each business domain (item, inventory, location, etc.) has its own package with entity, service, repository, and handler
- **Separation of concerns**: Clear boundaries between API layer, domain/business logic, and infrastructure
- **Multi-tenant by design**: All warehouse entities include `workspace_id` for tenant isolation
- **Role-based access control**: Approval workflow middleware intercepts member operations for admin review
- **Event-driven architecture**: Event broadcaster for SSE notifications and real-time updates
- **Background job processing**: Redis queue with dedicated worker process for async imports

## Layers

**API Layer:**
- Purpose: HTTP request handling, routing, and response marshaling
- Location: `backend/internal/api/`
- Contains: Router setup, middleware, health checks, documentation endpoints
- Depends on: Huma framework (OpenAPI-first REST API), Chi router, domain services
- Used by: Frontend clients, external API consumers

**Domain Layer:**
- Purpose: Business logic, entity validation, and core operations
- Location: `backend/internal/domain/` (18+ subdomains)
- Contains: Entities, services, repository interfaces, domain-specific errors, request/response types
- Depends on: Repository interfaces (not implementations), shared utilities
- Used by: API handlers, workers, background jobs

**Infrastructure Layer:**
- Purpose: Concrete implementations of repository interfaces, external service integration
- Location: `backend/internal/infra/`
- Contains: PostgreSQL repositories, Redis queue, image processing, storage, event broadcasting
- Depends on: Database drivers (pgx), storage systems, Redis client
- Used by: Services for data persistence and external operations

**Shared Layer:**
- Purpose: Cross-cutting utilities and error handling
- Location: `backend/internal/shared/`
- Contains: Error types, JWT service, field validation, pagination utilities
- Depends on: No business logic
- Used by: All layers

**Worker Layer:**
- Purpose: Asynchronous job processing
- Location: `backend/internal/worker/`
- Contains: Import worker, job queue interaction, CSV parsing coordination
- Depends on: Services, repositories, queue infrastructure
- Used by: background worker process, triggered by API

## Data Flow

**Request Flow (Synchronous):**

1. Client sends HTTP request (Bearer token or cookie)
2. Router receives request at Chi handler
3. Global middleware applies (RequestID, RealIP, CORS, rate limiting)
4. JWTAuth middleware validates token, extracts user context
5. Workspace middleware validates workspace access and role
6. ApprovalMiddleware intercepts member operations (POST/PUT/DELETE)
   - If member role: stores change in pending_changes table, returns 202 Accepted
   - If admin/owner: proceeds to handler
7. Handler calls service method with validated input
8. Service validates business rules, calls repository
9. Repository executes SQL query via sqlc-generated code
10. Response marshaled to JSON, returned to client

**Async Job Flow (CSV Import):**

1. Client uploads CSV via `/workspaces/{ws_id}/imports` endpoint
2. Handler creates ImportJob record (status: pending)
3. Handler enqueues job to Redis queue
4. Handler returns job ID (202 Accepted)
5. Worker process dequeues job continuously
6. Worker parses CSV, creates domain entities, validates
7. Worker calls service methods for each row
8. Service validation failures stored in import_errors table
9. Worker updates ImportJob status (completed/failed)
10. Broadcaster sends SSE event to client in real-time

**Real-Time Notification Flow (SSE):**

1. Client connects to `/workspaces/{ws_id}/events?token=...` SSE endpoint
2. Request bypasses normal middleware via Chi route (not Huma)
3. Client connection registered with Broadcaster
4. Domain operations publish events to broadcaster
5. Broadcaster filters events by workspace and sends to connected clients
6. Client receives events (item created, approval decision, etc.)
7. Client updates UI reactively

**State Management:**

- **Tenant Isolation**: PostgreSQL schema separation (auth, warehouse). All warehouse entities filtered by workspace_id at query level
- **Workspace Context**: Middleware extracts from JWT and stores in context, available to handlers
- **User Role Context**: Loaded from database via MemberAdapter, determines if approval required
- **Transactional Safety**: TxManager for operations requiring ACID guarantees (e.g., inventory movements)

## Key Abstractions

**Domain Entity (Example: Item):**
- Purpose: Represents immutable business object with private fields and accessor methods
- Examples: `backend/internal/domain/warehouse/item/entity.go`, `backend/internal/domain/warehouse/inventory/entity.go`
- Pattern: Private fields with getters, NewXxx constructor for creation, Reconstruct for database hydration
- Validation: Constructor validates required fields, returns error on validation failure

**Service Interface (Example: ItemService):**
- Purpose: Defines operations available on domain entity, coordinates with repositories and other services
- Examples: `backend/internal/domain/warehouse/item/service.go`, `backend/internal/domain/warehouse/inventory/service.go`
- Pattern: Service embeds single repository, public methods match repository methods, adds business logic
- Responsibilities: Validation, duplicate checks, short code generation, label attachment, archive/restore

**Repository Interface (Example: ItemRepository):**
- Purpose: Abstraction over data persistence, defines contract for storing/retrieving entities
- Examples: `backend/internal/domain/warehouse/item/repository.go`
- Pattern: Interface defines methods, sqlc-generated code in postgres package implements
- Methods: Save, FindByID, FindByX, Delete, existence checks, bulk operations

**Handler Function (Example: RegisterRoutes):**
- Purpose: Converts HTTP requests to domain operations, marshals responses
- Examples: `backend/internal/domain/warehouse/item/handler.go` (lines 16-42)
- Pattern: RegisterRoutes function registers multiple Huma route handlers, each handler function takes typed input, calls service, returns typed output
- Response Codes: 200 (success), 202 (accepted for member operations), 400 (validation), 401 (auth), 404 (not found), 500 (server error)

**Middleware Chain (Request Processing):**
- Purpose: Cross-cutting concerns applied before reaching handlers
- Examples: `backend/internal/api/middleware/auth.go`, `backend/internal/api/middleware/approval_middleware.go`
- Pattern: Middleware wraps http.Handler, extracts context, validates preconditions, calls next()
- Key Middlewares:
  - RequestID: Generates unique request ID for tracing
  - JWTAuth: Validates token, sets UserContextKey
  - Workspace: Validates workspace access, sets WorkspaceContextKey and RoleContextKey
  - ApprovalMiddleware: Intercepts member POST/PUT/DELETE, routes to pending_changes

## Entry Points

**API Server:**
- Location: `backend/cmd/server/main.go`
- Triggers: `mise run dev` or `./bin/server`
- Responsibilities:
  - Load config and database URL
  - Connect to PostgreSQL pool
  - Initialize all repositories and services
  - Create router with middleware and register all routes
  - Listen on port 8080 (configurable via PORT env var)
  - Graceful shutdown on SIGINT/SIGTERM

**Background Worker:**
- Location: `backend/cmd/worker/main.go`
- Triggers: `mise run worker` or `./bin/worker`
- Responsibilities:
  - Connect to PostgreSQL and Redis
  - Continuously poll Redis queue for import jobs
  - Process CSV rows, create domain entities, validate
  - Store errors in import_errors table
  - Update job status and broadcast completion events
  - Health check server on port 8081

**Frontend App:**
- Location: `frontend/app/layout.tsx` (root) → `frontend/app/[locale]/layout.tsx` (content)
- Triggers: `mise run fe-dev` or `npm run dev`
- Responsibilities:
  - Serve Next.js app with i18n support
  - Initialize providers (auth context, workspace context, theme provider)
  - Render layout with sidebar, header, main content
  - Handle PWA installation and offline support

## Error Handling

**Strategy:** Type-safe error returns with domain-specific error types, converted to HTTP status codes

**Patterns:**
- **Domain Errors**: Defined in each domain package (e.g., `backend/internal/domain/warehouse/item/errors.go`)
  - `ErrItemNotFound`, `ErrSKUTaken`, `ErrInvalidMinStock`, etc.
  - Custom error types satisfy `error` interface, can be checked with `errors.Is()`
- **Field Errors**: `backend/internal/shared/apierror/field_error.go`
  - Wraps validation failures with field name and message
  - Example: `"SKU already exists in this workspace"`
- **Middleware Error Handling**: `backend/internal/api/middleware/errors.go`
  - Catches panics, logs with context, returns 500 JSON response
  - Converts domain errors to HTTP status codes in handlers
- **HTTP Error Mapping**:
  - Domain error returned → Handler checks error type → Returns `huma.Error404()`, `huma.Error400()`, etc.
  - Approval failure → Handler returns `huma.Error202Accepted()` with change ID

## Cross-Cutting Concerns

**Logging:**
- Framework: `slog` (Go 1.21+) with structured logging
- Implementation: `backend/internal/api/middleware/logger.go`
- Pattern: RequestID, user email, workspace ID included in every log entry
- Usage: `log.Printf()` in main, structured logger in middleware

**Validation:**
- Entity-level: Constructor methods in domain entities validate required fields
- Field-level: Service methods check constraints (SKU uniqueness, stock levels, etc.)
- Domain rules: Repository queries used to check business logic (e.g., `SKUExists()`)
- HTTP-level: Handler input types can be decorated with validation tags (future enhancement)

**Authentication:**
- JWT tokens issued by `/login` endpoint, valid for `JWTExpirationHours` (config)
- Three token sources supported: Authorization header (Bearer), Cookie (access_token), Query param (token) for SSE
- Claims: UserID, Email, FullName, IsSuperuser
- Verified in middleware before reaching handlers, user context available in handlers

**Authorization:**
- Workspace access: Validated via workspace_members table by MemberAdapter
- Role-based: owner/admin/member/viewer enum determines if changes bypass approval
- Approval pipeline: Member operations stored in pending_changes, admin approves/rejects
- Multi-tenant: workspace_id in context isolates data at repository query level

**Data Validation:**
- Business logic: Validation in service Create/Update methods
- Uniqueness: SKU, short code checked via repository
- Inventory constraints: Stock levels, condition, status validated before state changes
- Photo uploads: File size, MIME type validated, images processed (thumbnail generation)
