-- migrate:up

-- Photos for locations ("what does this shelf actually look like"), so a phone
-- capture can record a place without typing and the details get filled in from
-- a desktop later.
--
-- Shape follows the EXISTING house pattern for binary content rather than
-- inventing a third one: warehouse.files holds the blob metadata (mime, size,
-- checksum, storage_key) and a per-entity link table points at it — exactly how
-- warehouse.attachments and warehouse.repair_attachments already work. In
-- particular the file FK is COMPOSITE (workspace_id, file_id), copying
-- attachments_file_fk, so a link can never reference another tenant's file.
--
-- (item_photos / repair_photos predate that pattern and inline storage_path
-- instead; they are deliberately left alone here.)

-- The composite location FK below needs warehouse.locations (workspace_id, id)
-- to be unique. 001_initial_schema declares uq_locations_ws_id, but databases
-- restored from older dumps are missing it (verified on a dev DB whose
-- schema_migrations stops at 002), so add it only when absent instead of
-- assuming either state. NOT dropped on the way down — containers_location_fk
-- and favorites_location_fk reference the same key.
DO $ensure_locations_ws_id$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'warehouse.locations'::regclass
           AND conname = 'uq_locations_ws_id'
    ) THEN
        ALTER TABLE warehouse.locations
            ADD CONSTRAINT uq_locations_ws_id UNIQUE (workspace_id, id);
    END IF;
END
$ensure_locations_ws_id$;

-- Same story for the files side (uq_files_ws_id, 001:1988) — present in a
-- freshly migrated database, absent in older restores.
DO $ensure_files_ws_id$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'warehouse.files'::regclass
           AND conname = 'uq_files_ws_id'
    ) THEN
        ALTER TABLE warehouse.files
            ADD CONSTRAINT uq_files_ws_id UNIQUE (workspace_id, id);
    END IF;
END
$ensure_files_ws_id$;

CREATE TABLE warehouse.location_photos (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    location_id uuid NOT NULL,
    file_id uuid NOT NULL,
    caption text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT location_photos_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE warehouse.location_photos IS 'Link table: a location <-> a row in warehouse.files. Mirrors warehouse.attachments (composite workspace-scoped file FK); the bytes live under the files storage_key.';

ALTER TABLE ONLY warehouse.location_photos
    ADD CONSTRAINT location_photos_workspace_fk FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;

-- Composite, workspace-scoped: deleting a location takes its photo links with
-- it, and a link can never cross tenants.
ALTER TABLE ONLY warehouse.location_photos
    ADD CONSTRAINT location_photos_location_fk FOREIGN KEY (workspace_id, location_id) REFERENCES warehouse.locations(workspace_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY warehouse.location_photos
    ADD CONSTRAINT location_photos_file_fk FOREIGN KEY (workspace_id, file_id) REFERENCES warehouse.files(workspace_id, id) ON DELETE CASCADE;

-- The only read pattern: every photo of one location, newest first.
CREATE INDEX ix_location_photos_location ON warehouse.location_photos (workspace_id, location_id, created_at DESC);

-- migrate:down

DROP TABLE warehouse.location_photos;
