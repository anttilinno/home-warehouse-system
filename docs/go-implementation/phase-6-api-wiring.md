## Phase 6: API Layer & Wiring

### 6.1 Router Setup

```go
// internal/api/router.go
package api

import (
    "github.com/danielgtaylor/huma/v2"
    "github.com/danielgtaylor/huma/v2/adapters/humachi"
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"

    // Domain imports...
)

func NewRouter(queries *queries.Queries) chi.Router {
    r := chi.NewRouter()

    // Global middleware
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.RequestID)
    r.Use(middleware.RealIP)
    r.Use(middleware.Timeout(60 * time.Second))

    // Create Huma API
    api := humachi.New(r, huma.DefaultConfig("Home Warehouse API", "1.0.0"))

    // Health check (no auth)
    RegisterHealthRoutes(api)

    // Auth routes (no auth required for login/register)
    userRepo := postgres.NewUserRepository(queries)
    userSvc := user.NewService(userRepo)
    user.NewHandler(userSvc).RegisterPublicRoutes(api)

    // Protected routes
    r.Group(func(r chi.Router) {
        r.Use(AuthMiddleware)

        protectedAPI := humachi.New(r, huma.DefaultConfig("Home Warehouse API", "1.0.0"))

        // User routes (authenticated)
        user.NewHandler(userSvc).RegisterProtectedRoutes(protectedAPI)

        // Workspace routes
        workspaceRepo := postgres.NewWorkspaceRepository(queries)
        memberRepo := postgres.NewMemberRepository(queries)
        workspaceSvc := workspace.NewService(workspaceRepo, memberRepo)
        workspace.NewHandler(workspaceSvc).RegisterRoutes(protectedAPI)

        // Member routes
        memberSvc := member.NewService(memberRepo, userRepo)
        member.NewHandler(memberSvc).RegisterRoutes(protectedAPI)

        // Notification routes
        notificationRepo := postgres.NewNotificationRepository(queries)
        notificationSvc := notification.NewService(notificationRepo)
        notification.NewHandler(notificationSvc).RegisterRoutes(protectedAPI)

        // Workspace-scoped routes (with workspace middleware)
        r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
            r.Use(WorkspaceMiddleware)
            r.Use(TenantMiddleware)

            wsAPI := humachi.New(r, huma.DefaultConfig("Home Warehouse API", "1.0.0"))

            // Category
            categoryRepo := postgres.NewCategoryRepository(queries)
            categorySvc := category.NewService(categoryRepo)
            category.NewHandler(categorySvc).RegisterRoutes(wsAPI)

            // Location
            locationRepo := postgres.NewLocationRepository(queries)
            locationSvc := location.NewService(locationRepo)
            location.NewHandler(locationSvc).RegisterRoutes(wsAPI)

            // Container
            containerRepo := postgres.NewContainerRepository(queries)
            containerSvc := container.NewService(containerRepo, locationRepo)
            container.NewHandler(containerSvc).RegisterRoutes(wsAPI)

            // Company
            companyRepo := postgres.NewCompanyRepository(queries)
            companySvc := company.NewService(companyRepo)
            company.NewHandler(companySvc).RegisterRoutes(wsAPI)

            // Label
            labelRepo := postgres.NewLabelRepository(queries)
            labelSvc := label.NewService(labelRepo)
            label.NewHandler(labelSvc).RegisterRoutes(wsAPI)

            // Item
            itemRepo := postgres.NewItemRepository(queries)
            itemSvc := item.NewService(itemRepo, categoryRepo, labelRepo)
            item.NewHandler(itemSvc).RegisterRoutes(wsAPI)

            // Inventory
            inventoryRepo := postgres.NewInventoryRepository(queries)
            movementRepo := postgres.NewMovementRepository(queries)
            inventorySvc := inventory.NewService(inventoryRepo, itemRepo, locationRepo, containerRepo, movementRepo)
            inventory.NewHandler(inventorySvc).RegisterRoutes(wsAPI)

            // Borrower
            borrowerRepo := postgres.NewBorrowerRepository(queries)
            borrowerSvc := borrower.NewService(borrowerRepo)
            borrower.NewHandler(borrowerSvc).RegisterRoutes(wsAPI)

            // Loan
            loanRepo := postgres.NewLoanRepository(queries)
            loanSvc := loan.NewService(loanRepo, inventoryRepo, borrowerRepo)
            loan.NewHandler(loanSvc).RegisterRoutes(wsAPI)

            // Activity
            activityRepo := postgres.NewActivityRepository(queries)
            activitySvc := activity.NewService(activityRepo)
            activity.NewHandler(activitySvc).RegisterRoutes(wsAPI)

            // Favorites
            favoriteRepo := postgres.NewFavoriteRepository(queries)
            favoriteSvc := favorite.NewService(favoriteRepo)
            favorite.NewHandler(favoriteSvc).RegisterRoutes(wsAPI)
        })
    })

    return r
}
```

---

### 6.2 Middleware

**Auth Middleware:**

```go
// internal/api/middleware/auth.go
package middleware

import (
    "context"
    "net/http"
    "strings"
)

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }

        token := strings.TrimPrefix(authHeader, "Bearer ")

        // Validate JWT and extract user
        user, err := validateToken(token)
        if err != nil {
            http.Error(w, "invalid token", http.StatusUnauthorized)
            return
        }

        ctx := context.WithValue(r.Context(), UserContextKey, user)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

**Workspace Middleware:**

```go
// internal/api/middleware/workspace.go
package middleware

import (
    "context"
    "net/http"

    "github.com/go-chi/chi/v5"
    "github.com/google/uuid"
)

const WorkspaceContextKey contextKey = "workspace"
const RoleContextKey contextKey = "role"

func WorkspaceMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        workspaceIDStr := chi.URLParam(r, "workspace_id")
        workspaceID, err := uuid.Parse(workspaceIDStr)
        if err != nil {
            http.Error(w, "invalid workspace ID", http.StatusBadRequest)
            return
        }

        user := r.Context().Value(UserContextKey).(*User)

        // Check user has access to workspace and get role
        role, err := getMemberRole(r.Context(), workspaceID, user.ID)
        if err != nil {
            http.Error(w, "forbidden", http.StatusForbidden)
            return
        }

        ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
        ctx = context.WithValue(ctx, RoleContextKey, role)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

---

### 6.3 API Routes Overview

| Domain | Base Path | Key Endpoints |
|--------|-----------|---------------|
| **Auth** | `/auth` | `POST /register`, `POST /login`, `POST /refresh` |
| **User** | `/users` | `GET /me`, `PATCH /me`, `PATCH /me/password`, `PATCH /me/preferences` |
| **Workspace** | `/workspaces` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| **Member** | `/workspaces/:id/members` | `GET /`, `POST /`, `PATCH /:user_id`, `DELETE /:user_id` |
| **Notification** | `/notifications` | `GET /`, `POST /:id/read`, `POST /read-all`, `GET /count` |
| **Category** | `/workspaces/:id/categories` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /tree` |
| **Location** | `/workspaces/:id/locations` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /tree`, `GET /search` |
| **Container** | `/workspaces/:id/containers` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| **Company** | `/workspaces/:id/companies` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| **Label** | `/workspaces/:id/labels` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| **Item** | `/workspaces/:id/items` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /search`, `POST /:id/labels`, `DELETE /:id/labels/:label_id` |
| **Inventory** | `/workspaces/:id/inventory` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /:id/move`, `PATCH /:id/status`, `GET /:id/movements` |
| **Borrower** | `/workspaces/:id/borrowers` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| **Loan** | `/workspaces/:id/loans` | `GET /`, `POST /`, `GET /:id`, `POST /:id/return`, `PATCH /:id/extend`, `GET /active`, `GET /overdue` |
| **Activity** | `/workspaces/:id/activity` | `GET /`, `GET /entity/:type/:id` |
| **Favorites** | `/workspaces/:id/favorites` | `GET /`, `POST /`, `DELETE /:id` |
| **Sync** | `/workspaces/:id/sync` | `GET /deleted?since=timestamp` |

---

