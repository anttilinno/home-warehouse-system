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

