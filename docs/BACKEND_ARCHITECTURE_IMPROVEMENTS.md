# Backend Architecture Improvement Suggestions

This document captures improvement opportunities identified during an architectural review of the Go backend. The current architecture is solid (Grade: A-) with proper DDD, Clean Architecture patterns, and 99% test coverage. These suggestions are enhancements, not critical fixes.

## Current Architecture Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Layer Separation | Excellent | Clear API → Service → Repository layers |
| Domain Design | Excellent | Proper bounded contexts, entity encapsulation |
| Multi-tenancy | Excellent | Row-level isolation via workspace_id |
| Testing | Excellent | 99% coverage, unit + integration |
| Error Handling | Very Good | Two-layer system (domain + API) |
| API Documentation | Very Good | Auto-generated OpenAPI via Huma |

## Improvement Areas

### 1. Dependency Injection Container

**Current State:** Manual wiring in `internal/api/router.go:84-148`

```go
// Current: 25+ repositories and 20+ services wired manually
userRepo := postgres.NewUserRepository(pool)
userSvc := user.NewService(userRepo)
userHandler := user.NewHandler(userSvc, jwtService, workspaceSvc)
// ... repeated for every domain
```

**Problem:** As domains grow, manual wiring becomes error-prone and hard to maintain.

**Recommendation:** Consider Google Wire or Uber fx for compile-time dependency injection.

**Wire Example:**
```go
// wire.go
//go:build wireinject

func InitializeRouter(pool *pgxpool.Pool, cfg *config.Config) chi.Router {
    wire.Build(
        postgres.NewUserRepository,
        user.NewService,
        user.NewHandler,
        // ... provider sets
        NewRouter,
    )
    return nil
}
```

**Benefits:**
- Compile-time verification of dependencies
- Clear dependency graph
- Easier testing with alternative implementations

**Priority:** Low - Current approach works fine at this scale. Consider when adding 10+ more domains.

---

### 2. Explicit Transaction Boundaries ✅

**Status:** IMPLEMENTED (2026-01-14)

**Implementation Details:**
- Transaction manager with `WithTx` API for atomic operations
- Automatic commit on success, rollback on error or panic
- Nested transaction support (reuses parent transaction)
- Context-based transaction passing
- Helper functions: `GetTx(ctx)` and `GetDBTX(ctx, pool)`
- Full compatibility with sqlc-generated queries
- Zero external dependencies (uses pgx directly)

**Example Usage:**
```go
err := txManager.WithTx(ctx, func(txCtx context.Context) error {
    // Update inventory
    inv, err := inventoryRepo.FindByID(txCtx, id, workspaceID)
    if err != nil {
        return err
    }

    err = inv.Move(toLocationID, toContainerID)
    if err != nil {
        return err
    }

    err = inventoryRepo.Save(txCtx, inv)
    if err != nil {
        return err // Automatic rollback
    }

    // Create movement record
    movement := movement.NewInventoryMovement(...)
    return movementRepo.Save(txCtx, movement) // Atomic with inventory update
})
```

**Repository Integration:**
```go
func (r *Repository) Save(ctx context.Context, entity *Entity) error {
    // GetDBTX returns transaction if present, otherwise returns pool
    db := postgres.GetDBTX(ctx, r.pool)
    queries := queries.New(db)
    // ... operations use transaction automatically
}
```

**Testing:**
- Unit tests: `tx_unit_test.go` (7 tests, no database required)
- Integration tests: `tx_test.go` (15 tests with real transactions)
- Tests cover: commit, rollback, panic recovery, nested transactions, context cancellation

**Files:**
- `backend/internal/infra/postgres/tx.go:1-110` (implementation)
- `backend/internal/infra/postgres/TRANSACTIONS.md` (comprehensive guide)

**Benefits Delivered:**
✅ Atomic multi-aggregate operations
✅ Data integrity guarantees
✅ Simple, clean API
✅ Panic-safe (automatic rollback)
✅ Nested transaction support
✅ Context-aware

**Priority:** ~~Medium~~ **COMPLETED** - Data integrity improvement.

---

### 3. Service Interface Consistency ✅

**Status:** IMPLEMENTED (2026-01-14)

**Implementation Details:**
- All 23 domain services have consistent `ServiceInterface` definitions
- JWT service in shared package now has `ServiceInterface`
- All interfaces follow consistent naming pattern: `ServiceInterface`
- Handlers use interfaces instead of concrete types
- Deprecated functions updated to use interfaces

**Services with Interfaces (23 total):**
- Auth domain: user, workspace, member, notification
- Warehouse domain: item, inventory, category, location, container, borrower, loan, company, label, attachment, activity, movement, favorite, deleted
- Cross-cutting: analytics, barcode, batch, importexport, sync
- Shared: jwt.ServiceInterface

**Changes Made:**
- Updated deprecated functions in `user/handler.go` to use `ServiceInterface`
- Added `jwt.ServiceInterface` for JWT service
- Updated `user.Handler` to use `jwt.ServiceInterface` instead of concrete type

**Files Modified:**
- `backend/internal/domain/auth/user/handler.go:18-25` (Handler struct and constructor)
- `backend/internal/domain/auth/user/handler.go:578,621` (deprecated functions)
- `backend/internal/shared/jwt/jwt.go:24-30` (new interface definition)

**Testing:**
- All tests pass with interface usage
- Build succeeds for all packages
- No breaking changes to existing code

**Benefits Delivered:**
✅ Consistent mocking in tests across all domains
✅ Clear API contracts for all services
✅ Better IDE support and autocomplete
✅ Easier to swap implementations for testing
✅ Foundation for dependency injection improvements

**Priority:** ~~Low~~ **COMPLETED** - Consistency improvement.

---

### 4. Domain Events for Side Effects ✅

**Status:** IMPLEMENTED (2026-01-14)

**Implementation Details:**
- In-memory event bus with publish/subscribe pattern
- 8 predefined domain events for common operations
- Activity logger event handler for automatic activity logging
- Synchronous event processing with error isolation
- Optional event bus support for backward compatibility

**Core Components:**
- `Event` interface with `EventName()`, `OccurredAt()`, `WorkspaceID()`
- `EventBus` interface with `Publish()`, `Subscribe()`, `SubscribeAll()`
- `InMemoryEventBus` implementation with thread-safe handlers
- `BaseEvent` for common event fields

**Domain Events (8 types):**
- Item: `ItemCreatedEvent`, `ItemUpdatedEvent`, `ItemArchivedEvent`, `ItemRestoredEvent`
- Inventory: `InventoryCreatedEvent`, `InventoryMovedEvent`
- Loan: `LoanCreatedEvent`, `LoanReturnedEvent`

**Event Handlers:**
- `ActivityLoggerHandler` - Automatically logs domain events to activity log
- Supports all 8 event types with appropriate action mapping
- Errors are logged but don't fail event processing

**Usage Pattern:**
```go
// In service
func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID, userID *uuid.UUID) error {
    // Business logic
    item, err := s.repo.FindByID(ctx, id, workspaceID)
    if err != nil {
        return err
    }

    if err := item.Archive(); err != nil {
        return err
    }

    if err := s.repo.Save(ctx, item); err != nil {
        return err
    }

    // Publish event (optional, doesn't fail operation)
    if s.eventBus != nil {
        event := events.NewItemArchivedEvent(workspaceID, id, item.Name(), userID)
        _ = s.eventBus.Publish(ctx, event)
    }

    return nil
}
```

**Files Created:**
- `backend/internal/shared/events/events.go:1-116` (core event system)
- `backend/internal/shared/events/domain_events.go:1-232` (8 event types)
- `backend/internal/shared/events/activity_handler.go:1-168` (activity logger)
- `backend/internal/shared/events/events_test.go:1-186` (7 test cases)
- `backend/internal/shared/events/DOMAIN_EVENTS.md` (comprehensive guide)

**Testing:**
- 7 test cases covering event bus and events
- All tests pass
- Demonstrates publish/subscribe, multiple handlers, and event data

**Benefits Delivered:**
✅ Decoupled activity logging from business logic
✅ Easier testing without mocking activity services
✅ Extensible - add handlers without modifying services
✅ Foundation for async events and event sourcing
✅ Thread-safe event processing
✅ Error isolation - handler failures don't stop other handlers

**Future Enhancements:**
- Async event processing with worker pools
- Event persistence for event sourcing
- Distributed events via message queue (RabbitMQ, Kafka)
- Event replay and state reconstruction

**Priority:** ~~Medium~~ **COMPLETED** - Clean architectural improvement.

---

### 5. Repository Error Standardization ✅

**Status:** IMPLEMENTED (2026-01-14)

**Implementation Details:**
- All 15 repositories standardized to return `shared.ErrNotFound` for not found cases
- Created helper functions: `HandleNotFound(err)` and `WrapNotFound(entity, err)`
- Removed redundant nil checks from service layer (item, inventory, loan services)
- Updated all repository tests to expect `shared.ErrNotFound`

**Pattern Applied:**
```go
// Consistent pattern across all repositories
func (r *ItemRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
    row, err := r.queries.GetItem(ctx, queries.GetItemParams{
        ID:          id,
        WorkspaceID: workspaceID,
    })
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, shared.ErrNotFound  // Standardized
        }
        return nil, err
    }
    return r.rowToItem(row), nil
}

// Services simplified - no nil check needed
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Item, error) {
    item, err := s.repo.FindByID(ctx, id, workspaceID)
    if err != nil {
        // Repository returns shared.ErrNotFound, no nil check needed
        return nil, err
    }
    return item, nil  // item is guaranteed non-nil
}
```

**Testing:**
- All repository tests updated to expect `shared.ErrNotFound`
- Pattern: `require.Error(t, err)` + `assert.True(t, shared.IsNotFound(err))`

**Files:**
- `backend/internal/infra/postgres/errors.go` - Helper functions
- `backend/internal/infra/postgres/ERROR_HANDLING.md` - Complete documentation
- Updated 15 repositories, 15 test files, 3 service files

**Benefits Delivered:**
✅ Consistent error handling across all repositories
✅ Services don't need redundant nil checks
✅ Clearer semantic intent
✅ Type-safe error checking with `shared.IsNotFound()`
✅ Works with `errors.Is()` for wrapped errors

**Priority:** ~~Low~~ **COMPLETED** - Consistency improvement.

---

### 6. Rate Limiting for Auth Endpoints ✅

**Status:** IMPLEMENTED (2026-01-14)

**Implementation Details:**
- Custom in-memory rate limiter in `internal/api/middleware/ratelimit.go`
- 5 requests per minute per IP for auth endpoints
- Handles proxy headers (X-Forwarded-For, X-Real-IP)
- Memory leak prevention with background cleanup goroutine
- Returns proper HTTP 429 with Retry-After header
- Applied to `/auth/*` public routes via Chi router group

**Testing:**
- Unit tests: `internal/api/middleware/ratelimit_test.go` (6 test cases)
- Integration tests: `tests/integration/auth_test.go` (end-to-end verification)

**Files:**
- `backend/internal/api/middleware/ratelimit.go:1-134`
- `backend/internal/api/router.go:156-167`

**Priority:** ~~High~~ **COMPLETED** - Security improvement.

---

### 7. Structured Logging ✅

**Status:** IMPLEMENTED (2026-01-14)

**Implementation Details:**
- Go's native `slog` package for zero-dependency structured logging
- Automatic extraction of user_id, user_email, workspace_id, workspace_role from context
- JSON format for production (DEBUG=false), human-readable text for development (DEBUG=true)
- Automatic log level adjustment: INFO (2xx-3xx), WARN (4xx), ERROR (5xx)
- All requests logged with: method, path, status, duration_ms, request_id, remote_addr
- Includes superuser flag when applicable

**Example Production Log:**
```json
{
  "time": "2026-01-14T17:30:45.123Z",
  "level": "INFO",
  "msg": "request completed",
  "method": "POST",
  "path": "/api/items",
  "status": 200,
  "duration_ms": 45,
  "request_id": "abc123",
  "user_id": "550e8400-...",
  "user_email": "user@example.com",
  "workspace_id": "660e8400-...",
  "workspace_role": "admin"
}
```

**Testing:**
- Unit tests: `internal/api/middleware/logger_test.go` (13 test cases)
- Full context extraction, log levels, duration measurement
- Integration with Chi middleware.RequestID

**Files:**
- `backend/internal/api/middleware/logger.go:1-85`
- `backend/internal/api/middleware/LOGGING.md` (documentation)
- `backend/internal/api/router.go:47-52` (integration)

**Benefits Delivered:**
✅ JSON logs for log aggregation (ELK, Datadog, CloudWatch)
✅ Request tracing via request_id
✅ User/workspace context for debugging
✅ Automatic log level assignment
✅ Performance metrics (duration_ms)

**Priority:** ~~Medium~~ **COMPLETED** - Production readiness improvement.

---

### 8. Health Check Enhancements ✅

**Status:** IMPLEMENTED (2026-01-14)

**Implementation Details:**
- Dedicated health handler package in `internal/api/health`
- Database connectivity check with 2-second timeout
- Version information (set at build time via `health.Version` variable)
- Overall status (`healthy` or `degraded`) based on dependency health
- Individual dependency checks in structured map format
- Compatible with Kubernetes readiness/liveness probes

**Example Response:**
```json
{
  "status": "healthy",
  "version": "dev",
  "checks": {
    "database": "healthy"
  }
}
```

**Testing:**
- Unit tests: `internal/api/health/handler_test.go` (5 test cases)
- Tests cover: healthy database, unhealthy database, timeout handling, version field

**Files:**
- `backend/internal/api/health/handler.go:1-70` (implementation)
- `backend/internal/api/health/handler_test.go:1-127` (tests)
- `backend/internal/api/router.go:81-82` (integration)

**Benefits Delivered:**
✅ Actionable monitoring data for operations
✅ Kubernetes-ready health probes
✅ Version tracking for deployments
✅ Degraded status when dependencies fail
✅ Extensible structure for additional checks

**Future Enhancement:**
- Add Redis connectivity check when Redis is wired into router (see Phase 4)

**Priority:** ~~Medium~~ **COMPLETED** - Operations improvement.

---

## Implementation Roadmap

### Phase 1: Security (Immediate) ✅ COMPLETED
- [x] Add rate limiting to auth endpoints ✅ (2026-01-14)
- [x] Add request logging with user context ✅ (2026-01-14)

### Phase 2: Data Integrity (Short-term) ✅ COMPLETED
- [x] Implement transaction manager ✅ (2026-01-14)
- [x] Standardize repository error handling ✅ (2026-01-14)

### Phase 3: Architecture (Medium-term) ✅ COMPLETED
- [x] Define service interfaces consistently ✅ (2026-01-14)
- [x] Implement domain events for side effects ✅ (2026-01-14)
- [x] Enhance health checks ✅ (2026-01-14)

### Phase 4: Scale Preparation (Long-term)
- [ ] Evaluate DI container adoption
- [ ] Add distributed tracing
- [ ] Add Redis health check to health endpoint
- [ ] Wire Redis into router for background jobs

---

## Metrics to Track

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| Test Coverage | 99% | Maintain 95%+ | go test -cover |
| Cyclomatic Complexity | Good | Avg < 10 | gocyclo |
| Code Duplication | Low | < 3% | jscpd |
| API Response Time (p95) | - | < 200ms | Prometheus |
| Error Rate | - | < 0.1% | Monitoring |

---

## References

- [Go Project Layout](https://github.com/golang-standards/project-layout)
- [Domain-Driven Design in Go](https://threedots.tech/post/ddd-lite-in-go-introduction/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Wire Dependency Injection](https://github.com/google/wire)
