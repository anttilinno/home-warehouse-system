\restrict ySrXVp5qo9VXxXR5bgNYL6KdwAeUz6yaodm0bv1ku343fP8jFYvf35C5S2WNi86

-- Dumped from database version 18.1 (Debian 18.1-1.pgdg13+2)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: warehouse; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA warehouse;


--
-- Name: notification_type_enum; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.notification_type_enum AS ENUM (
    'LOAN_DUE_SOON',
    'LOAN_OVERDUE',
    'LOAN_RETURNED',
    'LOW_STOCK',
    'WORKSPACE_INVITE',
    'MEMBER_JOINED',
    'SYSTEM'
);


--
-- Name: workspace_role_enum; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.workspace_role_enum AS ENUM (
    'owner',
    'admin',
    'member',
    'viewer'
);


--
-- Name: activity_action_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.activity_action_enum AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'MOVE',
    'LOAN',
    'RETURN'
);


--
-- Name: activity_entity_enum; Type: TYPE; Schema: warehouse; Owner: -
--

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


--
-- Name: attachment_type_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.attachment_type_enum AS ENUM (
    'PHOTO',
    'MANUAL',
    'RECEIPT',
    'WARRANTY',
    'OTHER'
);


--
-- Name: favorite_type_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.favorite_type_enum AS ENUM (
    'ITEM',
    'LOCATION',
    'CONTAINER'
);


--
-- Name: import_entity_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.import_entity_enum AS ENUM (
    'items',
    'inventory',
    'locations',
    'containers',
    'categories',
    'borrowers'
);


--
-- Name: import_status_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.import_status_enum AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: item_condition_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.item_condition_enum AS ENUM (
    'NEW',
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
    'DAMAGED',
    'FOR_REPAIR'
);


--
-- Name: item_status_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.item_status_enum AS ENUM (
    'AVAILABLE',
    'IN_USE',
    'RESERVED',
    'ON_LOAN',
    'IN_TRANSIT',
    'DISPOSED',
    'MISSING'
);


--
-- Name: pending_change_action_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.pending_change_action_enum AS ENUM (
    'create',
    'update',
    'delete'
);


--
-- Name: pending_change_status_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.pending_change_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: tag_type_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.tag_type_enum AS ENUM (
    'RFID',
    'NFC',
    'QR'
);


--
-- Name: containers_search_vector_update(); Type: FUNCTION; Schema: warehouse; Owner: -
--

CREATE FUNCTION warehouse.containers_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        coalesce(NEW.name, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.short_code, '')
    );
    RETURN NEW;
END;
$$;


--
-- Name: locations_search_vector_update(); Type: FUNCTION; Schema: warehouse; Owner: -
--

CREATE FUNCTION warehouse.locations_search_vector_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        coalesce(NEW.name, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.zone, '') || ' ' ||
        coalesce(NEW.shelf, '') || ' ' ||
        coalesce(NEW.bin, '') || ' ' ||
        coalesce(NEW.short_code, '')
    );
    RETURN NEW;
END;
$$;


--
-- Name: update_borrower_search_vector(); Type: FUNCTION; Schema: warehouse; Owner: -
--

CREATE FUNCTION warehouse.update_borrower_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.email, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.phone, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
    RETURN NEW;
END;
$$;


--
-- Name: validate_loan_quantity(); Type: FUNCTION; Schema: warehouse; Owner: -
--

CREATE FUNCTION warehouse.validate_loan_quantity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: notifications; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.notifications (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid,
    notification_type auth.notification_type_enum NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE notifications; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.notifications IS 'User notifications for various events in the system.';


--
-- Name: COLUMN notifications.metadata; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.notifications.metadata IS 'Additional data like entity IDs, links, etc. stored as JSON.';


--
-- Name: password_reset_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.password_reset_tokens (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE password_reset_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.password_reset_tokens IS 'Password reset tokens with expiration and one-time use.';


--
-- Name: user_oauth_accounts; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.user_oauth_accounts (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(20) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    email character varying(255),
    display_name character varying(100),
    avatar_url character varying(500),
    access_token text,
    refresh_token text,
    token_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_oauth_accounts; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.user_oauth_accounts IS 'External OAuth provider accounts linked to local users for SSO.';


--
-- Name: COLUMN user_oauth_accounts.access_token; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.user_oauth_accounts.access_token IS 'OAuth access token. Must be encrypted at application layer.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    id uuid DEFAULT uuidv7() NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    is_superuser boolean DEFAULT false,
    date_format character varying(20) DEFAULT 'DD.MM.YYYY'::character varying,
    language character varying(5) DEFAULT 'en'::character varying NOT NULL,
    theme character varying(20) DEFAULT 'system'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN users.date_format; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.date_format IS 'User''s preferred date format for display (e.g., DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD)';


--
-- Name: COLUMN users.language; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.language IS 'User''s preferred language code (e.g., en, fi, de)';


--
-- Name: COLUMN users.theme; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.theme IS 'User''s preferred UI theme: light, dark, or system';


--
-- Name: workspace_docspell_settings; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.workspace_docspell_settings (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    base_url character varying(500) NOT NULL,
    collective_name character varying(100) NOT NULL,
    username character varying(100) NOT NULL,
    password_encrypted text NOT NULL,
    sync_tags_enabled boolean DEFAULT false,
    is_enabled boolean DEFAULT true,
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE workspace_docspell_settings; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.workspace_docspell_settings IS 'Per-workspace Docspell integration configuration. Each workspace can connect to a different Docspell instance.';


--
-- Name: COLUMN workspace_docspell_settings.collective_name; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.workspace_docspell_settings.collective_name IS 'Docspell collective name - equivalent to a tenant/organization in Docspell.';


--
-- Name: COLUMN workspace_docspell_settings.password_encrypted; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.workspace_docspell_settings.password_encrypted IS 'Encrypted password for Docspell authentication. Encrypted at application layer using Fernet.';


--
-- Name: workspace_exports; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.workspace_exports (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    exported_by uuid,
    format character varying(10) NOT NULL,
    file_size_bytes bigint,
    record_counts jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE workspace_exports; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.workspace_exports IS 'Audit log of workspace data exports for backup or migration.';


--
-- Name: COLUMN workspace_exports.record_counts; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.workspace_exports.record_counts IS 'Snapshot of how many records were exported per table, stored as JSON.';


--
-- Name: workspace_members; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.workspace_members (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role auth.workspace_role_enum DEFAULT 'member'::auth.workspace_role_enum NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE workspace_members; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.workspace_members IS 'Links users to workspaces with role-based access control.';


--
-- Name: workspaces; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.workspaces (
    id uuid DEFAULT uuidv7() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(50) NOT NULL,
    description text,
    is_personal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE workspaces; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.workspaces IS 'Isolated environments for organizing inventory. Each workspace has its own locations, items, etc.';


--
-- Name: COLUMN workspaces.slug; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.workspaces.slug IS 'URL-friendly identifier (e.g., "my-home", "office"). Used in URLs like /w/my-home/items';


--
-- Name: COLUMN workspaces.is_personal; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.workspaces.is_personal IS 'Whether this is a user''s personal workspace created during registration.';


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: activity_log; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.activity_log (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    action warehouse.activity_action_enum NOT NULL,
    entity_type warehouse.activity_entity_enum NOT NULL,
    entity_id uuid NOT NULL,
    entity_name character varying(200),
    changes jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE activity_log; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON TABLE warehouse.activity_log IS 'Audit trail of all changes to warehouse data.';


--
-- Name: COLUMN activity_log.entity_name; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.activity_log.entity_name IS 'Cached name of entity for display even after deletion.';


--
-- Name: COLUMN activity_log.changes; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.activity_log.changes IS 'JSON object with changed fields: {"field": {"old": "value", "new": "value"}}';


--
-- Name: attachments; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.attachments (
    id uuid DEFAULT uuidv7() NOT NULL,
    item_id uuid NOT NULL,
    file_id uuid,
    attachment_type warehouse.attachment_type_enum NOT NULL,
    title character varying(200),
    is_primary boolean DEFAULT false,
    docspell_item_id character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attachments_has_reference CHECK (((file_id IS NOT NULL) OR (docspell_item_id IS NOT NULL)))
);


--
-- Name: COLUMN attachments.title; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.attachments.title IS 'Optional short description. Falls back to file.original_name if not provided.';


--
-- Name: COLUMN attachments.docspell_item_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.attachments.docspell_item_id IS 'Reference to Docspell item ID. When set, document is managed by Docspell and file_id may be NULL.';


--
-- Name: borrowers; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.borrowers (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    email character varying(255),
    phone character varying(50),
    notes text,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    search_vector tsvector
);


--
-- Name: categories; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.categories (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    parent_category_id uuid,
    description text,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: companies; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.companies (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    website character varying(500),
    notes text,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: container_tags; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.container_tags (
    id uuid DEFAULT uuidv7() NOT NULL,
    container_id uuid NOT NULL,
    tag_type warehouse.tag_type_enum NOT NULL,
    tag_value character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: containers; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.containers (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    location_id uuid NOT NULL,
    description text,
    capacity character varying(100),
    short_code character varying(8),
    is_archived boolean DEFAULT false NOT NULL,
    search_vector tsvector,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN containers.short_code; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.containers.short_code IS 'Short alphanumeric code for QR labels. Unique within workspace. Enables compact URLs for small label printers.';


--
-- Name: deleted_records; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.deleted_records (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    entity_type warehouse.activity_entity_enum NOT NULL,
    entity_id uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid
);


--
-- Name: TABLE deleted_records; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON TABLE warehouse.deleted_records IS 'Tombstone table tracking hard-deleted records for PWA offline sync.';


--
-- Name: favorites; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.favorites (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    favorite_type warehouse.favorite_type_enum NOT NULL,
    item_id uuid,
    location_id uuid,
    container_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT favorites_has_target CHECK ((((favorite_type = 'ITEM'::warehouse.favorite_type_enum) AND (item_id IS NOT NULL)) OR ((favorite_type = 'LOCATION'::warehouse.favorite_type_enum) AND (location_id IS NOT NULL)) OR ((favorite_type = 'CONTAINER'::warehouse.favorite_type_enum) AND (container_id IS NOT NULL))))
);


--
-- Name: TABLE favorites; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON TABLE warehouse.favorites IS 'User-pinned items, locations, or containers for quick access.';


--
-- Name: files; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.files (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    original_name character varying(255) NOT NULL,
    extension character varying(10),
    mime_type character varying(100),
    size_bytes bigint,
    checksum character varying(64),
    storage_key character varying(500),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN files.storage_key; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.files.storage_key IS 'Storage backend reference (S3 key, filesystem path, etc.)';


--
-- Name: import_errors; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.import_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_job_id uuid NOT NULL,
    row_number integer NOT NULL,
    field_name character varying(255),
    error_message text NOT NULL,
    row_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT import_errors_import_job_id_idx_check CHECK ((import_job_id IS NOT NULL))
);


--
-- Name: import_jobs; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    entity_type warehouse.import_entity_enum NOT NULL,
    status warehouse.import_status_enum DEFAULT 'pending'::warehouse.import_status_enum NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size_bytes bigint NOT NULL,
    total_rows integer,
    processed_rows integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    error_message text,
    CONSTRAINT import_jobs_workspace_id_idx_check CHECK ((workspace_id IS NOT NULL))
);


--
-- Name: inventory; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.inventory (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    item_id uuid NOT NULL,
    location_id uuid NOT NULL,
    container_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    condition warehouse.item_condition_enum,
    status warehouse.item_status_enum DEFAULT 'AVAILABLE'::warehouse.item_status_enum,
    date_acquired date,
    purchase_price integer,
    currency_code character varying(3) DEFAULT 'EUR'::character varying,
    warranty_expires date,
    expiration_date date,
    notes text,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_inventory_quantity_non_negative CHECK ((quantity >= 0))
);


--
-- Name: inventory_movements; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.inventory_movements (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    inventory_id uuid NOT NULL,
    from_location_id uuid,
    from_container_id uuid,
    to_location_id uuid,
    to_container_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    moved_by uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_movements_quantity_positive CHECK ((quantity > 0))
);


--
-- Name: item_labels; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.item_labels (
    item_id uuid NOT NULL,
    label_id uuid NOT NULL
);


--
-- Name: item_photos; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.item_photos (
    id uuid DEFAULT uuidv7() NOT NULL,
    item_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    storage_path character varying(500) NOT NULL,
    thumbnail_path character varying(500) NOT NULL,
    file_size bigint NOT NULL,
    mime_type character varying(100) NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    caption text,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: items; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.items (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    sku character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    category_id uuid,
    brand character varying(100),
    model character varying(100),
    image_url character varying(500),
    serial_number character varying(100),
    manufacturer character varying(100),
    barcode character varying(50),
    is_insured boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    lifetime_warranty boolean DEFAULT false,
    warranty_details text,
    purchased_from uuid,
    min_stock_level integer DEFAULT 0 NOT NULL,
    short_code character varying(8),
    obsidian_vault_path character varying(500),
    obsidian_note_path character varying(500),
    search_vector tsvector GENERATED ALWAYS AS ((((setweight(to_tsvector('english'::regconfig, (COALESCE(name, ''::character varying))::text), 'A'::"char") || setweight(to_tsvector('english'::regconfig, (COALESCE(brand, ''::character varying))::text), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, (COALESCE(model, ''::character varying))::text), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_items_min_stock_non_negative CHECK ((min_stock_level >= 0))
);


--
-- Name: COLUMN items.barcode; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.barcode IS 'UPC/EAN/other product barcode for scanning.';


--
-- Name: COLUMN items.min_stock_level; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.min_stock_level IS 'Threshold for LOW_STOCK notifications. When total inventory falls below this, trigger alert.';


--
-- Name: COLUMN items.short_code; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.short_code IS 'Short alphanumeric code for QR labels. Unique within workspace. Enables compact URLs for small label printers.';


--
-- Name: COLUMN items.obsidian_vault_path; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.obsidian_vault_path IS 'Local path to Obsidian vault for linking notes.';


--
-- Name: COLUMN items.obsidian_note_path; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.obsidian_note_path IS 'Relative path to note within vault.';


--
-- Name: labels; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.labels (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7),
    description text,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: loans; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.loans (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    inventory_id uuid NOT NULL,
    borrower_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    loaned_at timestamp with time zone DEFAULT now(),
    due_date date,
    returned_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_loans_quantity_limit CHECK ((quantity <= 1000)),
    CONSTRAINT chk_loans_quantity_positive CHECK ((quantity > 0))
);


--
-- Name: locations; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.locations (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    parent_location uuid,
    zone character varying(50),
    shelf character varying(50),
    bin character varying(50),
    description text,
    short_code character varying(8),
    is_archived boolean DEFAULT false NOT NULL,
    search_vector tsvector,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN locations.short_code; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.locations.short_code IS 'Short alphanumeric code for QR labels. Unique within workspace. Enables compact URLs for small label printers.';


--
-- Name: pending_changes; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.pending_changes (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid,
    action warehouse.pending_change_action_enum NOT NULL,
    payload jsonb NOT NULL,
    status warehouse.pending_change_status_enum DEFAULT 'pending'::warehouse.pending_change_status_enum NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_archived_records; Type: VIEW; Schema: warehouse; Owner: -
--

CREATE VIEW warehouse.v_archived_records AS
 SELECT 'item'::text AS entity_type,
    items.id,
    items.workspace_id,
    items.name,
    items.updated_at AS archived_at
   FROM warehouse.items
  WHERE (items.is_archived = true)
UNION ALL
 SELECT 'location'::text AS entity_type,
    locations.id,
    locations.workspace_id,
    locations.name,
    locations.updated_at AS archived_at
   FROM warehouse.locations
  WHERE (locations.is_archived = true)
UNION ALL
 SELECT 'container'::text AS entity_type,
    containers.id,
    containers.workspace_id,
    containers.name,
    containers.updated_at AS archived_at
   FROM warehouse.containers
  WHERE (containers.is_archived = true)
UNION ALL
 SELECT 'category'::text AS entity_type,
    categories.id,
    categories.workspace_id,
    categories.name,
    categories.updated_at AS archived_at
   FROM warehouse.categories
  WHERE (categories.is_archived = true)
UNION ALL
 SELECT 'company'::text AS entity_type,
    companies.id,
    companies.workspace_id,
    companies.name,
    companies.updated_at AS archived_at
   FROM warehouse.companies
  WHERE (companies.is_archived = true)
UNION ALL
 SELECT 'borrower'::text AS entity_type,
    borrowers.id,
    borrowers.workspace_id,
    borrowers.name,
    borrowers.updated_at AS archived_at
   FROM warehouse.borrowers
  WHERE (borrowers.is_archived = true)
UNION ALL
 SELECT 'label'::text AS entity_type,
    labels.id,
    labels.workspace_id,
    labels.name,
    labels.updated_at AS archived_at
   FROM warehouse.labels
  WHERE (labels.is_archived = true)
UNION ALL
 SELECT 'inventory'::text AS entity_type,
    i.id,
    i.workspace_id,
    it.name,
    i.updated_at AS archived_at
   FROM (warehouse.inventory i
     JOIN warehouse.items it ON ((i.item_id = it.id)))
  WHERE (i.is_archived = true);


--
-- Name: VIEW v_archived_records; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON VIEW warehouse.v_archived_records IS 'All soft-deleted records across entity types for restoration UI.';


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_oauth_accounts user_oauth_accounts_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_oauth_accounts
    ADD CONSTRAINT user_oauth_accounts_pkey PRIMARY KEY (id);


--
-- Name: user_oauth_accounts user_oauth_accounts_provider_provider_user_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_oauth_accounts
    ADD CONSTRAINT user_oauth_accounts_provider_provider_user_id_key UNIQUE (provider, provider_user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workspace_docspell_settings workspace_docspell_settings_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_docspell_settings
    ADD CONSTRAINT workspace_docspell_settings_pkey PRIMARY KEY (id);


--
-- Name: workspace_docspell_settings workspace_docspell_settings_workspace_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_docspell_settings
    ADD CONSTRAINT workspace_docspell_settings_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspace_exports workspace_exports_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_exports
    ADD CONSTRAINT workspace_exports_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_slug_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspaces
    ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: borrowers borrowers_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.borrowers
    ADD CONSTRAINT borrowers_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_workspace_id_name_key; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.companies
    ADD CONSTRAINT companies_workspace_id_name_key UNIQUE (workspace_id, name);


--
-- Name: container_tags container_tags_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.container_tags
    ADD CONSTRAINT container_tags_pkey PRIMARY KEY (id);


--
-- Name: container_tags container_tags_tag_value_key; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.container_tags
    ADD CONSTRAINT container_tags_tag_value_key UNIQUE (tag_value);


--
-- Name: containers containers_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.containers
    ADD CONSTRAINT containers_pkey PRIMARY KEY (id);


--
-- Name: deleted_records deleted_records_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.deleted_records
    ADD CONSTRAINT deleted_records_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_unique_container; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_unique_container UNIQUE (user_id, container_id);


--
-- Name: favorites favorites_unique_item; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_unique_item UNIQUE (user_id, item_id);


--
-- Name: favorites favorites_unique_location; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_unique_location UNIQUE (user_id, location_id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: import_errors import_errors_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.import_errors
    ADD CONSTRAINT import_errors_pkey PRIMARY KEY (id);


--
-- Name: import_jobs import_jobs_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: item_labels item_labels_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.item_labels
    ADD CONSTRAINT item_labels_pkey PRIMARY KEY (item_id, label_id);


--
-- Name: item_photos item_photos_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.item_photos
    ADD CONSTRAINT item_photos_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: items items_workspace_id_sku_key; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT items_workspace_id_sku_key UNIQUE (workspace_id, sku);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: labels labels_workspace_id_name_key; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.labels
    ADD CONSTRAINT labels_workspace_id_name_key UNIQUE (workspace_id, name);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: pending_changes pending_changes_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.pending_changes
    ADD CONSTRAINT pending_changes_pkey PRIMARY KEY (id);


--
-- Name: containers uq_containers_workspace_short_code; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.containers
    ADD CONSTRAINT uq_containers_workspace_short_code UNIQUE (workspace_id, short_code);


--
-- Name: items uq_items_workspace_short_code; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT uq_items_workspace_short_code UNIQUE (workspace_id, short_code);


--
-- Name: locations uq_locations_workspace_short_code; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.locations
    ADD CONSTRAINT uq_locations_workspace_short_code UNIQUE (workspace_id, short_code);


--
-- Name: ix_notifications_created; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_notifications_created ON auth.notifications USING btree (created_at DESC);


--
-- Name: ix_notifications_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_notifications_user ON auth.notifications USING btree (user_id);


--
-- Name: ix_notifications_user_unread; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_notifications_user_unread ON auth.notifications USING btree (user_id) WHERE (is_read = false);


--
-- Name: ix_notifications_workspace; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_notifications_workspace ON auth.notifications USING btree (workspace_id);


--
-- Name: ix_oauth_accounts_provider; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_oauth_accounts_provider ON auth.user_oauth_accounts USING btree (provider, provider_user_id);


--
-- Name: ix_oauth_accounts_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_oauth_accounts_user ON auth.user_oauth_accounts USING btree (user_id);


--
-- Name: ix_password_reset_tokens_hash; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_password_reset_tokens_hash ON auth.password_reset_tokens USING btree (token_hash);


--
-- Name: ix_password_reset_tokens_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_password_reset_tokens_user ON auth.password_reset_tokens USING btree (user_id);


--
-- Name: ix_workspace_docspell_settings_workspace; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspace_docspell_settings_workspace ON auth.workspace_docspell_settings USING btree (workspace_id);


--
-- Name: ix_workspace_exports_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspace_exports_user ON auth.workspace_exports USING btree (exported_by);


--
-- Name: ix_workspace_exports_workspace; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspace_exports_workspace ON auth.workspace_exports USING btree (workspace_id);


--
-- Name: ix_workspace_members_invited_by; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspace_members_invited_by ON auth.workspace_members USING btree (invited_by) WHERE (invited_by IS NOT NULL);


--
-- Name: ix_workspace_members_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspace_members_user ON auth.workspace_members USING btree (user_id);


--
-- Name: ix_workspace_members_workspace; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspace_members_workspace ON auth.workspace_members USING btree (workspace_id);


--
-- Name: ix_workspaces_slug; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspaces_slug ON auth.workspaces USING btree (slug);


--
-- Name: idx_import_errors_import_job_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_import_errors_import_job_id ON warehouse.import_errors USING btree (import_job_id);


--
-- Name: idx_import_jobs_created_at; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_import_jobs_created_at ON warehouse.import_jobs USING btree (created_at DESC);


--
-- Name: idx_import_jobs_status; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_import_jobs_status ON warehouse.import_jobs USING btree (status);


--
-- Name: idx_import_jobs_user_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_import_jobs_user_id ON warehouse.import_jobs USING btree (user_id);


--
-- Name: idx_import_jobs_workspace_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_import_jobs_workspace_id ON warehouse.import_jobs USING btree (workspace_id);


--
-- Name: idx_item_photos_item; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_item_photos_item ON warehouse.item_photos USING btree (item_id, display_order);


--
-- Name: idx_item_photos_primary; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE UNIQUE INDEX idx_item_photos_primary ON warehouse.item_photos USING btree (item_id, is_primary) WHERE (is_primary = true);


--
-- Name: idx_item_photos_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_item_photos_workspace ON warehouse.item_photos USING btree (workspace_id);


--
-- Name: idx_pending_changes_entity; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_pending_changes_entity ON warehouse.pending_changes USING btree (entity_type, entity_id);


--
-- Name: idx_pending_changes_requester; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_pending_changes_requester ON warehouse.pending_changes USING btree (requester_id);


--
-- Name: idx_pending_changes_workspace_status; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX idx_pending_changes_workspace_status ON warehouse.pending_changes USING btree (workspace_id, status);


--
-- Name: ix_activity_log_created; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_activity_log_created ON warehouse.activity_log USING btree (created_at DESC);


--
-- Name: ix_activity_log_entity; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_activity_log_entity ON warehouse.activity_log USING btree (entity_type, entity_id);


--
-- Name: ix_activity_log_user; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_activity_log_user ON warehouse.activity_log USING btree (user_id);


--
-- Name: ix_activity_log_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_activity_log_workspace ON warehouse.activity_log USING btree (workspace_id);


--
-- Name: ix_attachments_docspell; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_attachments_docspell ON warehouse.attachments USING btree (docspell_item_id) WHERE (docspell_item_id IS NOT NULL);


--
-- Name: ix_attachments_file; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_attachments_file ON warehouse.attachments USING btree (file_id) WHERE (file_id IS NOT NULL);


--
-- Name: ix_attachments_item; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_attachments_item ON warehouse.attachments USING btree (item_id);


--
-- Name: ix_borrowers_active; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_borrowers_active ON warehouse.borrowers USING btree (workspace_id) WHERE (is_archived = false);


--
-- Name: ix_borrowers_search; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_borrowers_search ON warehouse.borrowers USING gin (search_vector);


--
-- Name: ix_borrowers_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_borrowers_workspace ON warehouse.borrowers USING btree (workspace_id);


--
-- Name: ix_categories_active; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_categories_active ON warehouse.categories USING btree (workspace_id, parent_category_id) WHERE (is_archived = false);


--
-- Name: ix_categories_name; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_categories_name ON warehouse.categories USING btree (name);


--
-- Name: ix_categories_parent; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_categories_parent ON warehouse.categories USING btree (parent_category_id);


--
-- Name: ix_categories_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_categories_workspace ON warehouse.categories USING btree (workspace_id);


--
-- Name: ix_companies_active; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_companies_active ON warehouse.companies USING btree (workspace_id) WHERE (is_archived = false);


--
-- Name: ix_companies_name; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_companies_name ON warehouse.companies USING btree (name);


--
-- Name: ix_companies_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_companies_workspace ON warehouse.companies USING btree (workspace_id);


--
-- Name: ix_container_tags_container_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_container_tags_container_id ON warehouse.container_tags USING btree (container_id);


--
-- Name: ix_containers_active; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_active ON warehouse.containers USING btree (workspace_id, location_id) WHERE (is_archived = false);


--
-- Name: ix_containers_location_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_location_id ON warehouse.containers USING btree (location_id);


--
-- Name: ix_containers_name; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_name ON warehouse.containers USING btree (name);


--
-- Name: ix_containers_search; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_search ON warehouse.containers USING gin (search_vector);


--
-- Name: ix_containers_short_code; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_short_code ON warehouse.containers USING btree (short_code) WHERE (short_code IS NOT NULL);


--
-- Name: ix_containers_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_workspace ON warehouse.containers USING btree (workspace_id);


--
-- Name: ix_deleted_records_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_deleted_records_workspace ON warehouse.deleted_records USING btree (workspace_id);


--
-- Name: ix_deleted_records_workspace_since; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_deleted_records_workspace_since ON warehouse.deleted_records USING btree (workspace_id, deleted_at);


--
-- Name: ix_favorites_user; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_favorites_user ON warehouse.favorites USING btree (user_id);


--
-- Name: ix_favorites_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_favorites_workspace ON warehouse.favorites USING btree (workspace_id);


--
-- Name: ix_files_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_files_workspace ON warehouse.files USING btree (workspace_id);


--
-- Name: ix_inventory_active; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_active ON warehouse.inventory USING btree (workspace_id, item_id, location_id) WHERE (is_archived = false);


--
-- Name: ix_inventory_available; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_available ON warehouse.inventory USING btree (workspace_id, item_id) WHERE (status = 'AVAILABLE'::warehouse.item_status_enum);


--
-- Name: ix_inventory_container_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_container_id ON warehouse.inventory USING btree (container_id);


--
-- Name: ix_inventory_item_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_item_id ON warehouse.inventory USING btree (item_id);


--
-- Name: ix_inventory_location_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_location_id ON warehouse.inventory USING btree (location_id);


--
-- Name: ix_inventory_movements_date; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_movements_date ON warehouse.inventory_movements USING btree (created_at);


--
-- Name: ix_inventory_movements_inventory; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_movements_inventory ON warehouse.inventory_movements USING btree (inventory_id);


--
-- Name: ix_inventory_movements_moved_by; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_movements_moved_by ON warehouse.inventory_movements USING btree (moved_by) WHERE (moved_by IS NOT NULL);


--
-- Name: ix_inventory_movements_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_movements_workspace ON warehouse.inventory_movements USING btree (workspace_id);


--
-- Name: ix_inventory_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_workspace ON warehouse.inventory USING btree (workspace_id);


--
-- Name: ix_items_active; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_active ON warehouse.items USING btree (workspace_id, name) WHERE (is_archived = false);


--
-- Name: ix_items_barcode; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_barcode ON warehouse.items USING btree (workspace_id, barcode) WHERE (barcode IS NOT NULL);


--
-- Name: ix_items_category_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_category_id ON warehouse.items USING btree (category_id);


--
-- Name: ix_items_name; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_name ON warehouse.items USING btree (name);


--
-- Name: ix_items_purchased_from; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_purchased_from ON warehouse.items USING btree (purchased_from) WHERE (purchased_from IS NOT NULL);


--
-- Name: ix_items_search; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_search ON warehouse.items USING gin (search_vector);


--
-- Name: ix_items_short_code; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_short_code ON warehouse.items USING btree (short_code) WHERE (short_code IS NOT NULL);


--
-- Name: ix_items_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_workspace ON warehouse.items USING btree (workspace_id);


--
-- Name: ix_labels_active; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_labels_active ON warehouse.labels USING btree (workspace_id) WHERE (is_archived = false);


--
-- Name: ix_labels_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_labels_workspace ON warehouse.labels USING btree (workspace_id);


--
-- Name: ix_loans_active_inventory; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE UNIQUE INDEX ix_loans_active_inventory ON warehouse.loans USING btree (inventory_id) WHERE (returned_at IS NULL);


--
-- Name: ix_loans_borrower_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_loans_borrower_id ON warehouse.loans USING btree (borrower_id);


--
-- Name: ix_loans_inventory_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_loans_inventory_id ON warehouse.loans USING btree (inventory_id);


--
-- Name: ix_loans_outstanding; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_loans_outstanding ON warehouse.loans USING btree (workspace_id, borrower_id, due_date) WHERE (returned_at IS NULL);


--
-- Name: ix_loans_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_loans_workspace ON warehouse.loans USING btree (workspace_id);


--
-- Name: ix_locations_active; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_active ON warehouse.locations USING btree (workspace_id, parent_location) WHERE (is_archived = false);


--
-- Name: ix_locations_name; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_name ON warehouse.locations USING btree (name);


--
-- Name: ix_locations_parent_location; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_parent_location ON warehouse.locations USING btree (parent_location);


--
-- Name: ix_locations_search; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_search ON warehouse.locations USING gin (search_vector);


--
-- Name: ix_locations_short_code; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_short_code ON warehouse.locations USING btree (short_code) WHERE (short_code IS NOT NULL);


--
-- Name: ix_locations_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_workspace ON warehouse.locations USING btree (workspace_id);


--
-- Name: containers trg_containers_search_vector; Type: TRIGGER; Schema: warehouse; Owner: -
--

CREATE TRIGGER trg_containers_search_vector BEFORE INSERT OR UPDATE ON warehouse.containers FOR EACH ROW EXECUTE FUNCTION warehouse.containers_search_vector_update();


--
-- Name: locations trg_locations_search_vector; Type: TRIGGER; Schema: warehouse; Owner: -
--

CREATE TRIGGER trg_locations_search_vector BEFORE INSERT OR UPDATE ON warehouse.locations FOR EACH ROW EXECUTE FUNCTION warehouse.locations_search_vector_update();


--
-- Name: loans trg_validate_loan_quantity; Type: TRIGGER; Schema: warehouse; Owner: -
--

CREATE TRIGGER trg_validate_loan_quantity BEFORE INSERT OR UPDATE ON warehouse.loans FOR EACH ROW WHEN ((new.returned_at IS NULL)) EXECUTE FUNCTION warehouse.validate_loan_quantity();


--
-- Name: borrowers trgr_borrowers_search_vector; Type: TRIGGER; Schema: warehouse; Owner: -
--

CREATE TRIGGER trgr_borrowers_search_vector BEFORE INSERT OR UPDATE ON warehouse.borrowers FOR EACH ROW EXECUTE FUNCTION warehouse.update_borrower_search_vector();


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_workspace_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.notifications
    ADD CONSTRAINT notifications_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_oauth_accounts user_oauth_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_oauth_accounts
    ADD CONSTRAINT user_oauth_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_docspell_settings workspace_docspell_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_docspell_settings
    ADD CONSTRAINT workspace_docspell_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_exports workspace_exports_exported_by_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_exports
    ADD CONSTRAINT workspace_exports_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: workspace_exports workspace_exports_workspace_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_exports
    ADD CONSTRAINT workspace_exports_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_members
    ADD CONSTRAINT workspace_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: activity_log activity_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.activity_log
    ADD CONSTRAINT activity_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_file_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.attachments
    ADD CONSTRAINT attachments_file_id_fkey FOREIGN KEY (file_id) REFERENCES warehouse.files(id) ON DELETE CASCADE;


--
-- Name: attachments attachments_item_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.attachments
    ADD CONSTRAINT attachments_item_id_fkey FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;


--
-- Name: borrowers borrowers_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.borrowers
    ADD CONSTRAINT borrowers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_category_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.categories
    ADD CONSTRAINT categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES warehouse.categories(id) ON DELETE SET NULL;


--
-- Name: categories categories_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.categories
    ADD CONSTRAINT categories_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: companies companies_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.companies
    ADD CONSTRAINT companies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: container_tags container_tags_container_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.container_tags
    ADD CONSTRAINT container_tags_container_id_fkey FOREIGN KEY (container_id) REFERENCES warehouse.containers(id) ON DELETE CASCADE;


--
-- Name: containers containers_location_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.containers
    ADD CONSTRAINT containers_location_id_fkey FOREIGN KEY (location_id) REFERENCES warehouse.locations(id) ON DELETE CASCADE;


--
-- Name: containers containers_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.containers
    ADD CONSTRAINT containers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: deleted_records deleted_records_deleted_by_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.deleted_records
    ADD CONSTRAINT deleted_records_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: deleted_records deleted_records_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.deleted_records
    ADD CONSTRAINT deleted_records_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_container_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_container_id_fkey FOREIGN KEY (container_id) REFERENCES warehouse.containers(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_item_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_item_id_fkey FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_location_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_location_id_fkey FOREIGN KEY (location_id) REFERENCES warehouse.locations(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.favorites
    ADD CONSTRAINT favorites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: files files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.files
    ADD CONSTRAINT files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: files files_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.files
    ADD CONSTRAINT files_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: import_errors import_errors_import_job_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.import_errors
    ADD CONSTRAINT import_errors_import_job_id_fkey FOREIGN KEY (import_job_id) REFERENCES warehouse.import_jobs(id) ON DELETE CASCADE;


--
-- Name: import_jobs import_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.import_jobs
    ADD CONSTRAINT import_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: import_jobs import_jobs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.import_jobs
    ADD CONSTRAINT import_jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_container_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory
    ADD CONSTRAINT inventory_container_id_fkey FOREIGN KEY (container_id) REFERENCES warehouse.containers(id) ON DELETE SET NULL;


--
-- Name: inventory inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory
    ADD CONSTRAINT inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_location_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory
    ADD CONSTRAINT inventory_location_id_fkey FOREIGN KEY (location_id) REFERENCES warehouse.locations(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_from_container_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory_movements
    ADD CONSTRAINT inventory_movements_from_container_id_fkey FOREIGN KEY (from_container_id) REFERENCES warehouse.containers(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_from_location_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory_movements
    ADD CONSTRAINT inventory_movements_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES warehouse.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory_movements
    ADD CONSTRAINT inventory_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES warehouse.inventory(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_moved_by_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory_movements
    ADD CONSTRAINT inventory_movements_moved_by_fkey FOREIGN KEY (moved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_to_container_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory_movements
    ADD CONSTRAINT inventory_movements_to_container_id_fkey FOREIGN KEY (to_container_id) REFERENCES warehouse.containers(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_to_location_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory_movements
    ADD CONSTRAINT inventory_movements_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES warehouse.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory_movements
    ADD CONSTRAINT inventory_movements_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.inventory
    ADD CONSTRAINT inventory_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: item_labels item_labels_item_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.item_labels
    ADD CONSTRAINT item_labels_item_id_fkey FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;


--
-- Name: item_labels item_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.item_labels
    ADD CONSTRAINT item_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES warehouse.labels(id) ON DELETE CASCADE;


--
-- Name: item_photos item_photos_item_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.item_photos
    ADD CONSTRAINT item_photos_item_id_fkey FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;


--
-- Name: item_photos item_photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.item_photos
    ADD CONSTRAINT item_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);


--
-- Name: item_photos item_photos_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.item_photos
    ADD CONSTRAINT item_photos_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: items items_category_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT items_category_id_fkey FOREIGN KEY (category_id) REFERENCES warehouse.categories(id) ON DELETE SET NULL;


--
-- Name: items items_purchased_from_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT items_purchased_from_fkey FOREIGN KEY (purchased_from) REFERENCES warehouse.companies(id) ON DELETE SET NULL;


--
-- Name: items items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: labels labels_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.labels
    ADD CONSTRAINT labels_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: loans loans_borrower_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.loans
    ADD CONSTRAINT loans_borrower_id_fkey FOREIGN KEY (borrower_id) REFERENCES warehouse.borrowers(id) ON DELETE RESTRICT;


--
-- Name: loans loans_inventory_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.loans
    ADD CONSTRAINT loans_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES warehouse.inventory(id) ON DELETE CASCADE;


--
-- Name: loans loans_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.loans
    ADD CONSTRAINT loans_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: locations locations_parent_location_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.locations
    ADD CONSTRAINT locations_parent_location_fkey FOREIGN KEY (parent_location) REFERENCES warehouse.locations(id) ON DELETE SET NULL;


--
-- Name: locations locations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.locations
    ADD CONSTRAINT locations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- Name: pending_changes pending_changes_requester_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.pending_changes
    ADD CONSTRAINT pending_changes_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pending_changes pending_changes_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.pending_changes
    ADD CONSTRAINT pending_changes_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: pending_changes pending_changes_workspace_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.pending_changes
    ADD CONSTRAINT pending_changes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ySrXVp5qo9VXxXR5bgNYL6KdwAeUz6yaodm0bv1ku343fP8jFYvf35C5S2WNi86


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('001'),
    ('20260115195916'),
    ('20260116155543'),
    ('20260116192313'),
    ('20260116204232');
