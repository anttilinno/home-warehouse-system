-- migrate:up

-- ============================================================================
-- Tenant Scoping Columns (audit A2)
-- ============================================================================
-- warehouse.attachments, warehouse.item_labels and warehouse.container_tags
-- carried no workspace_id at all — tenant scoping existed only via joins.
-- Add the column, backfill from the owning parent, and lock it down.
-- (warehouse.files already has workspace_id NOT NULL since 001.)

-- ----------------------------------------------------------------------------
-- attachments
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.attachments
    ADD COLUMN workspace_id uuid REFERENCES auth.workspaces(id) ON DELETE CASCADE;

UPDATE warehouse.attachments a
SET workspace_id = i.workspace_id
FROM warehouse.items i
WHERE a.item_id = i.id;

ALTER TABLE warehouse.attachments
    ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX ix_attachments_workspace ON warehouse.attachments(workspace_id);

-- ----------------------------------------------------------------------------
-- item_labels
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.item_labels
    ADD COLUMN workspace_id uuid REFERENCES auth.workspaces(id) ON DELETE CASCADE;

UPDATE warehouse.item_labels il
SET workspace_id = i.workspace_id
FROM warehouse.items i
WHERE il.item_id = i.id;

ALTER TABLE warehouse.item_labels
    ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX ix_item_labels_workspace ON warehouse.item_labels(workspace_id);

-- ----------------------------------------------------------------------------
-- container_tags
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.container_tags
    ADD COLUMN workspace_id uuid REFERENCES auth.workspaces(id) ON DELETE CASCADE;

UPDATE warehouse.container_tags ct
SET workspace_id = c.workspace_id
FROM warehouse.containers c
WHERE ct.container_id = c.id;

ALTER TABLE warehouse.container_tags
    ALTER COLUMN workspace_id SET NOT NULL;

-- Replace GLOBAL tag uniqueness with per-workspace uniqueness. The old
-- constraint let one tenant's RFID/NFC tag value block every other tenant's
-- and leaked cross-tenant existence via unique-violation errors.
ALTER TABLE warehouse.container_tags
    DROP CONSTRAINT container_tags_tag_value_key;

ALTER TABLE warehouse.container_tags
    ADD CONSTRAINT uq_container_tags_ws_value UNIQUE (workspace_id, tag_type, tag_value);

-- migrate:down

ALTER TABLE warehouse.container_tags
    DROP CONSTRAINT uq_container_tags_ws_value;
ALTER TABLE warehouse.container_tags
    ADD CONSTRAINT container_tags_tag_value_key UNIQUE (tag_value);
ALTER TABLE warehouse.container_tags
    DROP COLUMN workspace_id;

ALTER TABLE warehouse.item_labels
    DROP COLUMN workspace_id;

ALTER TABLE warehouse.attachments
    DROP COLUMN workspace_id;
