-- migrate:up

-- Create item_photos table for storing item photo metadata
CREATE TABLE warehouse.item_photos (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    item_id UUID NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    caption TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying photos by item, sorted by display order
CREATE INDEX idx_item_photos_item ON warehouse.item_photos(item_id, display_order);

-- Index for workspace-level queries
CREATE INDEX idx_item_photos_workspace ON warehouse.item_photos(workspace_id);

-- Partial unique index to ensure only one primary photo per item
CREATE UNIQUE INDEX idx_item_photos_primary ON warehouse.item_photos(item_id, is_primary) WHERE is_primary = true;

-- migrate:down

-- Drop the table (cascades will clean up dependencies)
DROP TABLE IF EXISTS warehouse.item_photos;

