-- migrate:up

-- Add REPAIR_REMINDER notification type for maintenance reminder notifications
ALTER TYPE auth.notification_type_enum ADD VALUE 'REPAIR_REMINDER' AFTER 'LOAN_RETURNED';

-- migrate:down

-- Note: PostgreSQL does not support removing enum values directly.
-- The down migration is a no-op as REPAIR_REMINDER will remain in the enum.
-- To fully remove it would require recreating the enum type.
