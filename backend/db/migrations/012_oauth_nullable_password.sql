-- migrate:up

-- Allow OAuth-only users (no password)
ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;

-- Track whether user has a password set (for UI logic)
ALTER TABLE auth.users ADD COLUMN has_password BOOLEAN NOT NULL DEFAULT true;

-- migrate:down
UPDATE auth.users SET password_hash = '$2a$10$placeholder' WHERE password_hash IS NULL;
ALTER TABLE auth.users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE auth.users DROP COLUMN IF EXISTS has_password;
