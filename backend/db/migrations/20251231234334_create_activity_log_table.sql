-- migrate:up

-- Create enums for activity actions and entity types (if they don't exist)
DO $$ BEGIN
    CREATE TYPE warehouse.activity_action_enum AS ENUM (
        'CREATE',
        'UPDATE',
        'DELETE',
        'MOVE',
        'LOAN',
        'RETURN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE warehouse.activity_entity_enum AS ENUM (
        'ITEM',
        'INVENTORY',
        'LOCATION',
        'CONTAINER',
        'CATEGORY',
        'LABEL',
        'LOAN',
        'BORROWER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create activity_log table
CREATE TABLE IF NOT EXISTS warehouse.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action warehouse.activity_action_enum NOT NULL,
    entity_type warehouse.activity_entity_enum NOT NULL,
    entity_id UUID NOT NULL,
    entity_name VARCHAR(200),
    changes JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_activity_log_workspace_id ON warehouse.activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON warehouse.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON warehouse.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON warehouse.activity_log(created_at DESC);

-- migrate:down

DROP TABLE IF EXISTS warehouse.activity_log;
DROP TYPE IF EXISTS warehouse.activity_entity_enum;
DROP TYPE IF EXISTS warehouse.activity_action_enum;
