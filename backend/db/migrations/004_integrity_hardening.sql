-- migrate:up

-- ============================================================================
-- Identity & integrity hardening (audit A4 / B5)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Case-insensitive emails (citext)
-- ----------------------------------------------------------------------------
-- Pre-check: if two accounts differ only by case, the citext UNIQUE rebuild
-- would fail mid-migration with an opaque duplicate-key error. Fail loudly
-- with the offending addresses instead — this needs a human decision about
-- which account to keep, not silent data munging.
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
DECLARE
    dup text;
BEGIN
    SELECT string_agg(lower_email, ', ') INTO dup
    FROM (
        SELECT lower(email) AS lower_email
        FROM auth.users
        GROUP BY lower(email)
        HAVING count(*) > 1
    ) d;
    IF dup IS NOT NULL THEN
        RAISE EXCEPTION 'cannot convert auth.users.email to citext: case-duplicate emails exist: %', dup;
    END IF;
END
$$;

ALTER TABLE auth.users ALTER COLUMN email TYPE citext;
-- borrowers.email has no unique constraint, so duplicates cannot block the
-- type change; convert for consistent case-insensitive comparisons.
ALTER TABLE warehouse.borrowers ALTER COLUMN email TYPE citext;

-- ----------------------------------------------------------------------------
-- Barcode determinism: unique per (workspace, barcode) for active items
-- ----------------------------------------------------------------------------
-- GetItemByBarcode is :one — duplicate barcodes in a workspace made the scan
-- endpoint nondeterministic. Resolution for existing duplicates (documented,
-- explicit): keep the barcode on the OLDEST active item per (workspace_id,
-- barcode); NULL it on the newer duplicates and flag them needs_review = true
-- so they surface in the review UI for a human to re-assign.
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY workspace_id, barcode
               ORDER BY created_at, id
           ) AS rn
    FROM warehouse.items
    WHERE barcode IS NOT NULL AND is_archived = false
)
UPDATE warehouse.items i
SET barcode = NULL,
    needs_review = true,
    updated_at = now()
FROM ranked r
WHERE i.id = r.id AND r.rn > 1;

DROP INDEX warehouse.ix_items_barcode;
CREATE UNIQUE INDEX uq_items_ws_barcode ON warehouse.items (workspace_id, barcode)
    WHERE barcode IS NOT NULL AND is_archived = false;

-- ----------------------------------------------------------------------------
-- Token tables: hashes must be unique (dedupe keeping the newest row first)
-- ----------------------------------------------------------------------------
DELETE FROM auth.user_sessions s
USING auth.user_sessions newer
WHERE s.refresh_token_hash = newer.refresh_token_hash
  AND s.created_at < newer.created_at;

ALTER TABLE auth.user_sessions
    ADD CONSTRAINT uq_user_sessions_token UNIQUE (refresh_token_hash);
DROP INDEX auth.idx_user_sessions_token_hash; -- superseded by the UNIQUE index

DELETE FROM auth.password_reset_tokens t
USING auth.password_reset_tokens newer
WHERE t.token_hash = newer.token_hash
  AND t.created_at < newer.created_at;

ALTER TABLE auth.password_reset_tokens
    ADD CONSTRAINT uq_password_reset_tokens_token UNIQUE (token_hash);
DROP INDEX auth.ix_password_reset_tokens_hash; -- superseded by the UNIQUE index

-- ----------------------------------------------------------------------------
-- Sync tombstones: one tombstone per entity (dedupe keeping the newest)
-- ----------------------------------------------------------------------------
DELETE FROM warehouse.deleted_records d
USING warehouse.deleted_records newer
WHERE d.workspace_id = newer.workspace_id
  AND d.entity_type = newer.entity_type
  AND d.entity_id = newer.entity_id
  AND (d.deleted_at < newer.deleted_at
       OR (d.deleted_at = newer.deleted_at AND d.id < newer.id));

ALTER TABLE warehouse.deleted_records
    ADD CONSTRAINT uq_deleted_records_entity UNIQUE (workspace_id, entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Cycle guards on tree tables (blocks 1-node self-cycles; deeper cycles are
-- an app-layer concern until/unless hierarchy queries grow)
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.categories
    ADD CONSTRAINT chk_categories_no_self_parent CHECK (parent_category_id <> id);
ALTER TABLE warehouse.locations
    ADD CONSTRAINT chk_locations_no_self_parent CHECK (parent_location <> id);

-- ----------------------------------------------------------------------------
-- User deletion (GDPR): photos keep the file, drop the author; import jobs
-- are user-private and go with the user.
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.item_photos
    ALTER COLUMN uploaded_by DROP NOT NULL,
    DROP CONSTRAINT item_photos_uploaded_by_fkey,
    ADD CONSTRAINT item_photos_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE warehouse.repair_photos
    ALTER COLUMN uploaded_by DROP NOT NULL,
    DROP CONSTRAINT repair_photos_uploaded_by_fkey,
    ADD CONSTRAINT repair_photos_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE warehouse.import_jobs
    DROP CONSTRAINT import_jobs_user_id_fkey,
    ADD CONSTRAINT import_jobs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- Loan TOCTOU race fix
-- ----------------------------------------------------------------------------
-- Decision (documented): KEEP the single-active-loan rule enforced by
-- ix_loans_active_inventory, and KEEP the SUM-based quantity check in the
-- trigger (it still matters for UPDATEs of an active loan's quantity).
-- The actual fix is the FOR UPDATE: the trigger previously read
-- inventory.quantity without a lock, so two concurrent loan INSERTs could
-- both pass the check and oversubscribe stock. Locking the inventory row
-- serializes all loan validations against the same inventory.
CREATE OR REPLACE FUNCTION warehouse.validate_loan_quantity()
RETURNS TRIGGER AS $$
DECLARE
    available_qty INTEGER;
    total_loaned INTEGER;
    inventory_qty INTEGER;
BEGIN
    -- Lock the inventory row: serializes concurrent loan inserts/updates
    -- for the same inventory and removes the TOCTOU window.
    SELECT quantity INTO inventory_qty
    FROM warehouse.inventory
    WHERE id = NEW.inventory_id
    FOR UPDATE;

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

-- migrate:down

CREATE OR REPLACE FUNCTION warehouse.validate_loan_quantity()
RETURNS TRIGGER AS $$
DECLARE
    available_qty INTEGER;
    total_loaned INTEGER;
    inventory_qty INTEGER;
BEGIN
    SELECT quantity INTO inventory_qty
    FROM warehouse.inventory
    WHERE id = NEW.inventory_id;

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

ALTER TABLE warehouse.import_jobs
    DROP CONSTRAINT import_jobs_user_id_fkey,
    ADD CONSTRAINT import_jobs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE warehouse.repair_photos
    DROP CONSTRAINT repair_photos_uploaded_by_fkey,
    ADD CONSTRAINT repair_photos_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
-- NOTE: cannot restore NOT NULL on uploaded_by if SET NULL has fired.

ALTER TABLE warehouse.item_photos
    DROP CONSTRAINT item_photos_uploaded_by_fkey,
    ADD CONSTRAINT item_photos_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);

ALTER TABLE warehouse.locations  DROP CONSTRAINT chk_locations_no_self_parent;
ALTER TABLE warehouse.categories DROP CONSTRAINT chk_categories_no_self_parent;

ALTER TABLE warehouse.deleted_records DROP CONSTRAINT uq_deleted_records_entity;

CREATE INDEX ix_password_reset_tokens_hash ON auth.password_reset_tokens(token_hash);
ALTER TABLE auth.password_reset_tokens DROP CONSTRAINT uq_password_reset_tokens_token;
CREATE INDEX idx_user_sessions_token_hash ON auth.user_sessions(refresh_token_hash);
ALTER TABLE auth.user_sessions DROP CONSTRAINT uq_user_sessions_token;

DROP INDEX warehouse.uq_items_ws_barcode;
CREATE INDEX ix_items_barcode ON warehouse.items(workspace_id, barcode) WHERE barcode IS NOT NULL;
-- NOTE: barcodes NULLed out by the dedupe above are not restorable.

ALTER TABLE warehouse.borrowers ALTER COLUMN email TYPE VARCHAR(255);
ALTER TABLE auth.users ALTER COLUMN email TYPE VARCHAR(255);
