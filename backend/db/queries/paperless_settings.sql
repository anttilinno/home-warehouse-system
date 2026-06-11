-- name: GetWorkspacePaperlessSettings :one
SELECT * FROM auth.workspace_paperless_settings
WHERE workspace_id = $1;

-- name: UpsertWorkspacePaperlessSettings :one
INSERT INTO auth.workspace_paperless_settings (id, workspace_id, base_url, api_token_encrypted, sync_tags_enabled, is_enabled)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (workspace_id) DO UPDATE SET
    base_url = EXCLUDED.base_url,
    api_token_encrypted = EXCLUDED.api_token_encrypted,
    sync_tags_enabled = EXCLUDED.sync_tags_enabled,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now()
RETURNING *;

-- name: DeleteWorkspacePaperlessSettings :exec
DELETE FROM auth.workspace_paperless_settings
WHERE workspace_id = $1;
