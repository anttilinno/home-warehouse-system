-- migrate:up
-- Tombstone table for PWA offline sync - tracks deleted records

CREATE TABLE warehouse.deleted_records (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    entity_type warehouse.activity_entity_enum NOT NULL,
    entity_id UUID NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_deleted_records_workspace ON warehouse.deleted_records(workspace_id);
CREATE INDEX idx_deleted_records_workspace_since ON warehouse.deleted_records(workspace_id, deleted_at);

COMMENT ON TABLE warehouse.deleted_records IS
'Tombstone table tracking hard-deleted records for PWA offline sync.';

-- migrate:down
DROP TABLE IF EXISTS warehouse.deleted_records;
