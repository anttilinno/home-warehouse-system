-- migrate:up

-- ============================================================================
-- Home Warehouse System - Initial Schema
-- ============================================================================

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS warehouse;

-- ============================================================================
-- ENUM Types
-- ============================================================================

-- Auth enums
CREATE TYPE auth.workspace_role_enum AS ENUM (
    'owner',    -- Full control, can delete workspace and manage members
    'admin',    -- Can manage all data, cannot delete workspace or manage owner
    'member',   -- Can CRUD inventory data
    'viewer'    -- Read-only access
);

CREATE TYPE auth.notification_type_enum AS ENUM (
    'LOAN_DUE_SOON',      -- Loan due date approaching
    'LOAN_OVERDUE',       -- Loan is past due date
    'LOAN_RETURNED',      -- Item has been returned
    'LOW_STOCK',          -- Inventory below threshold
    'WORKSPACE_INVITE',   -- Invited to a workspace
    'MEMBER_JOINED',      -- New member joined workspace
    'SYSTEM'              -- General system notification
);

-- Warehouse enums
CREATE TYPE warehouse.item_condition_enum AS ENUM (
    'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'FOR_REPAIR'
);

CREATE TYPE warehouse.item_status_enum AS ENUM (
    'AVAILABLE', 'IN_USE', 'RESERVED', 'ON_LOAN', 'IN_TRANSIT', 'DISPOSED', 'MISSING'
);

CREATE TYPE warehouse.tag_type_enum AS ENUM (
    'RFID', 'NFC', 'QR'
);

CREATE TYPE warehouse.attachment_type_enum AS ENUM (
    'PHOTO', 'MANUAL', 'RECEIPT', 'WARRANTY', 'OTHER'
);

CREATE TYPE warehouse.favorite_type_enum AS ENUM (
    'ITEM', 'LOCATION', 'CONTAINER'
);

CREATE TYPE warehouse.activity_action_enum AS ENUM (
    'CREATE', 'UPDATE', 'DELETE', 'MOVE', 'LOAN', 'RETURN'
);

CREATE TYPE warehouse.activity_entity_enum AS ENUM (
    'ITEM', 'INVENTORY', 'LOCATION', 'CONTAINER', 'CATEGORY', 'LABEL', 'LOAN', 'BORROWER'
);

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

CREATE TYPE warehouse.pending_change_action_enum AS ENUM ('create', 'update', 'delete');
CREATE TYPE warehouse.pending_change_status_enum AS ENUM ('pending', 'approved', 'rejected');

-- ============================================================================
-- Auth Schema Tables
-- ============================================================================

-- Workspaces (isolated environments)
CREATE TABLE auth.workspaces (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_personal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE auth.workspaces IS
'Isolated environments for organizing inventory. Each workspace has its own locations, items, etc.';

COMMENT ON COLUMN auth.workspaces.slug IS
'URL-friendly identifier (e.g., "my-home", "office"). Used in URLs like /w/my-home/items';

COMMENT ON COLUMN auth.workspaces.is_personal IS
'Whether this is a user''s personal workspace created during registration.';

CREATE INDEX ix_workspaces_slug ON auth.workspaces(slug);

-- Users
CREATE TABLE auth.users (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    date_format VARCHAR(20) DEFAULT 'DD.MM.YYYY',
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN auth.users.date_format IS
'User''s preferred date format for display (e.g., DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD)';

COMMENT ON COLUMN auth.users.language IS
'User''s preferred language code (e.g., en, fi, de)';

COMMENT ON COLUMN auth.users.theme IS
'User''s preferred UI theme: light, dark, or system';

-- Workspace membership
CREATE TABLE auth.workspace_members (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role auth.workspace_role_enum NOT NULL DEFAULT 'member',
    invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);

COMMENT ON TABLE auth.workspace_members IS
'Links users to workspaces with role-based access control.';

CREATE INDEX ix_workspace_members_user ON auth.workspace_members(user_id);
CREATE INDEX ix_workspace_members_workspace ON auth.workspace_members(workspace_id);
CREATE INDEX ix_workspace_members_invited_by ON auth.workspace_members(invited_by)
    WHERE invited_by IS NOT NULL;

-- OAuth accounts for SSO
CREATE TABLE auth.user_oauth_accounts (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);

COMMENT ON TABLE auth.user_oauth_accounts IS
'External OAuth provider accounts linked to local users for SSO.';

COMMENT ON COLUMN auth.user_oauth_accounts.access_token IS
'OAuth access token. Must be encrypted at application layer.';

CREATE INDEX ix_oauth_accounts_user ON auth.user_oauth_accounts(user_id);
CREATE INDEX ix_oauth_accounts_provider ON auth.user_oauth_accounts(provider, provider_user_id);

-- Password reset tokens
CREATE TABLE auth.password_reset_tokens (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE auth.password_reset_tokens IS
'Password reset tokens with expiration and one-time use.';

CREATE INDEX ix_password_reset_tokens_user ON auth.password_reset_tokens(user_id);
CREATE INDEX ix_password_reset_tokens_hash ON auth.password_reset_tokens(token_hash);

-- Export tracking for audit
CREATE TABLE auth.workspace_exports (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    exported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    format VARCHAR(10) NOT NULL,
    file_size_bytes BIGINT,
    record_counts JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE auth.workspace_exports IS
'Audit log of workspace data exports for backup or migration.';

COMMENT ON COLUMN auth.workspace_exports.record_counts IS
'Snapshot of how many records were exported per table, stored as JSON.';

CREATE INDEX ix_workspace_exports_workspace ON auth.workspace_exports(workspace_id);
CREATE INDEX ix_workspace_exports_user ON auth.workspace_exports(exported_by);

-- Notifications
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

-- Docspell settings
CREATE TABLE auth.workspace_docspell_settings (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE UNIQUE,
    base_url VARCHAR(500) NOT NULL,
    collective_name VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL,
    sync_tags_enabled BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE auth.workspace_docspell_settings IS
'Per-workspace Docspell integration configuration. Each workspace can connect to a different Docspell instance.';

COMMENT ON COLUMN auth.workspace_docspell_settings.password_encrypted IS
'Encrypted password for Docspell authentication. Encrypted at application layer using Fernet.';

COMMENT ON COLUMN auth.workspace_docspell_settings.collective_name IS
'Docspell collective name - equivalent to a tenant/organization in Docspell.';

CREATE INDEX ix_workspace_docspell_settings_workspace ON auth.workspace_docspell_settings(workspace_id);

-- ============================================================================
-- Warehouse Schema Tables
-- ============================================================================

-- Categories (hierarchical)
CREATE TABLE warehouse.categories (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_category_id uuid REFERENCES warehouse.categories(id) ON DELETE SET NULL,
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_categories_workspace ON warehouse.categories(workspace_id);
CREATE INDEX ix_categories_name ON warehouse.categories(name);
CREATE INDEX ix_categories_parent ON warehouse.categories(parent_category_id);
CREATE INDEX ix_categories_active ON warehouse.categories(workspace_id, parent_category_id)
    WHERE is_archived = false;

-- Locations (hierarchical)
CREATE TABLE warehouse.locations (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_location uuid REFERENCES warehouse.locations(id) ON DELETE SET NULL,
    description TEXT,
    short_code VARCHAR(8) NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_locations_workspace_short_code UNIQUE (workspace_id, short_code)
);

COMMENT ON COLUMN warehouse.locations.short_code IS
'Short alphanumeric code for QR labels. Unique within workspace. Auto-generated if not provided.';

CREATE INDEX ix_locations_workspace ON warehouse.locations(workspace_id);
CREATE INDEX ix_locations_name ON warehouse.locations(name);
CREATE INDEX ix_locations_parent_location ON warehouse.locations(parent_location);
CREATE INDEX ix_locations_short_code ON warehouse.locations(short_code);
CREATE INDEX ix_locations_search ON warehouse.locations USING GIN(search_vector);
CREATE INDEX ix_locations_active ON warehouse.locations(workspace_id, parent_location)
    WHERE is_archived = false;

-- Containers
CREATE TABLE warehouse.containers (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    location_id uuid NOT NULL REFERENCES warehouse.locations(id) ON DELETE CASCADE,
    description TEXT,
    capacity VARCHAR(100),
    short_code VARCHAR(8) NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_containers_workspace_short_code UNIQUE (workspace_id, short_code)
);

COMMENT ON COLUMN warehouse.containers.short_code IS
'Short alphanumeric code for QR labels. Unique within workspace. Auto-generated if not provided.';

CREATE INDEX ix_containers_workspace ON warehouse.containers(workspace_id);
CREATE INDEX ix_containers_name ON warehouse.containers(name);
CREATE INDEX ix_containers_location_id ON warehouse.containers(location_id);
CREATE INDEX ix_containers_short_code ON warehouse.containers(short_code);
CREATE INDEX ix_containers_search ON warehouse.containers USING GIN(search_vector);
CREATE INDEX ix_containers_active ON warehouse.containers(workspace_id, location_id)
    WHERE is_archived = false;

-- Companies (vendors/stores)
CREATE TABLE warehouse.companies (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    website VARCHAR(500),
    notes TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE INDEX ix_companies_workspace ON warehouse.companies(workspace_id);
CREATE INDEX ix_companies_name ON warehouse.companies(name);
CREATE INDEX ix_companies_active ON warehouse.companies(workspace_id)
    WHERE is_archived = false;

-- Labels
CREATE TABLE warehouse.labels (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7),
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE INDEX ix_labels_workspace ON warehouse.labels(workspace_id);
CREATE INDEX ix_labels_active ON warehouse.labels(workspace_id)
    WHERE is_archived = false;

-- Items
CREATE TABLE warehouse.items (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id uuid REFERENCES warehouse.categories(id) ON DELETE SET NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    image_url VARCHAR(500),
    serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    barcode VARCHAR(50),
    is_insured BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    lifetime_warranty BOOLEAN DEFAULT false,
    warranty_details TEXT,
    purchased_from uuid REFERENCES warehouse.companies(id) ON DELETE SET NULL,
    min_stock_level INTEGER NOT NULL DEFAULT 0,
    short_code VARCHAR(8) NOT NULL,
    obsidian_vault_path VARCHAR(500),
    obsidian_note_path VARCHAR(500),
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(model, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (workspace_id, sku),
    CONSTRAINT uq_items_workspace_short_code UNIQUE (workspace_id, short_code),
    CONSTRAINT chk_items_min_stock_non_negative CHECK (min_stock_level >= 0)
);

COMMENT ON COLUMN warehouse.items.short_code IS
'Short alphanumeric code for QR labels. Unique within workspace. Auto-generated if not provided.';

COMMENT ON COLUMN warehouse.items.barcode IS
'UPC/EAN/other product barcode for scanning.';

COMMENT ON COLUMN warehouse.items.min_stock_level IS
'Threshold for LOW_STOCK notifications. When total inventory falls below this, trigger alert.';

COMMENT ON COLUMN warehouse.items.obsidian_vault_path IS
'Local path to Obsidian vault for linking notes.';

COMMENT ON COLUMN warehouse.items.obsidian_note_path IS
'Relative path to note within vault.';

CREATE INDEX ix_items_workspace ON warehouse.items(workspace_id);
CREATE INDEX ix_items_name ON warehouse.items(name);
CREATE INDEX ix_items_category_id ON warehouse.items(category_id);
CREATE INDEX ix_items_short_code ON warehouse.items(short_code);
CREATE INDEX ix_items_search ON warehouse.items USING gin(search_vector);
CREATE INDEX ix_items_purchased_from ON warehouse.items(purchased_from) WHERE purchased_from IS NOT NULL;
CREATE INDEX ix_items_barcode ON warehouse.items(workspace_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX ix_items_active ON warehouse.items(workspace_id, name) WHERE is_archived = false;

-- Item labels (many-to-many)
CREATE TABLE warehouse.item_labels (
    item_id uuid NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    label_id uuid NOT NULL REFERENCES warehouse.labels(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, label_id)
);

-- Item photos
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

CREATE INDEX idx_item_photos_item ON warehouse.item_photos(item_id, display_order);
CREATE INDEX idx_item_photos_workspace ON warehouse.item_photos(workspace_id);
CREATE UNIQUE INDEX idx_item_photos_primary ON warehouse.item_photos(item_id, is_primary) WHERE is_primary = true;

-- Files (uploaded files storage metadata)
CREATE TABLE warehouse.files (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    extension VARCHAR(10),
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    checksum VARCHAR(64),
    storage_key VARCHAR(500),
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN warehouse.files.storage_key IS
'Storage backend reference (S3 key, filesystem path, etc.)';

CREATE INDEX ix_files_workspace ON warehouse.files(workspace_id);

-- Attachments (links files/docspell docs to items)
CREATE TABLE warehouse.attachments (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    item_id uuid NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    file_id uuid REFERENCES warehouse.files(id) ON DELETE CASCADE,
    attachment_type warehouse.attachment_type_enum NOT NULL,
    title VARCHAR(200),
    is_primary BOOLEAN DEFAULT false,
    docspell_item_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT attachments_has_reference CHECK (
        file_id IS NOT NULL OR docspell_item_id IS NOT NULL
    )
);

COMMENT ON COLUMN warehouse.attachments.title IS
'Optional short description. Falls back to file.original_name if not provided.';

COMMENT ON COLUMN warehouse.attachments.docspell_item_id IS
'Reference to Docspell item ID. When set, document is managed by Docspell and file_id may be NULL.';

CREATE INDEX ix_attachments_item ON warehouse.attachments(item_id);
CREATE INDEX ix_attachments_file ON warehouse.attachments(file_id) WHERE file_id IS NOT NULL;
CREATE INDEX ix_attachments_docspell ON warehouse.attachments(docspell_item_id)
    WHERE docspell_item_id IS NOT NULL;

-- Inventory (physical instances of items)
CREATE TABLE warehouse.inventory (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES warehouse.locations(id) ON DELETE CASCADE,
    container_id uuid REFERENCES warehouse.containers(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    condition warehouse.item_condition_enum,
    status warehouse.item_status_enum DEFAULT 'AVAILABLE',
    date_acquired DATE,
    purchase_price INTEGER,
    currency_code VARCHAR(3) DEFAULT 'EUR',
    warranty_expires DATE,
    expiration_date DATE,
    notes TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_inventory_quantity_non_negative CHECK (quantity >= 0)
);

CREATE INDEX ix_inventory_workspace ON warehouse.inventory(workspace_id);
CREATE INDEX ix_inventory_item_id ON warehouse.inventory(item_id);
CREATE INDEX ix_inventory_location_id ON warehouse.inventory(location_id);
CREATE INDEX ix_inventory_container_id ON warehouse.inventory(container_id);
CREATE INDEX ix_inventory_available ON warehouse.inventory(workspace_id, item_id) WHERE status = 'AVAILABLE';
CREATE INDEX ix_inventory_active ON warehouse.inventory(workspace_id, item_id, location_id)
    WHERE is_archived = false;

-- Container tags (RFID/NFC/QR)
CREATE TABLE warehouse.container_tags (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    container_id uuid NOT NULL REFERENCES warehouse.containers(id) ON DELETE CASCADE,
    tag_type warehouse.tag_type_enum NOT NULL,
    tag_value VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_container_tags_container_id ON warehouse.container_tags(container_id);

-- Borrowers
CREATE TABLE warehouse.borrowers (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    notes TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_borrowers_workspace ON warehouse.borrowers(workspace_id);
CREATE INDEX ix_borrowers_active ON warehouse.borrowers(workspace_id)
    WHERE is_archived = false;
CREATE INDEX ix_borrowers_search ON warehouse.borrowers USING gin(search_vector);

-- Loans (tracks inventory loans)
CREATE TABLE warehouse.loans (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    inventory_id uuid NOT NULL REFERENCES warehouse.inventory(id) ON DELETE CASCADE,
    borrower_id uuid NOT NULL REFERENCES warehouse.borrowers(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    loaned_at TIMESTAMPTZ DEFAULT now(),
    due_date DATE,
    returned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_loans_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_loans_quantity_limit CHECK (quantity <= 1000)
);

CREATE INDEX ix_loans_workspace ON warehouse.loans(workspace_id);
CREATE INDEX ix_loans_inventory_id ON warehouse.loans(inventory_id);
CREATE INDEX ix_loans_borrower_id ON warehouse.loans(borrower_id);
CREATE INDEX ix_loans_outstanding ON warehouse.loans(workspace_id, borrower_id, due_date)
    WHERE returned_at IS NULL;

-- Prevent multiple active loans for same inventory
CREATE UNIQUE INDEX ix_loans_active_inventory
    ON warehouse.loans(inventory_id)
    WHERE returned_at IS NULL;

-- Inventory movements (history)
CREATE TABLE warehouse.inventory_movements (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    inventory_id uuid NOT NULL REFERENCES warehouse.inventory(id) ON DELETE CASCADE,
    from_location_id uuid REFERENCES warehouse.locations(id) ON DELETE SET NULL,
    from_container_id uuid REFERENCES warehouse.containers(id) ON DELETE SET NULL,
    to_location_id uuid REFERENCES warehouse.locations(id) ON DELETE SET NULL,
    to_container_id uuid REFERENCES warehouse.containers(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    moved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_movements_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX ix_inventory_movements_workspace ON warehouse.inventory_movements(workspace_id);
CREATE INDEX ix_inventory_movements_inventory ON warehouse.inventory_movements(inventory_id);
CREATE INDEX ix_inventory_movements_date ON warehouse.inventory_movements(created_at);
CREATE INDEX ix_inventory_movements_moved_by ON warehouse.inventory_movements(moved_by)
    WHERE moved_by IS NOT NULL;

-- Favorites
CREATE TABLE warehouse.favorites (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    favorite_type warehouse.favorite_type_enum NOT NULL,
    item_id uuid REFERENCES warehouse.items(id) ON DELETE CASCADE,
    location_id uuid REFERENCES warehouse.locations(id) ON DELETE CASCADE,
    container_id uuid REFERENCES warehouse.containers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT favorites_has_target CHECK (
        (favorite_type = 'ITEM' AND item_id IS NOT NULL) OR
        (favorite_type = 'LOCATION' AND location_id IS NOT NULL) OR
        (favorite_type = 'CONTAINER' AND container_id IS NOT NULL)
    ),
    CONSTRAINT favorites_unique_item UNIQUE (user_id, item_id),
    CONSTRAINT favorites_unique_location UNIQUE (user_id, location_id),
    CONSTRAINT favorites_unique_container UNIQUE (user_id, container_id)
);

COMMENT ON TABLE warehouse.favorites IS
'User-pinned items, locations, or containers for quick access.';

CREATE INDEX ix_favorites_user ON warehouse.favorites(user_id);
CREATE INDEX ix_favorites_workspace ON warehouse.favorites(workspace_id);

-- Activity log (audit trail)
CREATE TABLE warehouse.activity_log (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action warehouse.activity_action_enum NOT NULL,
    entity_type warehouse.activity_entity_enum NOT NULL,
    entity_id uuid NOT NULL,
    entity_name VARCHAR(200),
    changes JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE warehouse.activity_log IS
'Audit trail of all changes to warehouse data.';

COMMENT ON COLUMN warehouse.activity_log.entity_name IS
'Cached name of entity for display even after deletion.';

COMMENT ON COLUMN warehouse.activity_log.changes IS
'JSON object with changed fields: {"field": {"old": "value", "new": "value"}}';

CREATE INDEX ix_activity_log_workspace ON warehouse.activity_log(workspace_id);
CREATE INDEX ix_activity_log_user ON warehouse.activity_log(user_id);
CREATE INDEX ix_activity_log_entity ON warehouse.activity_log(entity_type, entity_id);
CREATE INDEX ix_activity_log_created ON warehouse.activity_log(created_at DESC);

-- Deleted records (tombstone table for PWA offline sync)
CREATE TABLE warehouse.deleted_records (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    entity_type warehouse.activity_entity_enum NOT NULL,
    entity_id uuid NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE warehouse.deleted_records IS
'Tombstone table tracking hard-deleted records for PWA offline sync.';

CREATE INDEX ix_deleted_records_workspace ON warehouse.deleted_records(workspace_id);
CREATE INDEX ix_deleted_records_workspace_since ON warehouse.deleted_records(workspace_id, deleted_at);

-- Import jobs
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

CREATE INDEX idx_import_jobs_workspace_id ON warehouse.import_jobs(workspace_id);
CREATE INDEX idx_import_jobs_user_id ON warehouse.import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON warehouse.import_jobs(status);
CREATE INDEX idx_import_jobs_created_at ON warehouse.import_jobs(created_at DESC);

-- Import errors
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

CREATE INDEX idx_import_errors_import_job_id ON warehouse.import_errors(import_job_id);

-- Pending changes (approval pipeline for member role)
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

CREATE INDEX idx_pending_changes_workspace_status ON warehouse.pending_changes (workspace_id, status);
CREATE INDEX idx_pending_changes_requester ON warehouse.pending_changes (requester_id);
CREATE INDEX idx_pending_changes_entity ON warehouse.pending_changes (entity_type, entity_id);

-- ============================================================================
-- Search Vector Triggers
-- ============================================================================

-- Trigger function for locations search vector
CREATE OR REPLACE FUNCTION warehouse.locations_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        coalesce(NEW.name, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.short_code, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_locations_search_vector
    BEFORE INSERT OR UPDATE ON warehouse.locations
    FOR EACH ROW EXECUTE FUNCTION warehouse.locations_search_vector_update();

-- Trigger function for containers search vector
CREATE OR REPLACE FUNCTION warehouse.containers_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        coalesce(NEW.name, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.short_code, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_containers_search_vector
    BEFORE INSERT OR UPDATE ON warehouse.containers
    FOR EACH ROW EXECUTE FUNCTION warehouse.containers_search_vector_update();

-- Trigger function for borrowers search vector
CREATE OR REPLACE FUNCTION warehouse.update_borrower_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.email, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.phone, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trgr_borrowers_search_vector
BEFORE INSERT OR UPDATE ON warehouse.borrowers
FOR EACH ROW
EXECUTE FUNCTION warehouse.update_borrower_search_vector();

-- ============================================================================
-- Loan Quantity Validation Trigger
-- ============================================================================
-- Ensures total loaned quantity never exceeds inventory quantity

CREATE OR REPLACE FUNCTION warehouse.validate_loan_quantity()
RETURNS TRIGGER AS $$
DECLARE
    available_qty INTEGER;
    total_loaned INTEGER;
    inventory_qty INTEGER;
BEGIN
    -- Get inventory quantity
    SELECT quantity INTO inventory_qty
    FROM warehouse.inventory
    WHERE id = NEW.inventory_id;

    -- Get total currently loaned (excluding this loan if updating)
    SELECT COALESCE(SUM(quantity), 0) INTO total_loaned
    FROM warehouse.loans
    WHERE inventory_id = NEW.inventory_id
        AND returned_at IS NULL
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    available_qty := inventory_qty - total_loaned;

    IF NEW.quantity > available_qty THEN
        RAISE EXCEPTION 'Loan quantity (%) exceeds available inventory (%)',
            NEW.quantity, available_qty;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_loan_quantity
    BEFORE INSERT OR UPDATE ON warehouse.loans
    FOR EACH ROW
    WHEN (NEW.returned_at IS NULL)
    EXECUTE FUNCTION warehouse.validate_loan_quantity();

-- ============================================================================
-- Archived Records View
-- ============================================================================
-- Aggregates all soft-deleted records for restoration UI

CREATE OR REPLACE VIEW warehouse.v_archived_records AS
SELECT
    'item' as entity_type,
    id,
    workspace_id,
    name,
    updated_at as archived_at
FROM warehouse.items WHERE is_archived = true

UNION ALL

SELECT
    'location' as entity_type,
    id,
    workspace_id,
    name,
    updated_at as archived_at
FROM warehouse.locations WHERE is_archived = true

UNION ALL

SELECT
    'container' as entity_type,
    id,
    workspace_id,
    name,
    updated_at as archived_at
FROM warehouse.containers WHERE is_archived = true

UNION ALL

SELECT
    'category' as entity_type,
    id,
    workspace_id,
    name,
    updated_at as archived_at
FROM warehouse.categories WHERE is_archived = true

UNION ALL

SELECT
    'company' as entity_type,
    id,
    workspace_id,
    name,
    updated_at as archived_at
FROM warehouse.companies WHERE is_archived = true

UNION ALL

SELECT
    'borrower' as entity_type,
    id,
    workspace_id,
    name,
    updated_at as archived_at
FROM warehouse.borrowers WHERE is_archived = true

UNION ALL

SELECT
    'label' as entity_type,
    id,
    workspace_id,
    name,
    updated_at as archived_at
FROM warehouse.labels WHERE is_archived = true

UNION ALL

SELECT
    'inventory' as entity_type,
    i.id,
    i.workspace_id,
    it.name,
    i.updated_at as archived_at
FROM warehouse.inventory i
JOIN warehouse.items it ON i.item_id = it.id
WHERE i.is_archived = true;

COMMENT ON VIEW warehouse.v_archived_records IS
'All soft-deleted records across entity types for restoration UI.';


-- migrate:down

DROP SCHEMA IF EXISTS warehouse CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
