-- migrate:up

-- ============================================================================
-- Housekeeping bundle (audit B7)
-- ============================================================================
-- Boolean nullability, value CHECKs, index diet, UUID default consistency,
-- and removal of cargo-cult constraints.

-- ----------------------------------------------------------------------------
-- Normalize nullable booleans (backfill NULLs first, then NOT NULL + default)
-- ----------------------------------------------------------------------------
UPDATE warehouse.items SET is_archived = false WHERE is_archived IS NULL;
UPDATE warehouse.items SET is_insured = false WHERE is_insured IS NULL;
ALTER TABLE warehouse.items
    ALTER COLUMN is_archived SET NOT NULL,
    ALTER COLUMN is_archived SET DEFAULT false,
    ALTER COLUMN is_insured SET NOT NULL,
    ALTER COLUMN is_insured SET DEFAULT false;

UPDATE auth.users SET is_active = true WHERE is_active IS NULL;
UPDATE auth.users SET is_superuser = false WHERE is_superuser IS NULL;
ALTER TABLE auth.users
    ALTER COLUMN is_active SET NOT NULL,
    ALTER COLUMN is_active SET DEFAULT true,
    ALTER COLUMN is_superuser SET NOT NULL,
    ALTER COLUMN is_superuser SET DEFAULT false;

UPDATE auth.notifications SET is_read = false WHERE is_read IS NULL;
ALTER TABLE auth.notifications
    ALTER COLUMN is_read SET NOT NULL,
    ALTER COLUMN is_read SET DEFAULT false;

-- ----------------------------------------------------------------------------
-- Money & enum-ish guards
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.inventory
    ADD CONSTRAINT chk_inventory_price_nonneg
        CHECK (purchase_price IS NULL OR purchase_price >= 0),
    ADD CONSTRAINT chk_inventory_currency
        CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$');

ALTER TABLE warehouse.repair_logs
    ADD CONSTRAINT chk_repair_logs_cost_nonneg
        CHECK (cost IS NULL OR cost >= 0),
    ADD CONSTRAINT chk_repair_logs_currency
        CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$');

ALTER TABLE warehouse.labels
    ADD CONSTRAINT chk_labels_color_hex
        CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');

-- ----------------------------------------------------------------------------
-- Index diet (audit A6)
-- ----------------------------------------------------------------------------
-- Leading-column duplicates of UNIQUE constraints or composite indexes:
DROP INDEX warehouse.ix_items_workspace;       -- ⊂ items_workspace_id_sku_key
DROP INDEX warehouse.ix_containers_workspace;  -- ⊂ uq_containers_workspace_short_code
DROP INDEX warehouse.ix_locations_workspace;   -- ⊂ uq_locations_workspace_short_code
DROP INDEX warehouse.ix_categories_workspace;  -- ⊂ ix_categories_active
DROP INDEX warehouse.ix_loans_inventory_id;    -- covered by ix_loans_active_inventory + ix_loans_outstanding
DROP INDEX auth.ix_workspace_docspell_settings_workspace; -- duplicates the UNIQUE constraint

-- Global name indexes (every query is workspace-scoped; these index across tenants):
DROP INDEX warehouse.ix_items_name;
DROP INDEX warehouse.ix_containers_name;
DROP INDEX warehouse.ix_locations_name;
DROP INDEX warehouse.ix_categories_name;
DROP INDEX warehouse.ix_companies_name;

-- Missing composites for "newest per workspace/user" list queries:
CREATE INDEX ix_activity_log_ws_created
    ON warehouse.activity_log (workspace_id, created_at DESC);
CREATE INDEX ix_inventory_movements_ws_created
    ON warehouse.inventory_movements (workspace_id, created_at DESC);
CREATE INDEX ix_notifications_user_created
    ON auth.notifications (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- UUID default consistency: uuidv7() everywhere (import tables used v4,
-- a random-write index pattern on the highest-churn append tables)
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.import_jobs   ALTER COLUMN id SET DEFAULT uuidv7();
ALTER TABLE warehouse.import_errors ALTER COLUMN id SET DEFAULT uuidv7();

-- ----------------------------------------------------------------------------
-- Drop cargo-cult CHECK constraints that duplicate NOT NULL
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.import_jobs   DROP CONSTRAINT import_jobs_workspace_id_idx_check;
ALTER TABLE warehouse.import_errors DROP CONSTRAINT import_errors_import_job_id_idx_check;

-- migrate:down

ALTER TABLE warehouse.import_errors
    ADD CONSTRAINT import_errors_import_job_id_idx_check CHECK (import_job_id IS NOT NULL);
ALTER TABLE warehouse.import_jobs
    ADD CONSTRAINT import_jobs_workspace_id_idx_check CHECK (workspace_id IS NOT NULL);

ALTER TABLE warehouse.import_jobs   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE warehouse.import_errors ALTER COLUMN id SET DEFAULT gen_random_uuid();

DROP INDEX warehouse.ix_activity_log_ws_created;
DROP INDEX warehouse.ix_inventory_movements_ws_created;
DROP INDEX auth.ix_notifications_user_created;

CREATE INDEX ix_items_workspace ON warehouse.items(workspace_id);
CREATE INDEX ix_containers_workspace ON warehouse.containers(workspace_id);
CREATE INDEX ix_locations_workspace ON warehouse.locations(workspace_id);
CREATE INDEX ix_categories_workspace ON warehouse.categories(workspace_id);
CREATE INDEX ix_loans_inventory_id ON warehouse.loans(inventory_id);
CREATE INDEX ix_workspace_docspell_settings_workspace ON auth.workspace_docspell_settings(workspace_id);
CREATE INDEX ix_items_name ON warehouse.items(name);
CREATE INDEX ix_containers_name ON warehouse.containers(name);
CREATE INDEX ix_locations_name ON warehouse.locations(name);
CREATE INDEX ix_categories_name ON warehouse.categories(name);
CREATE INDEX ix_companies_name ON warehouse.companies(name);

ALTER TABLE warehouse.labels      DROP CONSTRAINT chk_labels_color_hex;
ALTER TABLE warehouse.repair_logs DROP CONSTRAINT chk_repair_logs_cost_nonneg,
                                  DROP CONSTRAINT chk_repair_logs_currency;
ALTER TABLE warehouse.inventory   DROP CONSTRAINT chk_inventory_price_nonneg,
                                  DROP CONSTRAINT chk_inventory_currency;

ALTER TABLE auth.notifications
    ALTER COLUMN is_read DROP NOT NULL;
ALTER TABLE auth.users
    ALTER COLUMN is_active DROP NOT NULL,
    ALTER COLUMN is_superuser DROP NOT NULL;
ALTER TABLE warehouse.items
    ALTER COLUMN is_archived DROP NOT NULL,
    ALTER COLUMN is_insured DROP NOT NULL;
