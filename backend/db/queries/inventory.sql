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
WHERE id = $1 AND workspace_id = $12
RETURNING *;

-- name: UpdateInventoryStatus :one
UPDATE warehouse.inventory
SET status = $2, updated_at = now()
WHERE id = $1 AND workspace_id = $3
RETURNING *;

-- name: UpdateInventoryQuantity :one
UPDATE warehouse.inventory
SET quantity = $2, updated_at = now()
WHERE id = $1 AND workspace_id = $3
RETURNING *;

-- name: MoveInventory :one
UPDATE warehouse.inventory
SET location_id = $2, container_id = $3, updated_at = now()
WHERE id = $1 AND workspace_id = $4
RETURNING *;

-- name: ArchiveInventory :exec
UPDATE warehouse.inventory
SET is_archived = true, updated_at = now()
WHERE id = $1 AND workspace_id = $2;

-- name: RestoreInventory :exec
UPDATE warehouse.inventory
SET is_archived = false, updated_at = now()
WHERE id = $1 AND workspace_id = $2;

-- name: ListInventory :many
SELECT * FROM warehouse.inventory
WHERE workspace_id = $1 AND is_archived = false
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountInventory :one
SELECT COUNT(*) FROM warehouse.inventory
WHERE workspace_id = $1 AND is_archived = false;

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

-- name: GetOutOfStockItems :many
-- Returns items that are completely out of stock (total quantity = 0)
-- These are consumables that need restocking
SELECT i.id, i.name, i.sku, i.min_stock_level, c.id as category_id, c.name as category_name
FROM warehouse.items i
LEFT JOIN warehouse.inventory inv ON i.id = inv.item_id AND inv.is_archived = false
LEFT JOIN warehouse.categories c ON i.category_id = c.id
WHERE i.workspace_id = $1 AND i.is_archived = false
GROUP BY i.id, i.name, i.sku, i.min_stock_level, c.id, c.name
HAVING COALESCE(SUM(inv.quantity), 0) = 0;

-- name: ListInventoryExpiringSoon :many
-- Inventory rows whose expiration_date falls between today and the cutoff
-- date (today + window). Used by the expiry reminder job and the
-- /inventory/expiring endpoint. Workspace-scoped; archived rows excluded.
SELECT inv.id, inv.workspace_id, inv.item_id, inv.quantity,
       inv.expiration_date, it.name AS item_name
FROM warehouse.inventory inv
JOIN warehouse.items it ON inv.item_id = it.id AND it.workspace_id = inv.workspace_id
WHERE inv.workspace_id = $1
  AND inv.is_archived = false
  AND inv.expiration_date IS NOT NULL
  AND inv.expiration_date >= CURRENT_DATE
  AND inv.expiration_date <= $2
ORDER BY inv.expiration_date, inv.id;

-- name: ListWarrantiesExpiringSoon :many
-- Inventory rows whose warranty_expires falls between today and the cutoff
-- date (today + window). Items flagged lifetime_warranty never expire and are
-- skipped. Workspace-scoped; archived rows excluded.
SELECT inv.id, inv.workspace_id, inv.item_id, inv.quantity,
       inv.warranty_expires, it.name AS item_name
FROM warehouse.inventory inv
JOIN warehouse.items it ON inv.item_id = it.id AND it.workspace_id = inv.workspace_id
WHERE inv.workspace_id = $1
  AND inv.is_archived = false
  AND inv.warranty_expires IS NOT NULL
  AND inv.warranty_expires >= CURRENT_DATE
  AND inv.warranty_expires <= $2
  AND COALESCE(it.lifetime_warranty, false) = false
ORDER BY inv.warranty_expires, inv.id;
