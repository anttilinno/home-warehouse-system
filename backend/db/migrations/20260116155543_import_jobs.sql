-- migrate:up

-- Create ENUM types for import jobs
CREATE TYPE warehouse.import_entity_enum AS ENUM (
    'items',
    'inventory',
    'locations',
    'containers',
    'categories',
    'borrowers'
);

CREATE TYPE warehouse.import_status_enum AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);

-- Create import_jobs table
CREATE TABLE warehouse.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    entity_type warehouse.import_entity_enum NOT NULL,
    status warehouse.import_status_enum NOT NULL DEFAULT 'pending',
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    total_rows INTEGER,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_message TEXT,

    CONSTRAINT import_jobs_workspace_id_idx_check CHECK (workspace_id IS NOT NULL)
);

-- Create import_errors table
CREATE TABLE warehouse.import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES warehouse.import_jobs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    field_name VARCHAR(255),
    error_message TEXT NOT NULL,
    row_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT import_errors_import_job_id_idx_check CHECK (import_job_id IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX idx_import_jobs_workspace_id ON warehouse.import_jobs(workspace_id);
CREATE INDEX idx_import_jobs_user_id ON warehouse.import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON warehouse.import_jobs(status);
CREATE INDEX idx_import_jobs_created_at ON warehouse.import_jobs(created_at DESC);
CREATE INDEX idx_import_errors_import_job_id ON warehouse.import_errors(import_job_id);

-- migrate:down

-- Drop indexes
DROP INDEX IF EXISTS warehouse.idx_import_errors_import_job_id;
DROP INDEX IF EXISTS warehouse.idx_import_jobs_created_at;
DROP INDEX IF EXISTS warehouse.idx_import_jobs_status;
DROP INDEX IF EXISTS warehouse.idx_import_jobs_user_id;
DROP INDEX IF EXISTS warehouse.idx_import_jobs_workspace_id;

-- Drop tables
DROP TABLE IF EXISTS warehouse.import_errors;
DROP TABLE IF EXISTS warehouse.import_jobs;

-- Drop ENUM types
DROP TYPE IF EXISTS warehouse.import_status_enum;
DROP TYPE IF EXISTS warehouse.import_entity_enum;

