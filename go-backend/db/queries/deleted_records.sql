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
