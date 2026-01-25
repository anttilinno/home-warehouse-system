-- name: InsertRepairPhoto :one
INSERT INTO warehouse.repair_photos (
    id, repair_log_id, workspace_id, photo_type, filename, storage_path,
    thumbnail_path, file_size, mime_type, width, height, display_order,
    caption, uploaded_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: GetRepairPhoto :one
SELECT * FROM warehouse.repair_photos
WHERE id = $1 AND workspace_id = $2;

-- name: ListRepairPhotosByRepairLog :many
SELECT * FROM warehouse.repair_photos
WHERE repair_log_id = $1 AND workspace_id = $2
ORDER BY display_order ASC, created_at ASC;

-- name: UpdateRepairPhotoCaption :one
UPDATE warehouse.repair_photos
SET caption = $2, updated_at = now()
WHERE id = $1 AND workspace_id = $3
RETURNING *;

-- name: UpdateRepairPhotoDisplayOrder :exec
UPDATE warehouse.repair_photos
SET display_order = $2, updated_at = now()
WHERE id = $1 AND workspace_id = $3;

-- name: DeleteRepairPhoto :exec
DELETE FROM warehouse.repair_photos
WHERE id = $1 AND workspace_id = $2;

-- name: CountRepairPhotosByRepairLog :one
SELECT COUNT(*)::int FROM warehouse.repair_photos
WHERE repair_log_id = $1 AND workspace_id = $2;

-- name: GetMaxRepairPhotoDisplayOrder :one
SELECT COALESCE(MAX(display_order), -1)::int as max_order
FROM warehouse.repair_photos
WHERE repair_log_id = $1 AND workspace_id = $2;
