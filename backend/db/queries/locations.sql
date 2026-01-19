-- name: GetLocation :one
SELECT * FROM warehouse.locations
WHERE id = $1 AND workspace_id = $2;

-- name: GetLocationByShortCode :one
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND short_code = $2;

-- name: CreateLocation :one
INSERT INTO warehouse.locations (id, workspace_id, name, parent_location, description, short_code)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateLocation :one
UPDATE warehouse.locations
SET name = $2, parent_location = $3, description = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveLocation :exec
UPDATE warehouse.locations
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreLocation :exec
UPDATE warehouse.locations
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListLocations :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: ListLocationsByParent :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND parent_location = $2 AND is_archived = false
ORDER BY name;

-- name: ListRootLocations :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1 AND parent_location IS NULL AND is_archived = false
ORDER BY name;

-- name: SearchLocations :many
SELECT * FROM warehouse.locations
WHERE workspace_id = $1
  AND is_archived = false
  AND search_vector @@ plainto_tsquery('english', $2)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
LIMIT $3;

-- name: ShortCodeExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.locations
    WHERE workspace_id = $1 AND short_code = $2
);

-- name: DeleteLocation :exec
DELETE FROM warehouse.locations WHERE id = $1;
