-- migrate:up
ALTER TABLE auth.users ADD COLUMN date_format VARCHAR(20) DEFAULT 'DD.MM.YYYY';

-- migrate:down
ALTER TABLE auth.users DROP COLUMN date_format;
