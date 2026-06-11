-- migrate:up

-- Expiry & Warranty Alerting (ROADMAP "Expiry & Warranty Alerting").
-- New notification types consumed by the expiry reminder job
-- (internal/jobs/expiry_reminders.go):
--   EXPIRY_ALERT   - inventory.expiration_date approaching (food/medicine/batteries)
--   WARRANTY_ALERT - inventory.warranty_expires approaching (skips lifetime_warranty items)
ALTER TYPE auth.notification_type_enum ADD VALUE IF NOT EXISTS 'EXPIRY_ALERT';
ALTER TYPE auth.notification_type_enum ADD VALUE IF NOT EXISTS 'WARRANTY_ALERT';

-- migrate:down

-- PostgreSQL does not support removing enum values. The added values are
-- harmless if unused, so down is intentionally a no-op.
