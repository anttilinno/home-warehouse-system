-- migrate:up

-- ============================================================================
-- Repair Log System
-- ============================================================================
-- Tracks repair history for inventory items with status workflow:
-- PENDING -> IN_PROGRESS -> COMPLETED

-- Repair status enum
CREATE TYPE warehouse.repair_status_enum AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED'
);

-- Repair logs table
CREATE TABLE warehouse.repair_logs (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    inventory_id uuid NOT NULL REFERENCES warehouse.inventory(id) ON DELETE CASCADE,
    status warehouse.repair_status_enum NOT NULL DEFAULT 'PENDING',
    description TEXT NOT NULL,
    repair_date DATE,
    cost INTEGER,                    -- in cents
    currency_code VARCHAR(3) DEFAULT 'EUR',
    service_provider VARCHAR(200),
    completed_at TIMESTAMPTZ,
    new_condition warehouse.item_condition_enum,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE warehouse.repair_logs IS
'Tracks repair history for inventory items. Status workflow: PENDING -> IN_PROGRESS -> COMPLETED.';

COMMENT ON COLUMN warehouse.repair_logs.cost IS
'Repair cost in cents for the specified currency.';

COMMENT ON COLUMN warehouse.repair_logs.new_condition IS
'The condition to set on the inventory item when the repair is completed.';

COMMENT ON COLUMN warehouse.repair_logs.completed_at IS
'Timestamp when the repair status was set to COMPLETED.';

-- Indexes
CREATE INDEX ix_repair_logs_workspace ON warehouse.repair_logs(workspace_id);
CREATE INDEX ix_repair_logs_inventory ON warehouse.repair_logs(inventory_id);
CREATE INDEX ix_repair_logs_status ON warehouse.repair_logs(workspace_id, status);

-- migrate:down

DROP TABLE IF EXISTS warehouse.repair_logs;
DROP TYPE IF EXISTS warehouse.repair_status_enum;
