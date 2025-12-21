-- migrate:up

-- ============================================================================
-- Notifications System
-- ============================================================================

-- Notification types
CREATE TYPE auth.notification_type_enum AS ENUM (
    'LOAN_DUE_SOON',      -- Loan due date approaching
    'LOAN_OVERDUE',       -- Loan is past due date
    'LOAN_RETURNED',      -- Item has been returned
    'LOW_STOCK',          -- Inventory below threshold
    'WORKSPACE_INVITE',   -- Invited to a workspace
    'MEMBER_JOINED',      -- New member joined workspace
    'SYSTEM'              -- General system notification
);

-- Notifications table
CREATE TABLE auth.notifications (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id uuid REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    notification_type auth.notification_type_enum NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE auth.notifications IS
'User notifications for various events in the system.';

COMMENT ON COLUMN auth.notifications.metadata IS
'Additional data like entity IDs, links, etc. stored as JSON.';

CREATE INDEX ix_notifications_user ON auth.notifications(user_id);
CREATE INDEX ix_notifications_user_unread ON auth.notifications(user_id) WHERE is_read = false;
CREATE INDEX ix_notifications_workspace ON auth.notifications(workspace_id);
CREATE INDEX ix_notifications_created ON auth.notifications(created_at DESC);

-- migrate:down

DROP TABLE IF EXISTS auth.notifications;
DROP TYPE IF EXISTS auth.notification_type_enum;
