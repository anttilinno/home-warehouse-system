-- name: GetMovement :one
SELECT * FROM warehouse.inventory_movements WHERE id = $1 AND workspace_id = $2;

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
SELECT m.*, it.name as item_name
FROM warehouse.inventory_movements m
JOIN warehouse.inventory inv ON m.inventory_id = inv.id
JOIN warehouse.items it ON inv.item_id = it.id
WHERE m.workspace_id = $1
ORDER BY m.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListMovementsByLocation :many
SELECT * FROM warehouse.inventory_movements
WHERE workspace_id = $1 AND (from_location_id = $2 OR to_location_id = $2)
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;
