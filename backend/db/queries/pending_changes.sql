-- name: CreatePendingChange :one
INSERT INTO warehouse.pending_changes (
    id,
    workspace_id,
    requester_id,
    entity_type,
    entity_id,
    action,
    payload,
    status
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetPendingChangeByID :one
SELECT * FROM warehouse.pending_changes
WHERE id = $1;

-- name: ListPendingChangesByWorkspace :many
SELECT * FROM warehouse.pending_changes
WHERE workspace_id = $1
  AND (sqlc.narg('status')::warehouse.pending_change_status_enum IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC;

-- name: ListPendingChangesByRequester :many
SELECT * FROM warehouse.pending_changes
WHERE requester_id = $1
  AND (sqlc.narg('status')::warehouse.pending_change_status_enum IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC;

-- name: ListPendingChangesByEntity :many
SELECT * FROM warehouse.pending_changes
WHERE entity_type = $1 AND entity_id = $2
ORDER BY created_at DESC;

-- name: UpdatePendingChangeStatus :one
UPDATE warehouse.pending_changes
SET
    status = $2,
    reviewed_by = $3,
    reviewed_at = $4,
    rejection_reason = $5,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeletePendingChange :exec
DELETE FROM warehouse.pending_changes
WHERE id = $1;

-- name: CountPendingChangesByWorkspace :one
SELECT COUNT(*) FROM warehouse.pending_changes
WHERE workspace_id = $1 AND status = 'pending';
