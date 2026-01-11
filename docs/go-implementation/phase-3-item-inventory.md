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

