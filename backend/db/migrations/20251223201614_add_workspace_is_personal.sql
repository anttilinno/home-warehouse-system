-- migrate:up
ALTER TABLE auth.workspaces ADD COLUMN is_personal BOOLEAN NOT NULL DEFAULT false;

-- Mark existing personal workspaces (created during registration)
-- These are workspaces where the owner has invited_by = NULL
UPDATE auth.workspaces w
SET is_personal = true
FROM auth.workspace_members wm
WHERE wm.workspace_id = w.id
  AND wm.role = 'owner'
  AND wm.invited_by IS NULL;

-- migrate:down
ALTER TABLE auth.workspaces DROP COLUMN is_personal;
