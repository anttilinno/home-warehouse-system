-- name: GetWorkspaceByID :one
SELECT * FROM auth.workspaces WHERE id = $1;

-- name: GetWorkspaceBySlug :one
SELECT * FROM auth.workspaces WHERE slug = $1;

-- name: CreateWorkspace :one
INSERT INTO auth.workspaces (id, name, slug, description, is_personal)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateWorkspace :one
UPDATE auth.workspaces
SET name = $2, description = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteWorkspace :exec
DELETE FROM auth.workspaces WHERE id = $1;

-- name: ListWorkspacesByUser :many
SELECT w.* FROM auth.workspaces w
JOIN auth.workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = $1
ORDER BY w.name;

-- name: WorkspaceExistsBySlug :one
SELECT EXISTS(SELECT 1 FROM auth.workspaces WHERE slug = $1);
