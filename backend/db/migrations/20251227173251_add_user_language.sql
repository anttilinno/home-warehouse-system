-- migrate:up
ALTER TABLE auth.users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'en';

-- migrate:down
ALTER TABLE auth.users DROP COLUMN language;

