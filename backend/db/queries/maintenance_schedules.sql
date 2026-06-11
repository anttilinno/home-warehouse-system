-- name: GetMaintenanceSchedule :one
SELECT * FROM warehouse.maintenance_schedules
WHERE id = $1 AND workspace_id = $2;

-- name: CreateMaintenanceSchedule :one
INSERT INTO warehouse.maintenance_schedules (
    id, workspace_id, inventory_id, title, notes, interval_days, next_due, is_active
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateMaintenanceSchedule :one
-- Full-row update used by the repository Save path. last_completed_at and
-- next_due are included so completions (which advance next_due and stamp
-- last_completed_at via the domain entity) persist through the same query.
UPDATE warehouse.maintenance_schedules
SET title = $3,
    notes = $4,
    interval_days = $5,
    next_due = $6,
    last_completed_at = $7,
    is_active = $8,
    updated_at = now()
WHERE id = $1 AND workspace_id = $2
RETURNING *;

-- name: DeleteMaintenanceSchedule :exec
DELETE FROM warehouse.maintenance_schedules
WHERE id = $1 AND workspace_id = $2;

-- name: ListMaintenanceSchedulesByWorkspace :many
SELECT * FROM warehouse.maintenance_schedules
WHERE workspace_id = $1
ORDER BY next_due, id
LIMIT $2 OFFSET $3;

-- name: CountMaintenanceSchedulesByWorkspace :one
SELECT COUNT(*) FROM warehouse.maintenance_schedules
WHERE workspace_id = $1;

-- name: ListMaintenanceSchedulesByInventory :many
SELECT * FROM warehouse.maintenance_schedules
WHERE workspace_id = $1 AND inventory_id = $2
ORDER BY next_due, id;

-- name: ListMaintenanceSchedulesDue :many
-- Active schedules due on or before the cutoff date (includes overdue),
-- decorated with the item name for reminder/widget display. Uses the
-- (workspace_id, next_due) index.
SELECT ms.*, it.name AS item_name, inv.item_id
FROM warehouse.maintenance_schedules ms
JOIN warehouse.inventory inv ON ms.inventory_id = inv.id AND inv.workspace_id = ms.workspace_id
JOIN warehouse.items it ON inv.item_id = it.id AND it.workspace_id = inv.workspace_id
WHERE ms.workspace_id = $1
  AND ms.is_active = true
  AND ms.next_due <= $2
ORDER BY ms.next_due, ms.id;
