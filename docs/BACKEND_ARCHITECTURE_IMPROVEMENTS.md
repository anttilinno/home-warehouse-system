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

### 2. Explicit Transaction Boundaries

**Current State:** Individual repository operations without explicit transaction coordination.

**Problem:** Multi-aggregate operations lack atomic guarantees.

**Example Scenario:**
```go
// Creating inventory with movement tracking
// If movement creation fails, inventory is orphaned
inventory, err := inventorySvc.Create(ctx, input)
movement, err := movementSvc.Create(ctx, movementInput) // What if this fails?
```

**Recommendation:** Add transaction support to services for cross-aggregate operations.

**Implementation Pattern:**
```go
// internal/infra/postgres/tx.go
type TxManager struct {
    pool *pgxpool.Pool
}

func (tm *TxManager) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
    tx, err := tm.pool.Begin(ctx)
    if err != nil {
        return err
    }
    defer tx.Rollback(ctx)

    // Store tx in context for repositories to use
    ctx = context.WithValue(ctx, txKey, tx)

    if err := fn(ctx); err != nil {
        return err
    }
    return tx.Commit(ctx)
}

// Usage in service
func (s *InventoryService) CreateWithMovement(ctx context.Context, input CreateInput) error {
    return s.txManager.WithTx(ctx, func(ctx context.Context) error {
        inv, err := s.repo.Save(ctx, inventory)
        if err != nil {
            return err
        }
        return s.movementRepo.Save(ctx, movement)
    })
}
```

**Priority:** Medium - Important for data integrity in complex operations.

---

### 3. Service Interface Consistency

**Current State:** Some domains define `ServiceInterface`, others don't.

```go
// item/service.go - Has interface
type ServiceInterface interface {
    Create(ctx context.Context, input CreateInput) (*Item, error)
    // ...
}

// category/service.go - No interface defined
type Service struct {
    repo Repository
}
```

**Recommendation:** Define interfaces for all services.

**Benefits:**
- Consistent mocking in tests
- Clear API contracts
- Better IDE support

**Implementation:**
```bash
# Find services without interfaces
rg "^type Service struct" backend/internal/domain/ -l | while read f; do
    dir=$(dirname "$f")
    if ! grep -q "ServiceInterface" "$f"; then
        echo "Missing interface: $f"
    fi
done
```

**Priority:** Low - Improves consistency but not blocking.

---

### 4. Domain Events for Side Effects

**Current State:** Side effects (activity logging, notifications) are handled synchronously in services.

**Problem:** Core business logic is coupled to secondary concerns.

**Recommendation:** Implement domain events for cross-cutting concerns.

**Pattern:**
```go
// internal/shared/events/events.go
type Event interface {
    EventName() string
    OccurredAt() time.Time
}

type EventBus interface {
    Publish(ctx context.Context, event Event)
    Subscribe(eventName string, handler EventHandler)
}

// Domain event
type ItemArchivedEvent struct {
    ItemID      uuid.UUID
    WorkspaceID uuid.UUID
    ArchivedBy  uuid.UUID
    ArchivedAt  time.Time
}

// In entity
func (i *Item) Archive(userID uuid.UUID) ItemArchivedEvent {
    i.isArchived = true
    i.updatedAt = time.Now()
    return ItemArchivedEvent{
        ItemID:      i.id,
        WorkspaceID: i.workspaceID,
        ArchivedBy:  userID,
        ArchivedAt:  i.updatedAt,
    }
}

// In handler
func (h *Handler) archive(ctx context.Context, input *ArchiveInput) (*ArchiveOutput, error) {
    event, err := h.svc.Archive(ctx, input.ID, input.WorkspaceID, userID)
    if err != nil {
        return nil, err
    }
    h.eventBus.Publish(ctx, event) // Activity logger subscribes to this
    return &ArchiveOutput{}, nil
}
```

**Benefits:**
- Decoupled activity logging
- Easier testing of core logic
- Foundation for event sourcing if needed later

**Priority:** Medium - Clean architectural improvement.

---

### 5. Repository Error Standardization

**Current State:** Inconsistent error handling across repositories.

```go
// Some return nil
func (r *ItemRepository) FindByID(ctx, id, wsID) (*Item, error) {
    // ...
    if err == pgx.ErrNoRows {
        return nil, nil  // nil item, nil error
    }
}

// Others return error
func (r *UserRepository) FindByEmail(ctx, email) (*User, error) {
    // ...
    if err == pgx.ErrNoRows {
        return nil, shared.ErrNotFound  // nil user, error
    }
}
```

**Recommendation:** Standardize on returning `shared.ErrNotFound`.

**Pattern:**
```go
// Consistent pattern for all repositories
func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*Entity, error) {
    row := r.pool.QueryRow(ctx, query, id)
    entity, err := r.scan(row)
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, shared.ErrNotFound
        }
        return nil, err
    }
    return entity, nil
}

// Service can then consistently handle
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Entity, error) {
    entity, err := s.repo.FindByID(ctx, id)
    if err != nil {
        if shared.IsNotFound(err) {
            return nil, ErrEntityNotFound // domain-specific error
        }
        return nil, err
    }
    return entity, nil
}
```

**Priority:** Low - Consistency improvement.

---

### 6. Rate Limiting for Auth Endpoints

**Current State:** No rate limiting on authentication endpoints.

**Risk:** Brute force attacks on `/auth/login`.

**Recommendation:** Add rate limiting middleware for auth routes.

**Implementation:**
```go
// Using tollbooth or go-chi/httprate
import "github.com/go-chi/httprate"

// In router.go, wrap auth routes
r.Group(func(r chi.Router) {
    // 5 requests per minute per IP for login
    r.Use(httprate.LimitByIP(5, time.Minute))
    userHandler.RegisterPublicRoutes(api)
})
```

**Alternative:** Redis-based rate limiting for distributed deployments.

```go
// internal/api/middleware/ratelimit.go
func RateLimitByIP(redis *redis.Client, limit int, window time.Duration) func(next http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := r.RemoteAddr
            key := fmt.Sprintf("ratelimit:%s", ip)

            count, _ := redis.Incr(r.Context(), key).Result()
            if count == 1 {
                redis.Expire(r.Context(), key, window)
            }

            if count > int64(limit) {
                http.Error(w, "Too many requests", http.StatusTooManyRequests)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

**Priority:** High - Security improvement.

---

### 7. Structured Logging

**Current State:** Chi middleware logger with basic output.

**Recommendation:** Structured JSON logging for production observability.

**Implementation:**
```go
// Using zerolog or slog (Go 1.21+)
import "log/slog"

// internal/api/middleware/logging.go
func StructuredLogger(logger *slog.Logger) func(next http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

            defer func() {
                logger.Info("request",
                    "method", r.Method,
                    "path", r.URL.Path,
                    "status", ww.Status(),
                    "duration_ms", time.Since(start).Milliseconds(),
                    "request_id", middleware.GetReqID(r.Context()),
                    "user_id", getUserID(r.Context()),
                    "workspace_id", getWorkspaceID(r.Context()),
                )
            }()

            next.ServeHTTP(ww, r)
        })
    }
}
```

**Benefits:**
- JSON logs for log aggregation (ELK, Datadog, etc.)
- Request tracing via request_id
- User/workspace context for debugging

**Priority:** Medium - Production readiness improvement.

---

### 8. Health Check Enhancements

**Current State:** Basic health check returning `{"status": "ok"}`.

```go
huma.Get(api, "/health", func(ctx context.Context, input *struct{}) (*HealthResponse, error) {
    return &HealthResponse{Body: HealthBody{Status: "ok"}}, nil
})
```

**Recommendation:** Add dependency health checks.

**Implementation:**
```go
type HealthResponse struct {
    Status   string            `json:"status"`
    Checks   map[string]string `json:"checks"`
    Version  string            `json:"version"`
}

func (h *HealthHandler) health(ctx context.Context, input *struct{}) (*HealthResponse, error) {
    checks := make(map[string]string)

    // Database check
    if err := h.pool.Ping(ctx); err != nil {
        checks["database"] = "unhealthy"
    } else {
        checks["database"] = "healthy"
    }

    // Redis check
    if err := h.redis.Ping(ctx).Err(); err != nil {
        checks["redis"] = "unhealthy"
    } else {
        checks["redis"] = "healthy"
    }

    status := "healthy"
    for _, v := range checks {
        if v == "unhealthy" {
            status = "degraded"
            break
        }
    }

    return &HealthResponse{
        Status:  status,
        Checks:  checks,
        Version: config.Version,
    }, nil
}
```

**Priority:** Medium - Operations improvement.

---

## Implementation Roadmap

### Phase 1: Security (Immediate)
- [ ] Add rate limiting to auth endpoints
- [ ] Add request logging with user context

### Phase 2: Data Integrity (Short-term)
- [ ] Implement transaction manager
- [ ] Standardize repository error handling

### Phase 3: Architecture (Medium-term)
- [ ] Define service interfaces consistently
- [ ] Consider domain events for side effects
- [ ] Enhance health checks

### Phase 4: Scale Preparation (Long-term)
- [ ] Evaluate DI container adoption
- [ ] Implement structured logging
- [ ] Add distributed tracing

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
