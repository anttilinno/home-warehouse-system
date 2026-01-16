-- migrate:up

-- Create ENUMs for pending changes
CREATE TYPE warehouse.pending_change_action_enum AS ENUM ('create', 'update', 'delete');
CREATE TYPE warehouse.pending_change_status_enum AS ENUM ('pending', 'approved', 'rejected');

-- Create pending_changes table
CREATE TABLE warehouse.pending_changes (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action warehouse.pending_change_action_enum NOT NULL,
    payload JSONB NOT NULL,
    status warehouse.pending_change_status_enum NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_pending_changes_workspace_status ON warehouse.pending_changes (workspace_id, status);
CREATE INDEX idx_pending_changes_requester ON warehouse.pending_changes (requester_id);
CREATE INDEX idx_pending_changes_entity ON warehouse.pending_changes (entity_type, entity_id);

-- migrate:down

-- Drop indexes
DROP INDEX IF EXISTS warehouse.idx_pending_changes_entity;
DROP INDEX IF EXISTS warehouse.idx_pending_changes_requester;
DROP INDEX IF EXISTS warehouse.idx_pending_changes_workspace_status;

-- Drop table
DROP TABLE IF EXISTS warehouse.pending_changes;

-- Drop ENUMs
DROP TYPE IF EXISTS warehouse.pending_change_status_enum;
DROP TYPE IF EXISTS warehouse.pending_change_action_enum;

