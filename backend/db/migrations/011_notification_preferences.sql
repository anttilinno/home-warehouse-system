-- migrate:up
ALTER TABLE auth.users
  ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN auth.users.notification_preferences IS
'User notification preferences by category. Empty object means all enabled. Keys: enabled, loans, inventory, workspace, system.';

-- migrate:down
ALTER TABLE auth.users
  DROP COLUMN notification_preferences;
