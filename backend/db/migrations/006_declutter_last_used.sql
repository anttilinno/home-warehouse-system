-- migrate:up

-- Add last_used_at column to track when inventory was last "used"
-- This powers the declutter assistant feature
ALTER TABLE warehouse.inventory
ADD COLUMN last_used_at TIMESTAMPTZ;

-- Set existing records to created_at as conservative default
-- This prevents all items showing as "never used" after deploy
UPDATE warehouse.inventory
SET last_used_at = created_at
WHERE last_used_at IS NULL;

-- Create partial index for efficient unused item queries
-- Only indexes non-archived items since that's all we query
CREATE INDEX ix_inventory_last_used ON warehouse.inventory(workspace_id, last_used_at)
WHERE is_archived = false;

COMMENT ON COLUMN warehouse.inventory.last_used_at IS
'Timestamp when this inventory was last marked as "used". Used for declutter assistant. Defaults to created_at for existing records.';

-- migrate:down

DROP INDEX IF EXISTS warehouse.ix_inventory_last_used;
ALTER TABLE warehouse.inventory DROP COLUMN IF EXISTS last_used_at;
