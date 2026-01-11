-- name: GetContainer :one
SELECT * FROM warehouse.containers
WHERE id = $1 AND workspace_id = $2;

-- name: GetContainerByShortCode :one
SELECT * FROM warehouse.containers
WHERE workspace_id = $1 AND short_code = $2;

-- name: CreateContainer :one
INSERT INTO warehouse.containers (id, workspace_id, name, location_id, description, capacity, short_code)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateContainer :one
UPDATE warehouse.containers
SET name = $2, location_id = $3, description = $4, capacity = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveContainer :exec
UPDATE warehouse.containers
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreContainer :exec
UPDATE warehouse.containers
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListContainersByLocation :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1 AND location_id = $2 AND is_archived = false
ORDER BY name;

-- name: ListContainersByWorkspace :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: SearchContainers :many
SELECT * FROM warehouse.containers
WHERE workspace_id = $1
  AND is_archived = false
  AND search_vector @@ plainto_tsquery('english', $2)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
LIMIT $3;

-- name: ContainerShortCodeExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.containers
    WHERE workspace_id = $1 AND short_code = $2
);

-- name: DeleteContainer :exec
DELETE FROM warehouse.containers WHERE id = $1;
