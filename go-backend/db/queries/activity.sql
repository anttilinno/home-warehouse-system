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

-- name: CleanupOldActivity :exec
DELETE FROM warehouse.activity_log
WHERE created_at < $1;
