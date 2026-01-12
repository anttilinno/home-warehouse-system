-- name: GetLabel :one
SELECT * FROM warehouse.labels
WHERE id = $1 AND workspace_id = $2;

-- name: GetLabelByName :one
SELECT * FROM warehouse.labels
WHERE workspace_id = $1 AND name = $2;

-- name: CreateLabel :one
INSERT INTO warehouse.labels (id, workspace_id, name, color, description)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateLabel :one
UPDATE warehouse.labels
SET name = $2, color = $3, description = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveLabel :exec
UPDATE warehouse.labels
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreLabel :exec
UPDATE warehouse.labels
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListLabels :many
SELECT * FROM warehouse.labels
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name;

-- name: LabelNameExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.labels
    WHERE workspace_id = $1 AND name = $2 AND is_archived = false
);

-- name: DeleteLabel :exec
DELETE FROM warehouse.labels WHERE id = $1;
