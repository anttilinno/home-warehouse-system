-- migrate:up

-- ============================================================================
-- Repair Log Extensions
-- ============================================================================
-- Adds: warranty claim tracking, maintenance reminders, repair photos, attachments

-- Add warranty claim and reminder fields to repair_logs
ALTER TABLE warehouse.repair_logs
    ADD COLUMN is_warranty_claim BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN reminder_date DATE,
    ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN warehouse.repair_logs.is_warranty_claim IS
'Whether this repair was covered under warranty.';

COMMENT ON COLUMN warehouse.repair_logs.reminder_date IS
'Optional future date for maintenance reminder notification.';

COMMENT ON COLUMN warehouse.repair_logs.reminder_sent IS
'Whether the reminder notification has been sent.';

-- Partial index for efficient reminder queries
CREATE INDEX ix_repair_logs_reminder ON warehouse.repair_logs(reminder_date)
    WHERE reminder_date IS NOT NULL AND reminder_sent = false;

-- ============================================================================
-- Repair Photos
-- ============================================================================
-- Photos attached to repairs with BEFORE/DURING/AFTER categorization

CREATE TYPE warehouse.repair_photo_type_enum AS ENUM (
    'BEFORE',
    'DURING',
    'AFTER'
);

CREATE TABLE warehouse.repair_photos (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    repair_log_id UUID NOT NULL REFERENCES warehouse.repair_logs(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    photo_type warehouse.repair_photo_type_enum NOT NULL DEFAULT 'DURING',
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    caption TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE warehouse.repair_photos IS
'Photos attached to repair logs, categorized by when they were taken (before/during/after repair).';

COMMENT ON COLUMN warehouse.repair_photos.photo_type IS
'Categorizes when the photo was taken: BEFORE repair, DURING the repair process, or AFTER completion.';

CREATE INDEX idx_repair_photos_repair ON warehouse.repair_photos(repair_log_id, display_order);
CREATE INDEX idx_repair_photos_workspace ON warehouse.repair_photos(workspace_id);

-- ============================================================================
-- Repair Attachments
-- ============================================================================
-- Links repair logs to files (receipts, invoices, warranty documents)

CREATE TABLE warehouse.repair_attachments (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    repair_log_id UUID NOT NULL REFERENCES warehouse.repair_logs(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES warehouse.files(id) ON DELETE CASCADE,
    attachment_type warehouse.attachment_type_enum NOT NULL,
    title VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE warehouse.repair_attachments IS
'Links repair logs to uploaded files (receipts, invoices, warranty documents).';

CREATE INDEX ix_repair_attachments_repair ON warehouse.repair_attachments(repair_log_id);
CREATE INDEX ix_repair_attachments_workspace ON warehouse.repair_attachments(workspace_id);

-- migrate:down

DROP TABLE IF EXISTS warehouse.repair_attachments;
DROP TABLE IF EXISTS warehouse.repair_photos;
DROP TYPE IF EXISTS warehouse.repair_photo_type_enum;

DROP INDEX IF EXISTS warehouse.ix_repair_logs_reminder;
ALTER TABLE warehouse.repair_logs
    DROP COLUMN IF EXISTS is_warranty_claim,
    DROP COLUMN IF EXISTS reminder_date,
    DROP COLUMN IF EXISTS reminder_sent;
