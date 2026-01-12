-- name: GetMember :one
SELECT * FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: CreateMember :one
INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, invited_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateMemberRole :one
UPDATE auth.workspace_members
SET role = $3, updated_at = now()
WHERE workspace_id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteMember :exec
DELETE FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: ListMembersByWorkspace :many
SELECT wm.*, u.email, u.full_name
FROM auth.workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
WHERE wm.workspace_id = $1
ORDER BY wm.created_at;

-- name: GetUserRole :one
SELECT role FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: CountWorkspaceOwners :one
SELECT COUNT(*) FROM auth.workspace_members
WHERE workspace_id = $1 AND role = 'owner';

-- name: MemberExists :one
SELECT EXISTS(
    SELECT 1 FROM auth.workspace_members
    WHERE workspace_id = $1 AND user_id = $2
);
