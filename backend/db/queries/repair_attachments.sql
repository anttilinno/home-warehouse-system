-- name: InsertRepairAttachment :one
INSERT INTO warehouse.repair_attachments (
    id, repair_log_id, workspace_id, file_id, attachment_type, title
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetRepairAttachment :one
SELECT * FROM warehouse.repair_attachments
WHERE id = $1 AND workspace_id = $2;

-- name: ListRepairAttachmentsByRepairLog :many
SELECT
    ra.id,
    ra.repair_log_id,
    ra.workspace_id,
    ra.file_id,
    ra.attachment_type,
    ra.title,
    ra.created_at,
    ra.updated_at,
    f.original_name AS file_name,
    f.mime_type AS file_mime_type,
    f.size_bytes AS file_size,
    f.storage_key AS file_storage_key
FROM warehouse.repair_attachments ra
JOIN warehouse.files f ON ra.file_id = f.id
WHERE ra.repair_log_id = $1 AND ra.workspace_id = $2
ORDER BY ra.created_at ASC;

-- name: DeleteRepairAttachment :exec
DELETE FROM warehouse.repair_attachments
WHERE id = $1 AND workspace_id = $2;
