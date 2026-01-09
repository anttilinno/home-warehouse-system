# Go Backend Implementation Plan

This document outlines the complete implementation plan for the Go backend using DDD (Domain-Driven Design) + TDD (Test-Driven Development) with the Huma + Chi + sqlc + dbmate stack.

---

## Table of Contents

1. [Phase 0: Project Setup](#phase-0-project-setup)
2. [Phase 1: Auth Domain](#phase-1-auth-domain)
3. [Phase 2: Core Warehouse Domains](#phase-2-core-warehouse-domains)
4. [Phase 3: Item & Inventory Domains](#phase-3-item--inventory-domains)
5. [Phase 4: Loan Domain](#phase-4-loan-domain)
6. [Phase 5: Supporting Domains](#phase-5-supporting-domains)
7. [Phase 6: API Layer & Wiring](#phase-6-api-layer--wiring)
8. [Phase 7: Implementation Order](#phase-7-implementation-order)
9. [Phase 8: Testing Strategy](#phase-8-testing-strategy)

---

## Phase 0: Project Setup

### 0.1 Initialize Go Module & Install Dependencies

```bash
mkdir go-backend && cd go-backend
go mod init github.com/antti/home-warehouse-system/go-backend

# Install dependencies
go get github.com/go-chi/chi/v5
go get github.com/danielgtaylor/huma/v2
go get github.com/jackc/pgx/v5
go get github.com/google/uuid
go get github.com/joho/godotenv
go get github.com/stretchr/testify
```

### 0.2 Project Structure

```
go-backend/
├── cmd/
│   └── server/main.go
├── internal/
│   ├── domain/
│   │   ├── auth/
│   │   │   ├── user/
│   │   │   ├── workspace/
│   │   │   ├── member/
│   │   │   └── notification/
│   │   └── warehouse/
│   │       ├── item/
│   │       ├── category/
│   │       ├── location/
│   │       ├── container/
│   │       ├── inventory/
│   │       ├── loan/
│   │       ├── borrower/
│   │       ├── company/
│   │       ├── label/
│   │       ├── attachment/
│   │       ├── movement/
│   │       ├── favorite/
│   │       └── activity/
│   ├── shared/
│   │   ├── pagination.go
│   │   ├── errors.go
│   │   └── uuid.go
│   ├── infra/
│   │   ├── postgres/
│   │   └── queries/          # sqlc generated (don't edit)
│   └── api/
│       ├── router.go
│       └── middleware/
├── db/
│   ├── migrations/           # dbmate (copy from existing)
│   └── queries/              # sqlc query files
├── tests/
│   └── integration/
├── sqlc.yaml
├── .air.toml
├── Dockerfile
└── go.mod
```

### 0.3 Configure sqlc

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
        out: "internal/infra/queries"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_empty_slices: true
        emit_pointers_for_null_types: true
        overrides:
          - db_type: "uuid"
            go_type: "github.com/google/uuid.UUID"
          - db_type: "timestamptz"
            go_type: "time.Time"
```

### 0.4 Mise Configuration

Add the following to the root `.mise.toml` to add Go backend tasks (prefix with `go-` to distinguish from Python backend):

**Tools section update:**

```toml
[tools]
python = "3.14"
uv = "latest"
bun = "latest"
dbmate = "latest"
go = "1.23"           # Add Go
sqlc = "latest"       # Add sqlc
```

**Environment variables:**

```toml
[env]
# Existing variables...

# Go backend specific
GO_DATABASE_URL = "postgresql://wh:wh@localhost:5432/warehouse_dev?sslmode=disable"
GO_TEST_DATABASE_URL = "postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable"
```

**Go backend tasks:**

```toml
# Go Backend Tasks
# ================

[tasks.go-dev]
description = "Run Go backend dev server with hot reload"
depends = ["dc-up"]
run = "cd go-backend && air"

[tasks.go-run]
description = "Run Go backend server (no hot reload)"
depends = ["dc-up"]
run = "cd go-backend && go run cmd/server/main.go"

[tasks.go-build]
description = "Build Go backend binary"
run = "cd go-backend && CGO_ENABLED=0 go build -o bin/server cmd/server/main.go"

[tasks.go-test]
description = "Run Go backend tests"
run = "cd go-backend && go test -v ./..."

[tasks.go-test-cover]
description = "Run Go backend tests with coverage"
run = "cd go-backend && go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html"

[tasks.go-test-unit]
description = "Run Go backend unit tests only"
run = "cd go-backend && go test -v ./internal/domain/..."

[tasks.go-test-integration]
description = "Run Go backend integration tests"
depends = ["dc-up"]
run = "cd go-backend && go test -v ./tests/integration/..."

[tasks.go-lint]
description = "Run Go backend linter"
run = "cd go-backend && golangci-lint run"

[tasks.go-fmt]
description = "Format Go backend code"
run = "cd go-backend && go fmt ./..."

[tasks.go-sqlc]
description = "Generate sqlc code from queries"
run = "cd go-backend && sqlc generate"

[tasks.go-sqlc-vet]
description = "Verify sqlc queries are valid"
run = "cd go-backend && sqlc vet"

[tasks.go-generate]
description = "Run migrations and generate sqlc code"
depends = ["migrate", "go-sqlc"]

[tasks.go-migrate]
description = "Run database migrations for Go backend"
depends = ["dc-up"]
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations up"

[tasks.go-migrate-new]
description = "Create new Go backend migration"
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations new"

[tasks.go-migrate-down]
description = "Rollback last Go backend migration"
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations down"

[tasks.go-migrate-status]
description = "Check Go backend migration status"
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations status"

[tasks.go-db-reset]
description = "Reset Go backend database"
depends = ["dc-up"]
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations drop && DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations up"

[tasks.go-mod-tidy]
description = "Tidy Go backend dependencies"
run = "cd go-backend && go mod tidy"

[tasks.go-mod-download]
description = "Download Go backend dependencies"
run = "cd go-backend && go mod download"

# Combined start task (optional - run both backends)
[tasks.start-all]
description = "Start all services (containers, Python backend, Go backend, frontend)"
depends = ["dc-up", "migrate"]
run = "mise run dev & mise run go-dev & mise run fe-dev"
```

### 0.5 Quick Reference: Mise Commands

| Command | Purpose |
|---------|---------|
| `mise run go-dev` | Start Go backend with hot reload |
| `mise run go-run` | Start Go backend (no hot reload) |
| `mise run go-build` | Build production binary |
| `mise run go-test` | Run all tests |
| `mise run go-test-cover` | Run tests with coverage report |
| `mise run go-test-unit` | Run unit tests only |
| `mise run go-lint` | Run linter (golangci-lint) |
| `mise run go-fmt` | Format code |
| `mise run go-sqlc` | Generate sqlc code |
| `mise run go-sqlc-vet` | Verify sqlc queries |
| `mise run go-generate` | Migrate + sqlc generate |
| `mise run go-migrate` | Apply migrations |
| `mise run go-migrate-new` | Create new migration |
| `mise run go-migrate-down` | Rollback last migration |
| `mise run go-db-reset` | Drop and recreate database |
| `mise run go-mod-tidy` | Tidy Go dependencies |

### 0.6 Air Configuration (Hot Reload)

```toml
# go-backend/.air.toml
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/main ./cmd/server"
  bin = "./tmp/main"
  delay = 1000
  exclude_dir = ["tmp", "vendor", "node_modules", "tests"]
  exclude_regex = ["_test.go"]
  include_ext = ["go", "sql"]
  kill_delay = "0s"
  stop_on_error = true

[log]
  time = false

[color]
  main = "magenta"
  watcher = "cyan"
  build = "yellow"
  runner = "green"

[misc]
  clean_on_exit = true
```

---

## Phase 1: Auth Domain

### 1.1 User Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | User entity with fields: id, email, fullName, passwordHash, isActive, isSuperuser, dateFormat, language, theme |
| `errors.go` | ErrEmailRequired, ErrEmailInvalid, ErrEmailTaken, ErrUserNotFound, ErrInvalidPassword |
| `repository.go` | Interface: Save, FindByID, FindByEmail, List, Delete |
| `service.go` | Create, Update, UpdatePassword, UpdatePreferences, Deactivate |
| `service_test.go` | TDD tests for all service methods |
| `handler.go` | HTTP endpoints: Register, Login, GetMe, UpdateMe, UpdatePassword |
| `handler_test.go` | Handler tests |

**Entity:**

```go
// internal/domain/auth/user/entity.go
type User struct {
    id           uuid.UUID
    email        string
    fullName     string
    passwordHash string
    isActive     bool
    isSuperuser  bool
    dateFormat   string
    language     string
    theme        string
    createdAt    time.Time
    updatedAt    time.Time
}
```

**sqlc queries** (`db/queries/users.sql`):

```sql
-- name: GetUserByID :one
SELECT * FROM auth.users WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM auth.users WHERE email = $1;

-- name: CreateUser :one
INSERT INTO auth.users (id, email, full_name, password_hash, date_format, language, theme)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateUser :one
UPDATE auth.users
SET full_name = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE auth.users
SET password_hash = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateUserPreferences :one
UPDATE auth.users
SET date_format = $2, language = $3, theme = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeactivateUser :exec
UPDATE auth.users SET is_active = false, updated_at = now() WHERE id = $1;

-- name: ListUsers :many
SELECT * FROM auth.users
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
```

---

### 1.2 Workspace Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Workspace: id, name, slug, description, isPersonal |
| `errors.go` | ErrSlugTaken, ErrWorkspaceNotFound, ErrCannotDeletePersonal |
| `repository.go` | Save, FindByID, FindBySlug, FindByUserID, Delete |
| `service.go` | Create, Update, Delete, GetUserWorkspaces |
| `service_test.go` | TDD tests |
| `handler.go` | CRUD endpoints |
| `handler_test.go` | Handler tests |

**Entity:**

```go
// internal/domain/auth/workspace/entity.go
type Workspace struct {
    id          uuid.UUID
    name        string
    slug        string
    description *string
    isPersonal  bool
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/workspaces.sql`):

```sql
-- name: GetWorkspaceByID :one
SELECT * FROM auth.workspaces WHERE id = $1;

-- name: GetWorkspaceBySlug :one
SELECT * FROM auth.workspaces WHERE slug = $1;

-- name: CreateWorkspace :one
INSERT INTO auth.workspaces (id, name, slug, description, is_personal)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateWorkspace :one
UPDATE auth.workspaces
SET name = $2, description = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteWorkspace :exec
DELETE FROM auth.workspaces WHERE id = $1;

-- name: ListWorkspacesByUser :many
SELECT w.* FROM auth.workspaces w
JOIN auth.workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = $1
ORDER BY w.name;
```

---

### 1.3 Workspace Member Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Member: id, workspaceID, userID, role (enum: owner/admin/member/viewer), invitedBy |
| `errors.go` | ErrAlreadyMember, ErrCannotRemoveOwner, ErrInsufficientRole |
| `repository.go` | Save, FindByWorkspaceAndUser, ListByWorkspace, Delete |
| `service.go` | AddMember, UpdateRole, RemoveMember, GetRole |
| `service_test.go` | TDD tests with role permission logic |
| `handler.go` | List members, invite, update role, remove |

**Entity:**

```go
// internal/domain/auth/member/entity.go
type Role string

const (
    RoleOwner  Role = "owner"
    RoleAdmin  Role = "admin"
    RoleMember Role = "member"
    RoleViewer Role = "viewer"
)

type Member struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    userID      uuid.UUID
    role        Role
    invitedBy   *uuid.UUID
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/workspace_members.sql`):

```sql
-- name: GetMember :one
SELECT * FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: CreateMember :one
INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, invited_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateMemberRole :one
UPDATE auth.workspace_members
SET role = $3, updated_at = now()
WHERE workspace_id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteMember :exec
DELETE FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: ListMembersByWorkspace :many
SELECT wm.*, u.email, u.full_name
FROM auth.workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
WHERE wm.workspace_id = $1
ORDER BY wm.created_at;

-- name: GetUserRole :one
SELECT role FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: CountWorkspaceOwners :one
SELECT COUNT(*) FROM auth.workspace_members
WHERE workspace_id = $1 AND role = 'owner';
```

---

### 1.4 Notification Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Notification: id, userID, workspaceID, type (enum), title, message, isRead, metadata |
| `repository.go` | Save, FindByUser, MarkAsRead, MarkAllAsRead |
| `service.go` | Create, List, MarkRead, GetUnreadCount |
| `handler.go` | List, Mark as read |

**Entity:**

```go
// internal/domain/auth/notification/entity.go
type NotificationType string

const (
    TypeLoanDueSoon     NotificationType = "LOAN_DUE_SOON"
    TypeLoanOverdue     NotificationType = "LOAN_OVERDUE"
    TypeLoanReturned    NotificationType = "LOAN_RETURNED"
    TypeLowStock        NotificationType = "LOW_STOCK"
    TypeWorkspaceInvite NotificationType = "WORKSPACE_INVITE"
    TypeMemberJoined    NotificationType = "MEMBER_JOINED"
    TypeSystem          NotificationType = "SYSTEM"
)

type Notification struct {
    id               uuid.UUID
    userID           uuid.UUID
    workspaceID      *uuid.UUID
    notificationType NotificationType
    title            string
    message          string
    isRead           bool
    readAt           *time.Time
    metadata         map[string]interface{}
    createdAt        time.Time
}
```

**sqlc queries** (`db/queries/notifications.sql`):

```sql
-- name: GetNotification :one
SELECT * FROM auth.notifications WHERE id = $1 AND user_id = $2;

-- name: CreateNotification :one
INSERT INTO auth.notifications (id, user_id, workspace_id, notification_type, title, message, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListNotificationsByUser :many
SELECT * FROM auth.notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListUnreadNotifications :many
SELECT * FROM auth.notifications
WHERE user_id = $1 AND is_read = false
ORDER BY created_at DESC;

-- name: MarkNotificationAsRead :exec
UPDATE auth.notifications
SET is_read = true, read_at = now()
WHERE id = $1 AND user_id = $2;

-- name: MarkAllNotificationsAsRead :exec
UPDATE auth.notifications
SET is_read = true, read_at = now()
WHERE user_id = $1 AND is_read = false;

-- name: GetUnreadCount :one
SELECT COUNT(*) FROM auth.notifications
WHERE user_id = $1 AND is_read = false;
```

---

## Phase 2: Core Warehouse Domains

### 2.1 Category Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Category: id, workspaceID, name, parentCategoryID, description, isArchived |
| `errors.go` | ErrCategoryNotFound, ErrCyclicParent, ErrHasChildren |
| `repository.go` | Save, FindByID, FindByWorkspace, Delete |
| `service.go` | Create, Update, Archive, Restore, GetTree |
| `service_test.go` | Tests including hierarchical logic |
| `handler.go` | CRUD + tree endpoint |

**Entity:**

```go
// internal/domain/warehouse/category/entity.go
type Category struct {
    id               uuid.UUID
    workspaceID      uuid.UUID
    name             string
    parentCategoryID *uuid.UUID
    description      *string
    isArchived       bool
    createdAt        time.Time
    updatedAt        time.Time
}
```

**sqlc queries** (`db/queries/categories.sql`):

```sql
-- name: GetCategory :one
SELECT * FROM warehouse.categories
WHERE id = $1 AND workspace_id = $2;

-- name: CreateCategory :one
INSERT INTO warehouse.categories (id, workspace_id, name, parent_category_id, description)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateCategory :one
UPDATE warehouse.categories
SET name = $2, parent_category_id = $3, description = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveCategory :exec
UPDATE warehouse.categories
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreCategory :exec
UPDATE warehouse.categories
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListCategories :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name;

-- name: ListCategoriesByParent :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 AND parent_category_id = $2 AND is_archived = false
ORDER BY name;

-- name: ListRootCategories :many
SELECT * FROM warehouse.categories
WHERE workspace_id = $1 AND parent_category_id IS NULL AND is_archived = false
ORDER BY name;

-- name: GetCategoryTree :many
WITH RECURSIVE category_tree AS (
    SELECT id, workspace_id, name, parent_category_id, description, is_archived, 0 as depth
    FROM warehouse.categories
    WHERE workspace_id = $1 AND parent_category_id IS NULL AND is_archived = false

    UNION ALL

    SELECT c.id, c.workspace_id, c.name, c.parent_category_id, c.description, c.is_archived, ct.depth + 1
    FROM warehouse.categories c
    JOIN category_tree ct ON c.parent_category_id = ct.id
    WHERE c.is_archived = false
)
SELECT * FROM category_tree ORDER BY depth, name;

-- name: HasChildren :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.categories
    WHERE parent_category_id = $1 AND is_archived = false
);
```

---

### 2.2 Location Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Location: id, workspaceID, name, parentLocation, zone, shelf, bin, description, shortCode, isArchived |
| `errors.go` | ErrLocationNotFound, ErrShortCodeTaken, ErrCyclicParent, ErrHasContainers |
| `repository.go` | Save, FindByID, FindByShortCode, FindByWorkspace, Search, Delete |
| `service.go` | Create, Update, Archive, Move, GenerateShortCode, Search |
| `service_test.go` | Tests including hierarchy and search |
| `handler.go` | CRUD + tree + search endpoints |

**Entity:**

```go
// internal/domain/warehouse/location/entity.go
type Location struct {
    id             uuid.UUID
    workspaceID    uuid.UUID
    name           string
    parentLocation *uuid.UUID
    zone           *string
    shelf          *string
    bin            *string
    description    *string
    shortCode      *string
    isArchived     bool
    createdAt      time.Time
    updatedAt      time.Time
}
```

**sqlc queries** (`db/queries/locations.sql`):

```sql
-- name: GetLocation :one
SELECT * FROM warehouse.locations
WHERE id = $1 AND workspace_id = $2;

-- name: GetLocationByShortCode :one
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND short_code = $2;

-- name: CreateLocation :one
INSERT INTO warehouse.locations (id, workspace_id, name, parent_location, zone, shelf, bin, description, short_code)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateLocation :one
UPDATE warehouse.locations
SET name = $2, parent_location = $3, zone = $4, shelf = $5, bin = $6, description = $7, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveLocation :exec
UPDATE warehouse.locations
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreLocation :exec
UPDATE warehouse.locations
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListLocations :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: ListLocationsByParent :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND parent_location = $2 AND is_archived = false
ORDER BY name;

-- name: ListRootLocations :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND parent_location IS NULL AND is_archived = false
ORDER BY name;

-- name: SearchLocations :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1
  AND is_archived = false
  AND search_vector @@ plainto_tsquery('english', $2)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
LIMIT $3;

-- name: GetLocationTree :many
WITH RECURSIVE location_tree AS (
    SELECT id, workspace_id, name, parent_location, zone, shelf, bin, short_code, 0 as depth
    FROM warehouse.locations
    WHERE workspace_id = $1 AND parent_location IS NULL AND is_archived = false

    UNION ALL

    SELECT l.id, l.workspace_id, l.name, l.parent_location, l.zone, l.shelf, l.bin, l.short_code, lt.depth + 1
    FROM warehouse.locations l
    JOIN location_tree lt ON l.parent_location = lt.id
    WHERE l.is_archived = false
)
SELECT * FROM location_tree ORDER BY depth, name;

-- name: ShortCodeExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.locations
    WHERE workspace_id = $1 AND short_code = $2
);
```

---

### 2.3 Container Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Container: id, workspaceID, name, locationID, description, capacity, shortCode, isArchived |
| `errors.go` | ErrContainerNotFound, ErrShortCodeTaken, ErrHasInventory |
| `repository.go` | Save, FindByID, FindByLocation, FindByShortCode, Delete |
| `service.go` | Create, Update, Archive, Move, GenerateShortCode |
| `handler.go` | CRUD endpoints |

**Entity:**

```go
// internal/domain/warehouse/container/entity.go
type Container struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    name        string
    locationID  uuid.UUID
    description *string
    capacity    *string
    shortCode   *string
    isArchived  bool
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/containers.sql`):

```sql
-- name: GetContainer :one
SELECT * FROM warehouse.containers
WHERE id = $1 AND workspace_id = $2;

-- name: GetContainerByShortCode :one
SELECT * FROM warehouse.containers
WHERE workspace_id = $1 AND short_code = $2;

-- name: CreateContainer :one
INSERT INTO warehouse.containers (id, workspace_id, name, location_id, description, capacity, short_code)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateContainer :one
UPDATE warehouse.containers
SET name = $2, location_id = $3, description = $4, capacity = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveContainer :exec
UPDATE warehouse.containers
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreContainer :exec
UPDATE warehouse.containers
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListContainersByLocation :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1 AND location_id = $2 AND is_archived = false
ORDER BY name;

-- name: ListContainersByWorkspace :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: SearchContainers :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1
  AND is_archived = false
  AND search_vector @@ plainto_tsquery('english', $2)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
LIMIT $3;

-- name: ContainerShortCodeExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.containers
    WHERE workspace_id = $1 AND short_code = $2
);
```

---

### 2.4 Company Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Company: id, workspaceID, name, website, notes, isArchived |
| `errors.go` | ErrCompanyNotFound, ErrNameTaken |
| `repository.go` | Save, FindByID, FindByName, List, Delete |
| `service.go` | Create, Update, Archive |
| `handler.go` | CRUD endpoints |

**Entity:**

```go
// internal/domain/warehouse/company/entity.go
type Company struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    name        string
    website     *string
    notes       *string
    isArchived  bool
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/companies.sql`):

```sql
-- name: GetCompany :one
SELECT * FROM warehouse.companies
WHERE id = $1 AND workspace_id = $2;

-- name: GetCompanyByName :one
SELECT * FROM warehouse.companies
WHERE workspace_id = $1 AND name = $2;

-- name: CreateCompany :one
INSERT INTO warehouse.companies (id, workspace_id, name, website, notes)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateCompany :one
UPDATE warehouse.companies
SET name = $2, website = $3, notes = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveCompany :exec
UPDATE warehouse.companies
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreCompany :exec
UPDATE warehouse.companies
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListCompanies :many
SELECT * FROM warehouse.companies
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;
```

---

### 2.5 Label Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Label: id, workspaceID, name, color, description, isArchived |
| `errors.go` | ErrLabelNotFound, ErrNameTaken, ErrInvalidColor |
| `repository.go` | Save, FindByID, List, Delete |
| `service.go` | Create, Update, Archive |
| `handler.go` | CRUD endpoints |

**Entity:**

```go
// internal/domain/warehouse/label/entity.go
type Label struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    name        string
    color       string // Hex color code, e.g., "#FF5733"
    description *string
    isArchived  bool
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/labels.sql`):

```sql
-- name: GetLabel :one
SELECT * FROM warehouse.labels
WHERE id = $1 AND workspace_id = $2;

-- name: GetLabelByName :one
SELECT * FROM warehouse.labels
WHERE workspace_id = $1 AND name = $2;

-- name: CreateLabel :one
INSERT INTO warehouse.labels (id, workspace_id, name, color, description)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateLabel :one
UPDATE warehouse.labels
SET name = $2, color = $3, description = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveLabel :exec
UPDATE warehouse.labels
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreLabel :exec
UPDATE warehouse.labels
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListLabels :many
SELECT * FROM warehouse.labels
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name;
```

---

## Phase 3: Item & Inventory Domains

### 3.1 Item Domain (Catalog)

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Item with all fields from schema |
| `errors.go` | ErrItemNotFound, ErrSKUTaken, ErrShortCodeTaken, ErrInvalidMinStock |
| `repository.go` | Save, FindByID, FindBySKU, FindByShortCode, FindByBarcode, Search, List, Delete |
| `service.go` | Create, Update, Archive, AttachLabel, DetachLabel, Search |
| `service_test.go` | Comprehensive tests |
| `handler.go` | CRUD + search + label management |
| `handler_test.go` | Handler tests |

**Entity:**

```go
// internal/domain/warehouse/item/entity.go
type Item struct {
    id                uuid.UUID
    workspaceID       uuid.UUID
    sku               *string
    name              string
    description       *string
    categoryID        *uuid.UUID
    brand             *string
    model             *string
    imageURL          *string
    serialNumber      *string
    manufacturer      *string
    barcode           *string
    isInsured         bool
    isArchived        bool
    lifetimeWarranty  bool
    warrantyDetails   *string
    purchasedFrom     *uuid.UUID
    minStockLevel     int
    shortCode         *string
    obsidianVaultPath *string
    obsidianNotePath  *string
    createdAt         time.Time
    updatedAt         time.Time
}
```

**sqlc queries** (`db/queries/items.sql`):

```sql
-- name: GetItem :one
SELECT * FROM warehouse.items
WHERE id = $1 AND workspace_id = $2;

-- name: GetItemBySKU :one
SELECT * FROM warehouse.items
WHERE workspace_id = $1 AND sku = $2;

-- name: GetItemByShortCode :one
SELECT * FROM warehouse.items
WHERE workspace_id = $1 AND short_code = $2;

-- name: GetItemByBarcode :one
SELECT * FROM warehouse.items
WHERE workspace_id = $1 AND barcode = $2;

-- name: CreateItem :one
INSERT INTO warehouse.items (
    id, workspace_id, sku, name, description, category_id, brand, model,
    image_url, serial_number, manufacturer, barcode, is_insured,
    lifetime_warranty, warranty_details, purchased_from, min_stock_level,
    short_code, obsidian_vault_path, obsidian_note_path
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
RETURNING *;

-- name: UpdateItem :one
UPDATE warehouse.items
SET name = $2, description = $3, category_id = $4, brand = $5, model = $6,
    image_url = $7, serial_number = $8, manufacturer = $9, barcode = $10,
    is_insured = $11, lifetime_warranty = $12, warranty_details = $13,
    purchased_from = $14, min_stock_level = $15, obsidian_vault_path = $16,
    obsidian_note_path = $17, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveItem :exec
UPDATE warehouse.items
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreItem :exec
UPDATE warehouse.items
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListItems :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: ListItemsByCategory :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1 AND category_id = $2 AND is_archived = false
ORDER BY name
LIMIT $3 OFFSET $4;

-- name: SearchItems :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1
  AND is_archived = false
  AND search_vector @@ plainto_tsquery('english', $2)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
LIMIT $3;

-- name: AttachLabel :exec
INSERT INTO warehouse.item_labels (item_id, label_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: DetachLabel :exec
DELETE FROM warehouse.item_labels
WHERE item_id = $1 AND label_id = $2;

-- name: GetItemLabels :many
SELECT l.* FROM warehouse.labels l
JOIN warehouse.item_labels il ON l.id = il.label_id
WHERE il.item_id = $1;

-- name: ItemShortCodeExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.items
    WHERE workspace_id = $1 AND short_code = $2
);

-- name: GetItemWithDetails :one
SELECT i.*, c.name as category_name, co.name as company_name
FROM warehouse.items i
LEFT JOIN warehouse.categories c ON i.category_id = c.id
LEFT JOIN warehouse.companies co ON i.purchased_from = co.id
WHERE i.id = $1 AND i.workspace_id = $2;
```

---

### 3.2 Inventory Domain (Physical Instances)

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Inventory with condition/status enums |
| `errors.go` | ErrInventoryNotFound, ErrInsufficientQuantity, ErrInvalidCondition, ErrInvalidStatus, ErrAlreadyOnLoan |
| `repository.go` | Save, FindByID, FindByItem, FindByLocation, FindByContainer, FindAvailable, Delete |
| `service.go` | Create, Update, UpdateQuantity, UpdateStatus, Move, Archive |
| `service_test.go` | Tests including status transitions, quantity validation |
| `handler.go` | CRUD + status updates + movements |

**Entity:**

```go
// internal/domain/warehouse/inventory/entity.go
type Condition string

const (
    ConditionNew       Condition = "NEW"
    ConditionExcellent Condition = "EXCELLENT"
    ConditionGood      Condition = "GOOD"
    ConditionFair      Condition = "FAIR"
    ConditionPoor      Condition = "POOR"
    ConditionDamaged   Condition = "DAMAGED"
    ConditionForRepair Condition = "FOR_REPAIR"
)

type Status string

const (
    StatusAvailable Status = "AVAILABLE"
    StatusInUse     Status = "IN_USE"
    StatusReserved  Status = "RESERVED"
    StatusOnLoan    Status = "ON_LOAN"
    StatusInTransit Status = "IN_TRANSIT"
    StatusDisposed  Status = "DISPOSED"
    StatusMissing   Status = "MISSING"
)

type Inventory struct {
    id              uuid.UUID
    workspaceID     uuid.UUID
    itemID          uuid.UUID
    locationID      uuid.UUID
    containerID     *uuid.UUID
    quantity        int
    condition       Condition
    status          Status
    dateAcquired    *time.Time
    purchasePrice   *int // cents
    currencyCode    string
    warrantyExpires *time.Time
    expirationDate  *time.Time
    notes           *string
    isArchived      bool
    createdAt       time.Time
    updatedAt       time.Time
}
```

**sqlc queries** (`db/queries/inventory.sql`):

```sql
-- name: GetInventory :one
SELECT * FROM warehouse.inventory
WHERE id = $1 AND workspace_id = $2;

-- name: CreateInventory :one
INSERT INTO warehouse.inventory (
    id, workspace_id, item_id, location_id, container_id, quantity,
    condition, status, date_acquired, purchase_price, currency_code,
    warranty_expires, expiration_date, notes
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: UpdateInventory :one
UPDATE warehouse.inventory
SET location_id = $2, container_id = $3, quantity = $4, condition = $5,
    date_acquired = $6, purchase_price = $7, currency_code = $8,
    warranty_expires = $9, expiration_date = $10, notes = $11, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateInventoryStatus :one
UPDATE warehouse.inventory
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateInventoryQuantity :one
UPDATE warehouse.inventory
SET quantity = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: MoveInventory :one
UPDATE warehouse.inventory
SET location_id = $2, container_id = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveInventory :exec
UPDATE warehouse.inventory
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreInventory :exec
UPDATE warehouse.inventory
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListInventoryByItem :many
SELECT * FROM warehouse.inventory
WHERE workspace_id = $1 AND item_id = $2 AND is_archived = false
ORDER BY created_at DESC;

-- name: ListInventoryByLocation :many
SELECT * FROM warehouse.inventory
WHERE workspace_id = $1 AND location_id = $2 AND is_archived = false
ORDER BY created_at DESC;

-- name: ListInventoryByContainer :many
SELECT * FROM warehouse.inventory
WHERE workspace_id = $1 AND container_id = $2 AND is_archived = false
ORDER BY created_at DESC;

-- name: GetAvailableInventory :many
SELECT * FROM warehouse.inventory
WHERE workspace_id = $1 AND item_id = $2 AND status = 'AVAILABLE' AND is_archived = false;

-- name: GetInventoryWithDetails :one
SELECT i.*, it.name as item_name, it.sku, l.name as location_name, c.name as container_name
FROM warehouse.inventory i
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.locations l ON i.location_id = l.id
LEFT JOIN warehouse.containers c ON i.container_id = c.id
WHERE i.id = $1 AND i.workspace_id = $2;

-- name: ListInventoryWithDetails :many
SELECT i.*, it.name as item_name, it.sku, l.name as location_name, c.name as container_name
FROM warehouse.inventory i
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.locations l ON i.location_id = l.id
LEFT JOIN warehouse.containers c ON i.container_id = c.id
WHERE i.workspace_id = $1 AND i.is_archived = false
ORDER BY it.name
LIMIT $2 OFFSET $3;

-- name: GetTotalQuantityByItem :one
SELECT COALESCE(SUM(quantity), 0)::int as total
FROM warehouse.inventory
WHERE workspace_id = $1 AND item_id = $2 AND is_archived = false;

-- name: GetLowStockItems :many
SELECT i.id, i.name, i.min_stock_level, COALESCE(SUM(inv.quantity), 0)::int as current_stock
FROM warehouse.items i
LEFT JOIN warehouse.inventory inv ON i.id = inv.item_id AND inv.is_archived = false
WHERE i.workspace_id = $1 AND i.is_archived = false AND i.min_stock_level > 0
GROUP BY i.id, i.name, i.min_stock_level
HAVING COALESCE(SUM(inv.quantity), 0) < i.min_stock_level;
```

---

## Phase 4: Loan Domain

### 4.1 Borrower Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Borrower: id, workspaceID, name, email, phone, notes, isArchived |
| `errors.go` | ErrBorrowerNotFound, ErrHasActiveLoans |
| `repository.go` | Save, FindByID, List, Delete |
| `service.go` | Create, Update, Archive |
| `handler.go` | CRUD endpoints |

**Entity:**

```go
// internal/domain/warehouse/borrower/entity.go
type Borrower struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    name        string
    email       *string
    phone       *string
    notes       *string
    isArchived  bool
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/borrowers.sql`):

```sql
-- name: GetBorrower :one
SELECT * FROM warehouse.borrowers
WHERE id = $1 AND workspace_id = $2;

-- name: CreateBorrower :one
INSERT INTO warehouse.borrowers (id, workspace_id, name, email, phone, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateBorrower :one
UPDATE warehouse.borrowers
SET name = $2, email = $3, phone = $4, notes = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveBorrower :exec
UPDATE warehouse.borrowers
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreBorrower :exec
UPDATE warehouse.borrowers
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListBorrowers :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: HasActiveLoans :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.loans
    WHERE borrower_id = $1 AND returned_at IS NULL
);
```

---

### 4.2 Loan Domain (Aggregate Root)

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Loan entity |
| `aggregate.go` | LoanAggregate: encapsulates loan + inventory + borrower for complex operations |
| `errors.go` | ErrLoanNotFound, ErrAlreadyReturned, ErrQuantityExceedsAvailable, ErrInventoryOnLoan |
| `repository.go` | Save, FindByID, FindActiveByBorrower, FindActiveByInventory, FindOverdue, Delete |
| `service.go` | CreateLoan (with inventory validation), ReturnLoan (updates inventory status), ExtendDueDate, GetOverdueLoans |
| `service_test.go` | Critical tests: quantity validation, status updates, concurrent loans |
| `handler.go` | Create, Return, Extend, List endpoints |

**Entity:**

```go
// internal/domain/warehouse/loan/entity.go
type Loan struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    inventoryID uuid.UUID
    borrowerID  uuid.UUID
    quantity    int
    loanedAt    time.Time
    dueDate     *time.Time
    returnedAt  *time.Time
    notes       *string
    createdAt   time.Time
    updatedAt   time.Time
}

func (l *Loan) IsActive() bool {
    return l.returnedAt == nil
}

func (l *Loan) IsOverdue() bool {
    if l.returnedAt != nil || l.dueDate == nil {
        return false
    }
    return time.Now().After(*l.dueDate)
}
```

**Aggregate:**

```go
// internal/domain/warehouse/loan/aggregate.go
type LoanAggregate struct {
    Loan      *Loan
    Inventory *inventory.Inventory
    Borrower  *borrower.Borrower
}

func (a *LoanAggregate) CanLoan(requestedQty int) error {
    if a.Inventory.Status() != inventory.StatusAvailable {
        return ErrInventoryNotAvailable
    }
    if requestedQty > a.Inventory.Quantity() {
        return ErrQuantityExceedsAvailable
    }
    return nil
}

func (a *LoanAggregate) Return() error {
    if a.Loan.returnedAt != nil {
        return ErrAlreadyReturned
    }
    now := time.Now()
    a.Loan.returnedAt = &now
    return nil
}
```

**sqlc queries** (`db/queries/loans.sql`):

```sql
-- name: GetLoan :one
SELECT * FROM warehouse.loans
WHERE id = $1 AND workspace_id = $2;

-- name: CreateLoan :one
INSERT INTO warehouse.loans (id, workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ReturnLoan :one
UPDATE warehouse.loans
SET returned_at = now(), updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ExtendLoanDueDate :one
UPDATE warehouse.loans
SET due_date = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListLoansByWorkspace :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1
ORDER BY loaned_at DESC
LIMIT $2 OFFSET $3;

-- name: ListLoansByBorrower :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND borrower_id = $2
ORDER BY loaned_at DESC
LIMIT $3 OFFSET $4;

-- name: ListLoansByInventory :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND inventory_id = $2
ORDER BY loaned_at DESC;

-- name: ListActiveLoans :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND returned_at IS NULL
ORDER BY due_date ASC NULLS LAST;

-- name: ListOverdueLoans :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND returned_at IS NULL AND due_date < now()
ORDER BY due_date ASC;

-- name: GetActiveLoanForInventory :one
SELECT * FROM warehouse.loans
WHERE inventory_id = $1 AND returned_at IS NULL;

-- name: GetLoanWithDetails :one
SELECT l.*,
       i.quantity as inventory_quantity, i.status as inventory_status,
       it.name as item_name, it.sku,
       b.name as borrower_name, b.email as borrower_email
FROM warehouse.loans l
JOIN warehouse.inventory i ON l.inventory_id = i.id
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.borrowers b ON l.borrower_id = b.id
WHERE l.id = $1 AND l.workspace_id = $2;

-- name: ListActiveLoansWithDetails :many
SELECT l.*,
       i.quantity as inventory_quantity,
       it.name as item_name, it.sku,
       b.name as borrower_name, b.email as borrower_email,
       loc.name as location_name
FROM warehouse.loans l
JOIN warehouse.inventory i ON l.inventory_id = i.id
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.borrowers b ON l.borrower_id = b.id
JOIN warehouse.locations loc ON i.location_id = loc.id
WHERE l.workspace_id = $1 AND l.returned_at IS NULL
ORDER BY l.due_date ASC NULLS LAST
LIMIT $2 OFFSET $3;

-- name: GetTotalLoanedQuantity :one
SELECT COALESCE(SUM(quantity), 0)::int as total
FROM warehouse.loans
WHERE inventory_id = $1 AND returned_at IS NULL;
```

---

## Phase 5: Supporting Domains

### 5.1 Attachment Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | File + Attachment entities |
| `service.go` | Upload, Attach to item, Delete |
| `handler.go` | Upload, List, Delete endpoints |

**Entities:**

```go
// internal/domain/warehouse/attachment/entity.go
type AttachmentType string

const (
    TypePhoto    AttachmentType = "PHOTO"
    TypeManual   AttachmentType = "MANUAL"
    TypeReceipt  AttachmentType = "RECEIPT"
    TypeWarranty AttachmentType = "WARRANTY"
    TypeOther    AttachmentType = "OTHER"
)

type File struct {
    id           uuid.UUID
    workspaceID  uuid.UUID
    originalName string
    extension    string
    mimeType     string
    sizeBytes    int64
    checksum     string
    storageKey   string
    uploadedBy   *uuid.UUID
    createdAt    time.Time
    updatedAt    time.Time
}

type Attachment struct {
    id              uuid.UUID
    itemID          uuid.UUID
    fileID          *uuid.UUID
    attachmentType  AttachmentType
    title           *string
    isPrimary       bool
    docspellItemID  *string
    createdAt       time.Time
    updatedAt       time.Time
}
```

**sqlc queries** (`db/queries/attachments.sql`):

```sql
-- name: CreateFile :one
INSERT INTO warehouse.files (id, workspace_id, original_name, extension, mime_type, size_bytes, checksum, storage_key, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetFile :one
SELECT * FROM warehouse.files WHERE id = $1;

-- name: DeleteFile :exec
DELETE FROM warehouse.files WHERE id = $1;

-- name: CreateAttachment :one
INSERT INTO warehouse.attachments (id, item_id, file_id, attachment_type, title, is_primary, docspell_item_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetAttachment :one
SELECT * FROM warehouse.attachments WHERE id = $1;

-- name: ListAttachmentsByItem :many
SELECT a.*, f.original_name, f.mime_type, f.size_bytes
FROM warehouse.attachments a
LEFT JOIN warehouse.files f ON a.file_id = f.id
WHERE a.item_id = $1
ORDER BY a.is_primary DESC, a.created_at;

-- name: DeleteAttachment :exec
DELETE FROM warehouse.attachments WHERE id = $1;

-- name: SetPrimaryAttachment :exec
UPDATE warehouse.attachments
SET is_primary = (id = $2)
WHERE item_id = $1;
```

---

### 5.2 Movement Domain (Audit Trail)

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | InventoryMovement |
| `repository.go` | Save, FindByInventory, FindByLocation |
| `service.go` | RecordMovement (called by Inventory.Move), GetHistory |
| `handler.go` | List movement history |

**Entity:**

```go
// internal/domain/warehouse/movement/entity.go
type InventoryMovement struct {
    id              uuid.UUID
    workspaceID     uuid.UUID
    inventoryID     uuid.UUID
    fromLocationID  *uuid.UUID
    fromContainerID *uuid.UUID
    toLocationID    *uuid.UUID
    toContainerID   *uuid.UUID
    quantity        int
    movedBy         *uuid.UUID
    reason          *string
    createdAt       time.Time
}
```

**sqlc queries** (`db/queries/movements.sql`):

```sql
-- name: CreateMovement :one
INSERT INTO warehouse.inventory_movements (
    id, workspace_id, inventory_id, from_location_id, from_container_id,
    to_location_id, to_container_id, quantity, moved_by, reason
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: ListMovementsByInventory :many
SELECT m.*,
       fl.name as from_location_name, fc.name as from_container_name,
       tl.name as to_location_name, tc.name as to_container_name,
       u.full_name as moved_by_name
FROM warehouse.inventory_movements m
LEFT JOIN warehouse.locations fl ON m.from_location_id = fl.id
LEFT JOIN warehouse.containers fc ON m.from_container_id = fc.id
LEFT JOIN warehouse.locations tl ON m.to_location_id = tl.id
LEFT JOIN warehouse.containers tc ON m.to_container_id = tc.id
LEFT JOIN auth.users u ON m.moved_by = u.id
WHERE m.inventory_id = $1
ORDER BY m.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListMovementsByWorkspace :many
SELECT m.*, i.name as item_name
FROM warehouse.inventory_movements m
JOIN warehouse.inventory inv ON m.inventory_id = inv.id
JOIN warehouse.items i ON inv.item_id = i.id
WHERE m.workspace_id = $1
ORDER BY m.created_at DESC
LIMIT $2 OFFSET $3;
```

---

### 5.3 Favorite Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Favorite with type enum |
| `service.go` | Add, Remove, List |
| `handler.go` | Toggle favorite, List favorites |

**Entity:**

```go
// internal/domain/warehouse/favorite/entity.go
type FavoriteType string

const (
    TypeItem      FavoriteType = "ITEM"
    TypeLocation  FavoriteType = "LOCATION"
    TypeContainer FavoriteType = "CONTAINER"
)

type Favorite struct {
    id           uuid.UUID
    userID       uuid.UUID
    workspaceID  uuid.UUID
    favoriteType FavoriteType
    itemID       *uuid.UUID
    locationID   *uuid.UUID
    containerID  *uuid.UUID
    createdAt    time.Time
}
```

**sqlc queries** (`db/queries/favorites.sql`):

```sql
-- name: CreateFavorite :one
INSERT INTO warehouse.favorites (id, user_id, workspace_id, favorite_type, item_id, location_id, container_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: DeleteFavorite :exec
DELETE FROM warehouse.favorites WHERE id = $1 AND user_id = $2;

-- name: DeleteFavoriteByTarget :exec
DELETE FROM warehouse.favorites
WHERE user_id = $1 AND workspace_id = $2
  AND ((favorite_type = 'ITEM' AND item_id = $3)
    OR (favorite_type = 'LOCATION' AND location_id = $3)
    OR (favorite_type = 'CONTAINER' AND container_id = $3));

-- name: ListFavoritesByUser :many
SELECT * FROM warehouse.favorites
WHERE user_id = $1 AND workspace_id = $2
ORDER BY created_at DESC;

-- name: GetFavoriteItems :many
SELECT f.id as favorite_id, f.created_at as favorited_at, i.*
FROM warehouse.favorites f
JOIN warehouse.items i ON f.item_id = i.id
WHERE f.user_id = $1 AND f.workspace_id = $2 AND f.favorite_type = 'ITEM'
ORDER BY f.created_at DESC;

-- name: IsFavorite :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.favorites
    WHERE user_id = $1 AND workspace_id = $2 AND favorite_type = $3
      AND ((favorite_type = 'ITEM' AND item_id = $4)
        OR (favorite_type = 'LOCATION' AND location_id = $4)
        OR (favorite_type = 'CONTAINER' AND container_id = $4))
);
```

---

### 5.4 Activity Log Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | ActivityLog with action/entity enums |
| `repository.go` | Save, FindByWorkspace, FindByEntity |
| `service.go` | Log (called by other services on mutations), List |
| `handler.go` | List activity feed |

**Entity:**

```go
// internal/domain/warehouse/activity/entity.go
type Action string

const (
    ActionCreate Action = "CREATE"
    ActionUpdate Action = "UPDATE"
    ActionDelete Action = "DELETE"
    ActionMove   Action = "MOVE"
    ActionLoan   Action = "LOAN"
    ActionReturn Action = "RETURN"
)

type EntityType string

const (
    EntityItem      EntityType = "ITEM"
    EntityInventory EntityType = "INVENTORY"
    EntityLocation  EntityType = "LOCATION"
    EntityContainer EntityType = "CONTAINER"
    EntityCategory  EntityType = "CATEGORY"
    EntityLabel     EntityType = "LABEL"
    EntityLoan      EntityType = "LOAN"
    EntityBorrower  EntityType = "BORROWER"
)

type ActivityLog struct {
    id         uuid.UUID
    workspaceID uuid.UUID
    userID     *uuid.UUID
    action     Action
    entityType EntityType
    entityID   uuid.UUID
    entityName string
    changes    map[string]interface{} // {"field": {"old": "value", "new": "value"}}
    metadata   map[string]interface{}
    createdAt  time.Time
}
```

**sqlc queries** (`db/queries/activity.sql`):

```sql
-- name: CreateActivityLog :one
INSERT INTO warehouse.activity_log (id, workspace_id, user_id, action, entity_type, entity_id, entity_name, changes, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListActivityByWorkspace :many
SELECT a.*, u.full_name as user_name
FROM warehouse.activity_log a
LEFT JOIN auth.users u ON a.user_id = u.id
WHERE a.workspace_id = $1
ORDER BY a.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListActivityByEntity :many
SELECT a.*, u.full_name as user_name
FROM warehouse.activity_log a
LEFT JOIN auth.users u ON a.user_id = u.id
WHERE a.workspace_id = $1 AND a.entity_type = $2 AND a.entity_id = $3
ORDER BY a.created_at DESC
LIMIT $4 OFFSET $5;

-- name: ListActivityByUser :many
SELECT a.*
FROM warehouse.activity_log a
WHERE a.workspace_id = $1 AND a.user_id = $2
ORDER BY a.created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListRecentActivity :many
SELECT a.*, u.full_name as user_name
FROM warehouse.activity_log a
LEFT JOIN auth.users u ON a.user_id = u.id
WHERE a.workspace_id = $1 AND a.created_at > $2
ORDER BY a.created_at DESC;
```

---

### 5.5 Deleted Records Domain (PWA Sync)

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | DeletedRecord |
| `repository.go` | Save, FindSince |
| `service.go` | Record deletion, GetDeletedSince |
| `handler.go` | Sync endpoint for PWA |

**Entity:**

```go
// internal/domain/warehouse/deleted/entity.go
type DeletedRecord struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    entityType  activity.EntityType
    entityID    uuid.UUID
    deletedAt   time.Time
    deletedBy   *uuid.UUID
}
```

**sqlc queries** (`db/queries/deleted_records.sql`):

```sql
-- name: CreateDeletedRecord :one
INSERT INTO warehouse.deleted_records (id, workspace_id, entity_type, entity_id, deleted_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListDeletedSince :many
SELECT * FROM warehouse.deleted_records
WHERE workspace_id = $1 AND deleted_at > $2
ORDER BY deleted_at ASC;

-- name: CleanupOldDeletedRecords :exec
DELETE FROM warehouse.deleted_records
WHERE deleted_at < $1;
```

---

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

## Phase 7: Implementation Order

Execute in this order, writing tests first for each (TDD):

| Order | Domain | Rationale |
|-------|--------|-----------|
| 1 | Shared utilities | uuid, pagination, errors - foundation |
| 2 | User | Authentication foundation |
| 3 | Workspace | Multi-tenancy foundation |
| 4 | Workspace Member | RBAC, depends on User + Workspace |
| 5 | Notification | Standalone, references User |
| 6 | Category | Hierarchical, simpler than Location |
| 7 | Location | Hierarchical + search |
| 8 | Container | Depends on Location |
| 9 | Company | Simple CRUD |
| 10 | Label | Simple CRUD |
| 11 | Item | Core catalog, depends on Category, Company, Labels |
| 12 | Inventory | Depends on Item, Location, Container |
| 13 | Borrower | Simple CRUD |
| 14 | Loan | Complex, depends on Inventory, Borrower |
| 15 | Movement | Audit trail, depends on Inventory |
| 16 | Activity Log | Cross-cutting |
| 17 | Favorite | User preferences |
| 18 | Attachment | File handling |
| 19 | Deleted Records | PWA sync support |

---

## Phase 8: Testing Strategy

### Test Levels

| Level | What | Coverage Target | Tools |
|-------|------|-----------------|-------|
| **Unit** | Entity invariants, Service logic | 90%+ | testify, mock repos |
| **Integration** | Repository + Database | 80%+ | testcontainers, real DB |
| **E2E** | Full HTTP flow | Key paths | httptest, test DB |

### Test Database Setup

```go
// tests/testdb/testdb.go
package testdb

import (
    "context"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
)

func SetupTestDB(t *testing.T) *pgxpool.Pool {
    t.Helper()

    ctx := context.Background()

    // Use test database URL
    pool, err := pgxpool.New(ctx, os.Getenv("TEST_DATABASE_URL"))
    if err != nil {
        t.Fatalf("failed to connect to test database: %v", err)
    }

    // Run migrations
    // ...

    t.Cleanup(func() {
        // Truncate all tables
        pool.Exec(ctx, `
            TRUNCATE warehouse.activity_log, warehouse.loans, warehouse.inventory,
            warehouse.items, warehouse.containers, warehouse.locations,
            warehouse.categories, warehouse.borrowers, warehouse.companies,
            warehouse.labels, auth.workspace_members, auth.workspaces, auth.users
            CASCADE
        `)
        pool.Close()
    })

    return pool
}
```

### Test Pyramid

```
        /\
       /  \      E2E Tests (few - critical paths)
      /----\
     /      \    Integration Tests (some - repository layer)
    /--------\
   /          \  Unit Tests (many - domain logic)
  --------------
```

### Example Unit Test (TDD)

```go
// internal/domain/warehouse/loan/service_test.go
func TestCreateLoan_Success(t *testing.T) {
    // Arrange
    inventoryRepo := newMockInventoryRepo()
    borrowerRepo := newMockBorrowerRepo()
    loanRepo := newMockLoanRepo()
    svc := loan.NewService(loanRepo, inventoryRepo, borrowerRepo)

    workspaceID := uuid.New()
    inventory := createTestInventory(workspaceID, 5, inventory.StatusAvailable)
    borrower := createTestBorrower(workspaceID)

    inventoryRepo.items[inventory.ID()] = inventory
    borrowerRepo.items[borrower.ID()] = borrower

    // Act
    created, err := svc.CreateLoan(context.Background(), loan.CreateLoanCommand{
        WorkspaceID: workspaceID,
        InventoryID: inventory.ID(),
        BorrowerID:  borrower.ID(),
        Quantity:    2,
    })

    // Assert
    require.NoError(t, err)
    assert.Equal(t, 2, created.Quantity())
    assert.True(t, created.IsActive())
}

func TestCreateLoan_ExceedsQuantity_Fails(t *testing.T) {
    // Arrange
    inventoryRepo := newMockInventoryRepo()
    borrowerRepo := newMockBorrowerRepo()
    loanRepo := newMockLoanRepo()
    svc := loan.NewService(loanRepo, inventoryRepo, borrowerRepo)

    workspaceID := uuid.New()
    inventory := createTestInventory(workspaceID, 5, inventory.StatusAvailable)
    borrower := createTestBorrower(workspaceID)

    inventoryRepo.items[inventory.ID()] = inventory
    borrowerRepo.items[borrower.ID()] = borrower

    // Act
    _, err := svc.CreateLoan(context.Background(), loan.CreateLoanCommand{
        WorkspaceID: workspaceID,
        InventoryID: inventory.ID(),
        BorrowerID:  borrower.ID(),
        Quantity:    10, // Exceeds available quantity of 5
    })

    // Assert
    assert.ErrorIs(t, err, loan.ErrQuantityExceedsAvailable)
}
```

---

## Summary

This plan provides a complete roadmap for implementing the Go backend:

- **19 domains** organized following DDD principles
- **~75+ sqlc queries** covering all database operations
- **3-layer testing strategy** (unit → integration → E2E)
- **Clear implementation order** respecting domain dependencies

### Key Architectural Decisions

1. **Loan as Aggregate Root** - Encapsulates inventory validation logic
2. **Activity Log as Cross-Cutting** - Called by other services on mutations
3. **Deleted Records** - Enables PWA offline sync via tombstone pattern
4. **Multi-Tenant Isolation** - All warehouse domains enforce `workspace_id`
5. **Repository Interface in Domain** - Implementations in infra layer for testability
