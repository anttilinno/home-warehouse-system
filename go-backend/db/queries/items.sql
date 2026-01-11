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

-- name: ItemSKUExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.items
    WHERE workspace_id = $1 AND sku = $2
);

-- name: GetItemWithDetails :one
SELECT i.*, c.name as category_name, co.name as company_name
FROM warehouse.items i
LEFT JOIN warehouse.categories c ON i.category_id = c.id
LEFT JOIN warehouse.companies co ON i.purchased_from = co.id
WHERE i.id = $1 AND i.workspace_id = $2;
