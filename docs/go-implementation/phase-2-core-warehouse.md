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

