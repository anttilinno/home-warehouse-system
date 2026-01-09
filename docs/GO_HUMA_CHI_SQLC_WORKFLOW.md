# Go API Development Workflow
## Huma + Chi + sqlc + dbmate

This document describes the complete development workflow for building Go APIs using this stack.

---

## Stack Overview

| Tool | Purpose |
|------|---------|
| **Chi** | Lightweight, idiomatic HTTP router |
| **Huma** | API framework with automatic OpenAPI generation |
| **sqlc** | Generate type-safe Go from SQL queries |
| **dbmate** | Database migrations (SQL-based) |

**Why this combination:**
- Chi: Fast, composable middleware, no magic
- Huma: OpenAPI docs generated from Go types, works on top of Chi
- sqlc: You write SQL, it writes Go—perfect for SQL-proficient developers
- dbmate: Simple, language-agnostic migrations in plain SQL

---

## Project Structure

```
myapp/
├── cmd/
│   └── server/
│       └── main.go              # Application entrypoint
├── internal/
│   ├── api/
│   │   ├── router.go            # Chi router + Huma setup
│   │   ├── middleware.go        # Custom middleware
│   │   └── handlers/
│   │       ├── items.go         # Item endpoints
│   │       ├── locations.go     # Location endpoints
│   │       └── health.go        # Health check
│   ├── config/
│   │   └── config.go            # Configuration loading
│   ├── database/
│   │   ├── db.go                # Connection pool setup
│   │   └── queries/             # sqlc generated code (don't edit)
│   │       ├── db.go
│   │       ├── models.go
│   │       └── queries.sql.go
│   └── service/
│       ├── items.go             # Business logic
│       └── locations.go
├── db/
│   ├── migrations/              # dbmate migrations
│   │   ├── 20260109120000_initial_schema.sql
│   │   └── 20260109130000_add_soft_delete.sql
│   └── queries/                 # sqlc query files
│       ├── items.sql
│       ├── locations.sql
│       └── inventory.sql
├── sqlc.yaml                    # sqlc configuration
├── .env                         # Environment variables (don't commit)
├── .env.example                 # Example env file
├── Makefile                     # Common commands
├── Dockerfile
└── go.mod
```

---

## Initial Setup

### 1. Install Tools

```bash
# Go (if not installed)
# See https://go.dev/dl/

# dbmate
brew install dbmate
# or: curl -fsSL https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64 -o /usr/local/bin/dbmate

# sqlc
brew install sqlc
# or: go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
```

### 2. Initialize Project

```bash
mkdir myapp && cd myapp
go mod init github.com/yourusername/myapp

# Install dependencies
go get github.com/go-chi/chi/v5
go get github.com/danielgtaylor/huma/v2
go get github.com/jackc/pgx/v5
go get github.com/joho/godotenv
```

### 3. Environment Setup

```bash
# .env
DATABASE_URL="postgres://user:pass@localhost:5432/myapp_dev?sslmode=disable"
PORT=8080
ENV=development
```

```bash
# .env.example (commit this)
DATABASE_URL="postgres://user:pass@localhost:5432/myapp_dev?sslmode=disable"
PORT=8080
ENV=development
```

---

## Database Workflow (dbmate)

### Creating Migrations

```bash
# Create new migration
dbmate new add_items_table

# Creates: db/migrations/20260109143052_add_items_table.sql
```

### Migration File Structure

```sql
-- db/migrations/20260109143052_add_items_table.sql

-- migrate:up
CREATE TABLE items (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_items_workspace ON items(workspace_id);

-- migrate:down
DROP TABLE IF EXISTS items;
```

### Running Migrations

```bash
# Apply all pending migrations
dbmate up

# Rollback last migration
dbmate down

# Check migration status
dbmate status

# Create database (if doesn't exist)
dbmate create

# Drop database
dbmate drop

# Dump schema (for reference)
dbmate dump
# Creates db/schema.sql
```

### Migration Best Practices

1. **One change per migration** — easier to rollback
2. **Always write down migrations** — even if you think you won't need them
3. **Test both directions** — `dbmate up && dbmate down && dbmate up`
4. **Never edit applied migrations** — create new ones instead

---

## Query Workflow (sqlc)

### Configuration

```yaml
# sqlc.yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "db/queries/"
    schema: "db/migrations/"
    gen:
      go:
        package: "queries"
        out: "internal/database/queries"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_empty_slices: true
        emit_pointers_for_null_types: true
```

### Writing Queries

```sql
-- db/queries/items.sql

-- name: GetItem :one
SELECT * FROM items
WHERE id = $1 AND workspace_id = $2 AND is_archived = false;

-- name: ListItems :many
SELECT * FROM items
WHERE workspace_id = $1 AND is_archived = false
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateItem :one
INSERT INTO items (id, workspace_id, name, description)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateItem :one
UPDATE items
SET name = $2, description = $3, updated_at = now()
WHERE id = $1 AND is_archived = false
RETURNING *;

-- name: ArchiveItem :exec
UPDATE items
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: SearchItems :many
SELECT * FROM items
WHERE workspace_id = $1 
  AND is_archived = false
  AND search_vector @@ plainto_tsquery('english', $2)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
LIMIT $3;
```

### Query Annotations

| Annotation | Returns | Use Case |
|------------|---------|----------|
| `:one` | Single row or error | Get by ID |
| `:many` | Slice (empty if none) | List queries |
| `:exec` | Error only | UPDATE/DELETE without returning |
| `:execrows` | Rows affected + error | When you need count |
| `:execresult` | sql.Result + error | For LastInsertId |
| `:copyfrom` | Batch insert | Bulk imports |

### Generate Code

```bash
# Generate Go code from queries
sqlc generate

# Verify queries are valid (without generating)
sqlc vet
```

### Generated Code Usage

```go
// internal/database/db.go
package database

import (
    "context"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/yourusername/myapp/internal/database/queries"
)

type DB struct {
    Pool    *pgxpool.Pool
    Queries *queries.Queries
}

func New(ctx context.Context, databaseURL string) (*DB, error) {
    pool, err := pgxpool.New(ctx, databaseURL)
    if err != nil {
        return nil, err
    }
    
    return &DB{
        Pool:    pool,
        Queries: queries.New(pool),
    }, nil
}

func (db *DB) Close() {
    db.Pool.Close()
}
```

```go
// Using queries in handlers
func (h *Handler) GetItem(ctx context.Context, input *GetItemInput) (*GetItemOutput, error) {
    item, err := h.db.Queries.GetItem(ctx, queries.GetItemParams{
        ID:          input.ID,
        WorkspaceID: input.WorkspaceID,
    })
    if err != nil {
        return nil, err
    }
    
    return &GetItemOutput{Item: item}, nil
}
```

---

## API Workflow (Huma + Chi)

### Router Setup

```go
// internal/api/router.go
package api

import (
    "github.com/danielgtaylor/huma/v2"
    "github.com/danielgtaylor/huma/v2/adapters/humachi"
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
    "github.com/yourusername/myapp/internal/api/handlers"
    "github.com/yourusername/myapp/internal/database"
)

func NewRouter(db *database.DB) chi.Router {
    r := chi.NewRouter()
    
    // Middleware
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.RequestID)
    
    // Create Huma API
    api := humachi.New(r, huma.DefaultConfig("Home Warehouse API", "1.0.0"))
    
    // Register handlers
    h := handlers.New(db)
    RegisterItemRoutes(api, h)
    RegisterLocationRoutes(api, h)
    RegisterHealthRoutes(api)
    
    return r
}
```

### Defining Endpoints with Huma

```go
// internal/api/handlers/items.go
package handlers

import (
    "context"
    "net/http"
    
    "github.com/danielgtaylor/huma/v2"
    "github.com/google/uuid"
)

// Input/Output types - Huma generates OpenAPI from these

type ListItemsInput struct {
    WorkspaceID uuid.UUID `path:"workspace_id" doc:"Workspace ID"`
    Limit       int       `query:"limit" default:"20" minimum:"1" maximum:"100" doc:"Items per page"`
    Offset      int       `query:"offset" default:"0" minimum:"0" doc:"Pagination offset"`
}

type ListItemsOutput struct {
    Body struct {
        Items []ItemResponse `json:"items"`
        Total int            `json:"total"`
    }
}

type ItemResponse struct {
    ID          uuid.UUID  `json:"id"`
    Name        string     `json:"name"`
    Description *string    `json:"description,omitempty"`
    CreatedAt   time.Time  `json:"created_at"`
}

type GetItemInput struct {
    WorkspaceID uuid.UUID `path:"workspace_id"`
    ItemID      uuid.UUID `path:"item_id"`
}

type GetItemOutput struct {
    Body ItemResponse
}

type CreateItemInput struct {
    WorkspaceID uuid.UUID `path:"workspace_id"`
    Body struct {
        Name        string  `json:"name" minLength:"1" maxLength:"200" doc:"Item name"`
        Description *string `json:"description,omitempty" doc:"Item description"`
    }
}

type CreateItemOutput struct {
    Body ItemResponse
}

// Register routes

func RegisterItemRoutes(api huma.API, h *Handler) {
    huma.Register(api, huma.Operation{
        OperationID: "list-items",
        Method:      http.MethodGet,
        Path:        "/workspaces/{workspace_id}/items",
        Summary:     "List items",
        Description: "List all items in a workspace",
        Tags:        []string{"Items"},
    }, h.ListItems)
    
    huma.Register(api, huma.Operation{
        OperationID: "get-item",
        Method:      http.MethodGet,
        Path:        "/workspaces/{workspace_id}/items/{item_id}",
        Summary:     "Get item",
        Tags:        []string{"Items"},
    }, h.GetItem)
    
    huma.Register(api, huma.Operation{
        OperationID:   "create-item",
        Method:        http.MethodPost,
        Path:          "/workspaces/{workspace_id}/items",
        Summary:       "Create item",
        Tags:          []string{"Items"},
        DefaultStatus: http.StatusCreated,
    }, h.CreateItem)
}

// Handler implementations

func (h *Handler) ListItems(ctx context.Context, input *ListItemsInput) (*ListItemsOutput, error) {
    items, err := h.db.Queries.ListItems(ctx, queries.ListItemsParams{
        WorkspaceID: input.WorkspaceID,
        Limit:       int32(input.Limit),
        Offset:      int32(input.Offset),
    })
    if err != nil {
        return nil, huma.Error500InternalServerError("failed to list items")
    }
    
    response := &ListItemsOutput{}
    response.Body.Items = make([]ItemResponse, len(items))
    for i, item := range items {
        response.Body.Items[i] = toItemResponse(item)
    }
    response.Body.Total = len(items)
    
    return response, nil
}

func (h *Handler) GetItem(ctx context.Context, input *GetItemInput) (*GetItemOutput, error) {
    item, err := h.db.Queries.GetItem(ctx, queries.GetItemParams{
        ID:          input.ItemID,
        WorkspaceID: input.WorkspaceID,
    })
    if err != nil {
        return nil, huma.Error404NotFound("item not found")
    }
    
    return &GetItemOutput{Body: toItemResponse(item)}, nil
}

func (h *Handler) CreateItem(ctx context.Context, input *CreateItemInput) (*CreateItemOutput, error) {
    item, err := h.db.Queries.CreateItem(ctx, queries.CreateItemParams{
        ID:          uuid.New(),
        WorkspaceID: input.WorkspaceID,
        Name:        input.Body.Name,
        Description: input.Body.Description,
    })
    if err != nil {
        return nil, huma.Error500InternalServerError("failed to create item")
    }
    
    return &CreateItemOutput{Body: toItemResponse(item)}, nil
}

func toItemResponse(item queries.Item) ItemResponse {
    return ItemResponse{
        ID:          item.ID,
        Name:        item.Name,
        Description: item.Description,
        CreatedAt:   item.CreatedAt,
    }
}
```

### Handler Base

```go
// internal/api/handlers/handler.go
package handlers

import "github.com/yourusername/myapp/internal/database"

type Handler struct {
    db *database.DB
}

func New(db *database.DB) *Handler {
    return &Handler{db: db}
}
```

### Health Check

```go
// internal/api/handlers/health.go
package handlers

import (
    "context"
    "net/http"
    
    "github.com/danielgtaylor/huma/v2"
)

type HealthOutput struct {
    Body struct {
        Status string `json:"status"`
    }
}

func RegisterHealthRoutes(api huma.API) {
    huma.Register(api, huma.Operation{
        OperationID: "health",
        Method:      http.MethodGet,
        Path:        "/health",
        Summary:     "Health check",
        Tags:        []string{"System"},
    }, func(ctx context.Context, input *struct{}) (*HealthOutput, error) {
        return &HealthOutput{Body: struct {
            Status string `json:"status"`
        }{Status: "ok"}}, nil
    })
}
```

### Main Entrypoint

```go
// cmd/server/main.go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    
    "github.com/joho/godotenv"
    "github.com/yourusername/myapp/internal/api"
    "github.com/yourusername/myapp/internal/database"
)

func main() {
    // Load .env in development
    godotenv.Load()
    
    ctx := context.Background()
    
    // Connect to database
    db, err := database.New(ctx, os.Getenv("DATABASE_URL"))
    if err != nil {
        log.Fatalf("failed to connect to database: %v", err)
    }
    defer db.Close()
    
    // Create router
    router := api.NewRouter(db)
    
    // Start server
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    
    log.Printf("Server starting on :%s", port)
    log.Printf("OpenAPI docs available at http://localhost:%s/docs", port)
    
    if err := http.ListenAndServe(":"+port, router); err != nil {
        log.Fatalf("server failed: %v", err)
    }
}
```

---

## Development Workflow

### Makefile

```makefile
# Makefile

.PHONY: dev run build test migrate sqlc lint

# Load .env
include .env
export

# Development with hot reload (install: go install github.com/air-verse/air@latest)
dev:
	air

# Run without hot reload
run:
	go run cmd/server/main.go

# Build binary
build:
	CGO_ENABLED=0 go build -o bin/server cmd/server/main.go

# Run tests
test:
	go test -v ./...

# Database migrations
migrate-up:
	dbmate up

migrate-down:
	dbmate down

migrate-status:
	dbmate status

migrate-new:
	@read -p "Migration name: " name; \
	dbmate new $$name

# Generate sqlc code
sqlc:
	sqlc generate

# Verify sqlc queries
sqlc-vet:
	sqlc vet

# Lint
lint:
	golangci-lint run

# Full regenerate (after schema changes)
generate: migrate-up sqlc

# Reset database
db-reset:
	dbmate drop
	dbmate up
```

### Air Configuration (Hot Reload)

```toml
# .air.toml
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/main ./cmd/server"
  bin = "./tmp/main"
  delay = 1000
  exclude_dir = ["tmp", "vendor", "node_modules"]
  exclude_file = []
  exclude_regex = ["_test.go"]
  exclude_unchanged = false
  follow_symlink = false
  include_ext = ["go", "tpl", "tmpl", "html", "sql"]
  kill_delay = "0s"
  log = "build-errors.log"
  send_interrupt = false
  stop_on_error = true

[log]
  time = false

[color]
  main = "magenta"
  watcher = "cyan"
  build = "yellow"
  runner = "green"

[misc]
  clean_on_exit = false
```

### Daily Workflow

```bash
# 1. Start development
make dev

# 2. Need a new table?
make migrate-new
# Edit the migration file
make migrate-up
# Write queries in db/queries/
make sqlc

# 3. Adding new endpoint?
# - Add query to db/queries/something.sql
make sqlc
# - Add handler in internal/api/handlers/
# - Register route in router.go
# Air auto-reloads

# 4. Before committing
make lint
make test

# 5. View API docs
open http://localhost:8080/docs
```

---

## Error Handling

### Huma Error Helpers

```go
// Common errors
huma.Error400BadRequest("invalid input")
huma.Error401Unauthorized("authentication required")
huma.Error403Forbidden("access denied")
huma.Error404NotFound("resource not found")
huma.Error500InternalServerError("something went wrong")

// Custom error with details
huma.Error400BadRequest("validation failed", &huma.ErrorDetail{
    Location: "body.name",
    Message:  "name is required",
    Value:    "",
})
```

### Wrapping Database Errors

```go
func (h *Handler) GetItem(ctx context.Context, input *GetItemInput) (*GetItemOutput, error) {
    item, err := h.db.Queries.GetItem(ctx, queries.GetItemParams{
        ID:          input.ItemID,
        WorkspaceID: input.WorkspaceID,
    })
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, huma.Error404NotFound("item not found")
        }
        // Log the actual error
        slog.Error("database error", "error", err, "item_id", input.ItemID)
        return nil, huma.Error500InternalServerError("failed to fetch item")
    }
    
    return &GetItemOutput{Body: toItemResponse(item)}, nil
}
```

---

## Testing

### Query Tests

```go
// internal/database/queries/items_test.go
package queries_test

import (
    "context"
    "testing"
    
    "github.com/google/uuid"
    "github.com/stretchr/testify/require"
    "github.com/yourusername/myapp/internal/database"
)

func TestCreateAndGetItem(t *testing.T) {
    ctx := context.Background()
    db := setupTestDB(t) // Helper that creates test database
    defer db.Close()
    
    workspaceID := uuid.New()
    
    // Create
    item, err := db.Queries.CreateItem(ctx, queries.CreateItemParams{
        ID:          uuid.New(),
        WorkspaceID: workspaceID,
        Name:        "Test Item",
    })
    require.NoError(t, err)
    require.Equal(t, "Test Item", item.Name)
    
    // Get
    fetched, err := db.Queries.GetItem(ctx, queries.GetItemParams{
        ID:          item.ID,
        WorkspaceID: workspaceID,
    })
    require.NoError(t, err)
    require.Equal(t, item.ID, fetched.ID)
}
```

### API Tests

```go
// internal/api/handlers/items_test.go
package handlers_test

import (
    "net/http"
    "net/http/httptest"
    "testing"
    
    "github.com/stretchr/testify/require"
    "github.com/yourusername/myapp/internal/api"
)

func TestListItems(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    
    router := api.NewRouter(db)
    
    req := httptest.NewRequest(http.MethodGet, "/workspaces/"+workspaceID+"/items", nil)
    rec := httptest.NewRecorder()
    
    router.ServeHTTP(rec, req)
    
    require.Equal(t, http.StatusOK, rec.Code)
}
```

---

## Deployment

### Dockerfile

```dockerfile
# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# Final stage
FROM scratch

COPY --from=builder /server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

EXPOSE 8080

ENTRYPOINT ["/server"]
```

### Build and Run

```bash
# Build image
docker build -t myapp:latest .

# Run
docker run -p 8080:8080 \
  -e DATABASE_URL="postgres://..." \
  myapp:latest
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: myapp-secrets
                  key: database-url
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "32Mi"
              cpu: "10m"
            limits:
              memory: "128Mi"
              cpu: "100m"
```

---

## Quick Reference

### Common Commands

| Command | Purpose |
|---------|---------|
| `make dev` | Start with hot reload |
| `make migrate-new` | Create migration |
| `make migrate-up` | Apply migrations |
| `make sqlc` | Generate query code |
| `make generate` | Migrate + sqlc |
| `make test` | Run tests |
| `make build` | Build binary |

### Adding a New Feature

1. **Schema change?** → `make migrate-new`, write SQL, `make migrate-up`
2. **New queries?** → Add to `db/queries/*.sql`, `make sqlc`
3. **New endpoint?** → Add Input/Output types, handler, register route
4. **Test** → Write tests, `make test`

### OpenAPI Docs

Automatically available at `/docs` when server is running.

Export OpenAPI spec:
```bash
curl http://localhost:8080/openapi.json > openapi.json
```
