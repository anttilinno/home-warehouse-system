-- name: GetRepairLog :one
SELECT * FROM warehouse.repair_logs
WHERE id = $1 AND workspace_id = $2;

-- name: CreateRepairLog :one
INSERT INTO warehouse.repair_logs (
    id, workspace_id, inventory_id, status, description,
    repair_date, cost, currency_code, service_provider, notes
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: UpdateRepairLog :one
UPDATE warehouse.repair_logs
SET
    description = $2,
    repair_date = $3,
    cost = $4,
    currency_code = $5,
    service_provider = $6,
    notes = $7,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateRepairLogStatus :one
UPDATE warehouse.repair_logs
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CompleteRepairLog :one
UPDATE warehouse.repair_logs
SET
    status = 'COMPLETED',
    completed_at = now(),
    new_condition = $2,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteRepairLog :exec
DELETE FROM warehouse.repair_logs
WHERE id = $1;

-- name: ListRepairLogsByInventory :many
SELECT * FROM warehouse.repair_logs
WHERE workspace_id = $1 AND inventory_id = $2
ORDER BY created_at DESC;

-- name: ListRepairLogsByWorkspace :many
SELECT * FROM warehouse.repair_logs
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListRepairLogsByStatus :many
SELECT * FROM warehouse.repair_logs
WHERE workspace_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountRepairLogsByInventory :one
SELECT COUNT(*)::int FROM warehouse.repair_logs
WHERE workspace_id = $1 AND inventory_id = $2;
