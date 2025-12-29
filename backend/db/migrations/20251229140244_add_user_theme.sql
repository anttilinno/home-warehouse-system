-- migrate:up
ALTER TABLE auth.users ADD COLUMN theme VARCHAR(20) NOT NULL DEFAULT 'system';

-- migrate:down
ALTER TABLE auth.users DROP COLUMN theme;

