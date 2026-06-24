-- migrate:up

-- Per-user "Show archived" preference. When ON, the Items and Inventory list
-- views include archived rows. Real boolean column on auth.users (consistent
-- with the other typed preference columns), not part of notification_preferences.
ALTER TABLE auth.users
    ADD COLUMN show_archived boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN auth.users.show_archived IS 'When true, list views (items, inventory) include archived rows. Defaults to false.';

-- migrate:down

ALTER TABLE auth.users
    DROP COLUMN show_archived;
