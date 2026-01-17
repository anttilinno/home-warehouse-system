-- name: CreateItemPhoto :one
INSERT INTO warehouse.item_photos (
    id, item_id, workspace_id, filename, storage_path, thumbnail_path,
    file_size, mime_type, width, height, display_order, is_primary,
    caption, uploaded_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: GetItemPhoto :one
SELECT * FROM warehouse.item_photos
WHERE id = $1;

-- name: GetItemPhotoByID :one
SELECT * FROM warehouse.item_photos
WHERE id = $1 AND workspace_id = $2;

-- name: ListItemPhotosByItem :many
SELECT * FROM warehouse.item_photos
WHERE item_id = $1 AND workspace_id = $2
ORDER BY display_order ASC, created_at ASC;

-- name: GetPrimaryItemPhoto :one
SELECT * FROM warehouse.item_photos
WHERE item_id = $1 AND workspace_id = $2 AND is_primary = true
LIMIT 1;

-- name: UpdateItemPhoto :one
UPDATE warehouse.item_photos
SET
    filename = COALESCE(sqlc.narg('filename'), filename),
    caption = COALESCE(sqlc.narg('caption'), caption),
    is_primary = COALESCE(sqlc.narg('is_primary'), is_primary),
    display_order = COALESCE(sqlc.narg('display_order'), display_order),
    updated_at = now()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateItemPhotoDisplayOrder :exec
UPDATE warehouse.item_photos
SET display_order = $2, updated_at = now()
WHERE id = $1;

-- name: UnsetPrimaryPhotosForItem :exec
UPDATE warehouse.item_photos
SET is_primary = false, updated_at = now()
WHERE item_id = $1 AND workspace_id = $2;

-- name: SetItemPhotoAsPrimary :exec
UPDATE warehouse.item_photos
SET is_primary = true, updated_at = now()
WHERE id = $1 AND workspace_id = $2;

-- name: DeleteItemPhoto :exec
DELETE FROM warehouse.item_photos
WHERE id = $1 AND workspace_id = $2;

-- name: DeleteItemPhotosByItem :exec
DELETE FROM warehouse.item_photos
WHERE item_id = $1 AND workspace_id = $2;

-- name: CountItemPhotosByItem :one
SELECT COUNT(*) FROM warehouse.item_photos
WHERE item_id = $1 AND workspace_id = $2;

-- name: GetNextDisplayOrder :one
SELECT COALESCE(MAX(display_order) + 1, 0) as next_order
FROM warehouse.item_photos
WHERE item_id = $1 AND workspace_id = $2;
