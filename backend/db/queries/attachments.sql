-- name: CreateFile :one
INSERT INTO warehouse.files (id, workspace_id, original_name, extension, mime_type, size_bytes, checksum, storage_key, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetFile :one
SELECT * FROM warehouse.files WHERE id = $1;

-- name: DeleteFile :exec
DELETE FROM warehouse.files WHERE id = $1;

-- name: CreateAttachment :one
INSERT INTO warehouse.attachments (id, item_id, file_id, attachment_type, title, is_primary, docspell_item_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetAttachment :one
SELECT * FROM warehouse.attachments WHERE id = $1;

-- name: ListAttachmentsByItem :many
SELECT a.*, f.original_name, f.mime_type, f.size_bytes
FROM warehouse.attachments a
LEFT JOIN warehouse.files f ON a.file_id = f.id
WHERE a.item_id = $1
ORDER BY a.is_primary DESC, a.created_at;

-- name: DeleteAttachment :exec
DELETE FROM warehouse.attachments WHERE id = $1;

-- name: SetPrimaryAttachment :exec
UPDATE warehouse.attachments
SET is_primary = (id = $2)
WHERE item_id = $1;
