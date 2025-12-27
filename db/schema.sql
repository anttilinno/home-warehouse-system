\restrict IrvZBWL577UpA5gLFu7Q5A5hEf0osdRt4kuliQ41zLZzYIjku6nbE01djQwThh1

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
-- Name: tag_type_enum; Type: TYPE; Schema: warehouse; Owner: -
--

CREATE TYPE warehouse.tag_type_enum AS ENUM (
    'RFID',
    'NFC',
    'QR'
);


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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    date_format character varying(20) DEFAULT 'DD.MM.YYYY'::character varying
);


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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_personal boolean DEFAULT false NOT NULL
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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN containers.short_code; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.containers.short_code IS 'Short alphanumeric code for QR labels. Enables compact URLs for small label printers.';


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
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT inventory_quantity_check CHECK ((quantity >= 0))
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
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: item_labels; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.item_labels (
    item_id uuid NOT NULL,
    label_id uuid NOT NULL
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
    is_insured boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    lifetime_warranty boolean DEFAULT false,
    warranty_details text,
    purchased_from uuid,
    short_code character varying(8),
    search_vector tsvector GENERATED ALWAYS AS ((((setweight(to_tsvector('english'::regconfig, (COALESCE(name, ''::character varying))::text), 'A'::"char") || setweight(to_tsvector('english'::regconfig, (COALESCE(brand, ''::character varying))::text), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, (COALESCE(model, ''::character varying))::text), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN items.short_code; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.short_code IS 'Short alphanumeric code for QR labels. Enables compact URLs for small label printers.';


--
-- Name: labels; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.labels (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(7),
    description text,
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
    updated_at timestamp with time zone DEFAULT now()
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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: COLUMN locations.short_code; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.locations.short_code IS 'Short alphanumeric code for QR labels. Enables compact URLs for small label printers.';


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


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
-- Name: containers containers_short_code_key; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.containers
    ADD CONSTRAINT containers_short_code_key UNIQUE (short_code);


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
-- Name: items items_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: items items_short_code_key; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT items_short_code_key UNIQUE (short_code);


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
-- Name: locations locations_short_code_key; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.locations
    ADD CONSTRAINT locations_short_code_key UNIQUE (short_code);


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
-- Name: ix_workspace_exports_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspace_exports_user ON auth.workspace_exports USING btree (exported_by);


--
-- Name: ix_workspace_exports_workspace; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX ix_workspace_exports_workspace ON auth.workspace_exports USING btree (workspace_id);


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

CREATE INDEX ix_attachments_file ON warehouse.attachments USING btree (file_id);


--
-- Name: ix_attachments_item; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_attachments_item ON warehouse.attachments USING btree (item_id);


--
-- Name: ix_borrowers_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_borrowers_workspace ON warehouse.borrowers USING btree (workspace_id);


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
-- Name: ix_containers_location_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_location_id ON warehouse.containers USING btree (location_id);


--
-- Name: ix_containers_name; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_name ON warehouse.containers USING btree (name);


--
-- Name: ix_containers_short_code; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_short_code ON warehouse.containers USING btree (short_code);


--
-- Name: ix_containers_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_containers_workspace ON warehouse.containers USING btree (workspace_id);


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
-- Name: ix_inventory_movements_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_movements_workspace ON warehouse.inventory_movements USING btree (workspace_id);


--
-- Name: ix_inventory_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_inventory_workspace ON warehouse.inventory USING btree (workspace_id);


--
-- Name: ix_items_category_id; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_category_id ON warehouse.items USING btree (category_id);


--
-- Name: ix_items_name; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_name ON warehouse.items USING btree (name);


--
-- Name: ix_items_search; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_search ON warehouse.items USING gin (search_vector);


--
-- Name: ix_items_short_code; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_short_code ON warehouse.items USING btree (short_code);


--
-- Name: ix_items_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_items_workspace ON warehouse.items USING btree (workspace_id);


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
-- Name: ix_loans_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_loans_workspace ON warehouse.loans USING btree (workspace_id);


--
-- Name: ix_locations_name; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_name ON warehouse.locations USING btree (name);


--
-- Name: ix_locations_parent_location; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_parent_location ON warehouse.locations USING btree (parent_location);


--
-- Name: ix_locations_short_code; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_short_code ON warehouse.locations USING btree (short_code);


--
-- Name: ix_locations_workspace; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX ix_locations_workspace ON warehouse.locations USING btree (workspace_id);


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
-- Name: user_oauth_accounts user_oauth_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.user_oauth_accounts
    ADD CONSTRAINT user_oauth_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- PostgreSQL database dump complete
--

\unrestrict IrvZBWL577UpA5gLFu7Q5A5hEf0osdRt4kuliQ41zLZzYIjku6nbE01djQwThh1


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('001'),
    ('002'),
    ('20251223201614'),
    ('20251227121316');
