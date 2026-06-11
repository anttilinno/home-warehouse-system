-- migrate:up

-- ============================================================================
-- Composite-key tenancy (audit B1): make cross-tenant corruption unrepresentable
-- ============================================================================
-- Every child FK previously referenced bare id, so a row in workspace A could
-- legally point at a parent in workspace B. Give every tenant-owned parent a
-- UNIQUE (workspace_id, id) and re-point every child FK at the composite key.
-- The DB now proves tenant isolation instead of 30 query files re-asserting it.
--
-- Tables are home-scale small, so plain ADD CONSTRAINT (which validates
-- existing rows immediately) is used instead of NOT VALID + VALIDATE. Any
-- existing cross-tenant row fails the migration loudly — which is the point.
--
-- ON DELETE SET NULL (column) uses the PG 15+ column-list form so composite
-- FKs null only the reference column, never workspace_id.

-- ----------------------------------------------------------------------------
-- Parent composite keys
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.items       ADD CONSTRAINT uq_items_ws_id       UNIQUE (workspace_id, id);
ALTER TABLE warehouse.locations   ADD CONSTRAINT uq_locations_ws_id   UNIQUE (workspace_id, id);
ALTER TABLE warehouse.containers  ADD CONSTRAINT uq_containers_ws_id  UNIQUE (workspace_id, id);
ALTER TABLE warehouse.borrowers   ADD CONSTRAINT uq_borrowers_ws_id   UNIQUE (workspace_id, id);
ALTER TABLE warehouse.inventory   ADD CONSTRAINT uq_inventory_ws_id   UNIQUE (workspace_id, id);
ALTER TABLE warehouse.categories  ADD CONSTRAINT uq_categories_ws_id  UNIQUE (workspace_id, id);
ALTER TABLE warehouse.companies   ADD CONSTRAINT uq_companies_ws_id   UNIQUE (workspace_id, id);
ALTER TABLE warehouse.files       ADD CONSTRAINT uq_files_ws_id       UNIQUE (workspace_id, id);
ALTER TABLE warehouse.labels      ADD CONSTRAINT uq_labels_ws_id      UNIQUE (workspace_id, id);
ALTER TABLE warehouse.repair_logs ADD CONSTRAINT uq_repair_logs_ws_id UNIQUE (workspace_id, id);

-- ----------------------------------------------------------------------------
-- inventory → items / locations / containers
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.inventory
    DROP CONSTRAINT inventory_item_id_fkey,
    ADD CONSTRAINT inventory_item_fk FOREIGN KEY (workspace_id, item_id)
        REFERENCES warehouse.items (workspace_id, id) ON DELETE CASCADE,
    DROP CONSTRAINT inventory_location_id_fkey,
    -- RESTRICT (was CASCADE): deleting a location silently deleted inventory
    -- rows — a data-loss bug. Locations with stock must be emptied first.
    ADD CONSTRAINT inventory_location_fk FOREIGN KEY (workspace_id, location_id)
        REFERENCES warehouse.locations (workspace_id, id) ON DELETE RESTRICT,
    DROP CONSTRAINT inventory_container_id_fkey,
    ADD CONSTRAINT inventory_container_fk FOREIGN KEY (workspace_id, container_id)
        REFERENCES warehouse.containers (workspace_id, id) ON DELETE SET NULL (container_id);

-- ----------------------------------------------------------------------------
-- containers → locations
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.containers
    DROP CONSTRAINT containers_location_id_fkey,
    ADD CONSTRAINT containers_location_fk FOREIGN KEY (workspace_id, location_id)
        REFERENCES warehouse.locations (workspace_id, id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- items → categories / companies
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.items
    DROP CONSTRAINT items_category_id_fkey,
    ADD CONSTRAINT items_category_fk FOREIGN KEY (workspace_id, category_id)
        REFERENCES warehouse.categories (workspace_id, id) ON DELETE SET NULL (category_id),
    DROP CONSTRAINT items_purchased_from_fkey,
    ADD CONSTRAINT items_purchased_from_fk FOREIGN KEY (workspace_id, purchased_from)
        REFERENCES warehouse.companies (workspace_id, id) ON DELETE SET NULL (purchased_from);

-- ----------------------------------------------------------------------------
-- Composite self-FKs (also kills cross-tenant parenting in trees)
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.categories
    DROP CONSTRAINT categories_parent_category_id_fkey,
    ADD CONSTRAINT categories_parent_fk FOREIGN KEY (workspace_id, parent_category_id)
        REFERENCES warehouse.categories (workspace_id, id) ON DELETE SET NULL (parent_category_id);

ALTER TABLE warehouse.locations
    DROP CONSTRAINT locations_parent_location_fkey,
    ADD CONSTRAINT locations_parent_fk FOREIGN KEY (workspace_id, parent_location)
        REFERENCES warehouse.locations (workspace_id, id) ON DELETE SET NULL (parent_location);

-- ----------------------------------------------------------------------------
-- loans → inventory / borrowers
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.loans
    DROP CONSTRAINT loans_inventory_id_fkey,
    ADD CONSTRAINT loans_inventory_fk FOREIGN KEY (workspace_id, inventory_id)
        REFERENCES warehouse.inventory (workspace_id, id) ON DELETE CASCADE,
    DROP CONSTRAINT loans_borrower_id_fkey,
    ADD CONSTRAINT loans_borrower_fk FOREIGN KEY (workspace_id, borrower_id)
        REFERENCES warehouse.borrowers (workspace_id, id) ON DELETE RESTRICT;

-- ----------------------------------------------------------------------------
-- repair_logs → inventory
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.repair_logs
    DROP CONSTRAINT repair_logs_inventory_id_fkey,
    ADD CONSTRAINT repair_logs_inventory_fk FOREIGN KEY (workspace_id, inventory_id)
        REFERENCES warehouse.inventory (workspace_id, id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- inventory_movements → inventory / locations / containers
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.inventory_movements
    DROP CONSTRAINT inventory_movements_inventory_id_fkey,
    ADD CONSTRAINT inventory_movements_inventory_fk FOREIGN KEY (workspace_id, inventory_id)
        REFERENCES warehouse.inventory (workspace_id, id) ON DELETE CASCADE,
    DROP CONSTRAINT inventory_movements_from_location_id_fkey,
    ADD CONSTRAINT inventory_movements_from_location_fk FOREIGN KEY (workspace_id, from_location_id)
        REFERENCES warehouse.locations (workspace_id, id) ON DELETE SET NULL (from_location_id),
    DROP CONSTRAINT inventory_movements_to_location_id_fkey,
    ADD CONSTRAINT inventory_movements_to_location_fk FOREIGN KEY (workspace_id, to_location_id)
        REFERENCES warehouse.locations (workspace_id, id) ON DELETE SET NULL (to_location_id),
    DROP CONSTRAINT inventory_movements_from_container_id_fkey,
    ADD CONSTRAINT inventory_movements_from_container_fk FOREIGN KEY (workspace_id, from_container_id)
        REFERENCES warehouse.containers (workspace_id, id) ON DELETE SET NULL (from_container_id),
    DROP CONSTRAINT inventory_movements_to_container_id_fkey,
    ADD CONSTRAINT inventory_movements_to_container_fk FOREIGN KEY (workspace_id, to_container_id)
        REFERENCES warehouse.containers (workspace_id, id) ON DELETE SET NULL (to_container_id);

-- ----------------------------------------------------------------------------
-- favorites → items / locations / containers
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.favorites
    DROP CONSTRAINT favorites_item_id_fkey,
    ADD CONSTRAINT favorites_item_fk FOREIGN KEY (workspace_id, item_id)
        REFERENCES warehouse.items (workspace_id, id) ON DELETE CASCADE,
    DROP CONSTRAINT favorites_location_id_fkey,
    ADD CONSTRAINT favorites_location_fk FOREIGN KEY (workspace_id, location_id)
        REFERENCES warehouse.locations (workspace_id, id) ON DELETE CASCADE,
    DROP CONSTRAINT favorites_container_id_fkey,
    ADD CONSTRAINT favorites_container_fk FOREIGN KEY (workspace_id, container_id)
        REFERENCES warehouse.containers (workspace_id, id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- attachments → items / files (workspace_id added in 002)
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.attachments
    DROP CONSTRAINT attachments_item_id_fkey,
    ADD CONSTRAINT attachments_item_fk FOREIGN KEY (workspace_id, item_id)
        REFERENCES warehouse.items (workspace_id, id) ON DELETE CASCADE,
    DROP CONSTRAINT attachments_file_id_fkey,
    ADD CONSTRAINT attachments_file_fk FOREIGN KEY (workspace_id, file_id)
        REFERENCES warehouse.files (workspace_id, id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- item_labels → items / labels (workspace_id added in 002)
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.item_labels
    DROP CONSTRAINT item_labels_item_id_fkey,
    ADD CONSTRAINT item_labels_item_fk FOREIGN KEY (workspace_id, item_id)
        REFERENCES warehouse.items (workspace_id, id) ON DELETE CASCADE,
    DROP CONSTRAINT item_labels_label_id_fkey,
    ADD CONSTRAINT item_labels_label_fk FOREIGN KEY (workspace_id, label_id)
        REFERENCES warehouse.labels (workspace_id, id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- container_tags → containers (workspace_id added in 002)
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.container_tags
    DROP CONSTRAINT container_tags_container_id_fkey,
    ADD CONSTRAINT container_tags_container_fk FOREIGN KEY (workspace_id, container_id)
        REFERENCES warehouse.containers (workspace_id, id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- item_photos → items
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.item_photos
    DROP CONSTRAINT item_photos_item_id_fkey,
    ADD CONSTRAINT item_photos_item_fk FOREIGN KEY (workspace_id, item_id)
        REFERENCES warehouse.items (workspace_id, id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- repair_photos / repair_attachments → repair_logs / files
-- ----------------------------------------------------------------------------
ALTER TABLE warehouse.repair_photos
    DROP CONSTRAINT repair_photos_repair_log_id_fkey,
    ADD CONSTRAINT repair_photos_repair_log_fk FOREIGN KEY (workspace_id, repair_log_id)
        REFERENCES warehouse.repair_logs (workspace_id, id) ON DELETE CASCADE;

ALTER TABLE warehouse.repair_attachments
    DROP CONSTRAINT repair_attachments_repair_log_id_fkey,
    ADD CONSTRAINT repair_attachments_repair_log_fk FOREIGN KEY (workspace_id, repair_log_id)
        REFERENCES warehouse.repair_logs (workspace_id, id) ON DELETE CASCADE,
    DROP CONSTRAINT repair_attachments_file_id_fkey,
    ADD CONSTRAINT repair_attachments_file_fk FOREIGN KEY (workspace_id, file_id)
        REFERENCES warehouse.files (workspace_id, id) ON DELETE CASCADE;

-- migrate:down

ALTER TABLE warehouse.repair_attachments
    DROP CONSTRAINT repair_attachments_file_fk,
    ADD CONSTRAINT repair_attachments_file_id_fkey
        FOREIGN KEY (file_id) REFERENCES warehouse.files(id) ON DELETE CASCADE,
    DROP CONSTRAINT repair_attachments_repair_log_fk,
    ADD CONSTRAINT repair_attachments_repair_log_id_fkey
        FOREIGN KEY (repair_log_id) REFERENCES warehouse.repair_logs(id) ON DELETE CASCADE;

ALTER TABLE warehouse.repair_photos
    DROP CONSTRAINT repair_photos_repair_log_fk,
    ADD CONSTRAINT repair_photos_repair_log_id_fkey
        FOREIGN KEY (repair_log_id) REFERENCES warehouse.repair_logs(id) ON DELETE CASCADE;

ALTER TABLE warehouse.item_photos
    DROP CONSTRAINT item_photos_item_fk,
    ADD CONSTRAINT item_photos_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;

ALTER TABLE warehouse.container_tags
    DROP CONSTRAINT container_tags_container_fk,
    ADD CONSTRAINT container_tags_container_id_fkey
        FOREIGN KEY (container_id) REFERENCES warehouse.containers(id) ON DELETE CASCADE;

ALTER TABLE warehouse.item_labels
    DROP CONSTRAINT item_labels_label_fk,
    ADD CONSTRAINT item_labels_label_id_fkey
        FOREIGN KEY (label_id) REFERENCES warehouse.labels(id) ON DELETE CASCADE,
    DROP CONSTRAINT item_labels_item_fk,
    ADD CONSTRAINT item_labels_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;

ALTER TABLE warehouse.attachments
    DROP CONSTRAINT attachments_file_fk,
    ADD CONSTRAINT attachments_file_id_fkey
        FOREIGN KEY (file_id) REFERENCES warehouse.files(id) ON DELETE CASCADE,
    DROP CONSTRAINT attachments_item_fk,
    ADD CONSTRAINT attachments_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;

ALTER TABLE warehouse.favorites
    DROP CONSTRAINT favorites_container_fk,
    ADD CONSTRAINT favorites_container_id_fkey
        FOREIGN KEY (container_id) REFERENCES warehouse.containers(id) ON DELETE CASCADE,
    DROP CONSTRAINT favorites_location_fk,
    ADD CONSTRAINT favorites_location_id_fkey
        FOREIGN KEY (location_id) REFERENCES warehouse.locations(id) ON DELETE CASCADE,
    DROP CONSTRAINT favorites_item_fk,
    ADD CONSTRAINT favorites_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;

ALTER TABLE warehouse.inventory_movements
    DROP CONSTRAINT inventory_movements_to_container_fk,
    ADD CONSTRAINT inventory_movements_to_container_id_fkey
        FOREIGN KEY (to_container_id) REFERENCES warehouse.containers(id) ON DELETE SET NULL,
    DROP CONSTRAINT inventory_movements_from_container_fk,
    ADD CONSTRAINT inventory_movements_from_container_id_fkey
        FOREIGN KEY (from_container_id) REFERENCES warehouse.containers(id) ON DELETE SET NULL,
    DROP CONSTRAINT inventory_movements_to_location_fk,
    ADD CONSTRAINT inventory_movements_to_location_id_fkey
        FOREIGN KEY (to_location_id) REFERENCES warehouse.locations(id) ON DELETE SET NULL,
    DROP CONSTRAINT inventory_movements_from_location_fk,
    ADD CONSTRAINT inventory_movements_from_location_id_fkey
        FOREIGN KEY (from_location_id) REFERENCES warehouse.locations(id) ON DELETE SET NULL,
    DROP CONSTRAINT inventory_movements_inventory_fk,
    ADD CONSTRAINT inventory_movements_inventory_id_fkey
        FOREIGN KEY (inventory_id) REFERENCES warehouse.inventory(id) ON DELETE CASCADE;

ALTER TABLE warehouse.repair_logs
    DROP CONSTRAINT repair_logs_inventory_fk,
    ADD CONSTRAINT repair_logs_inventory_id_fkey
        FOREIGN KEY (inventory_id) REFERENCES warehouse.inventory(id) ON DELETE CASCADE;

ALTER TABLE warehouse.loans
    DROP CONSTRAINT loans_borrower_fk,
    ADD CONSTRAINT loans_borrower_id_fkey
        FOREIGN KEY (borrower_id) REFERENCES warehouse.borrowers(id) ON DELETE RESTRICT,
    DROP CONSTRAINT loans_inventory_fk,
    ADD CONSTRAINT loans_inventory_id_fkey
        FOREIGN KEY (inventory_id) REFERENCES warehouse.inventory(id) ON DELETE CASCADE;

ALTER TABLE warehouse.locations
    DROP CONSTRAINT locations_parent_fk,
    ADD CONSTRAINT locations_parent_location_fkey
        FOREIGN KEY (parent_location) REFERENCES warehouse.locations(id) ON DELETE SET NULL;

ALTER TABLE warehouse.categories
    DROP CONSTRAINT categories_parent_fk,
    ADD CONSTRAINT categories_parent_category_id_fkey
        FOREIGN KEY (parent_category_id) REFERENCES warehouse.categories(id) ON DELETE SET NULL;

ALTER TABLE warehouse.items
    DROP CONSTRAINT items_purchased_from_fk,
    ADD CONSTRAINT items_purchased_from_fkey
        FOREIGN KEY (purchased_from) REFERENCES warehouse.companies(id) ON DELETE SET NULL,
    DROP CONSTRAINT items_category_fk,
    ADD CONSTRAINT items_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES warehouse.categories(id) ON DELETE SET NULL;

ALTER TABLE warehouse.containers
    DROP CONSTRAINT containers_location_fk,
    ADD CONSTRAINT containers_location_id_fkey
        FOREIGN KEY (location_id) REFERENCES warehouse.locations(id) ON DELETE CASCADE;

ALTER TABLE warehouse.inventory
    DROP CONSTRAINT inventory_container_fk,
    ADD CONSTRAINT inventory_container_id_fkey
        FOREIGN KEY (container_id) REFERENCES warehouse.containers(id) ON DELETE SET NULL,
    DROP CONSTRAINT inventory_location_fk,
    ADD CONSTRAINT inventory_location_id_fkey
        FOREIGN KEY (location_id) REFERENCES warehouse.locations(id) ON DELETE CASCADE,
    DROP CONSTRAINT inventory_item_fk,
    ADD CONSTRAINT inventory_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON DELETE CASCADE;

ALTER TABLE warehouse.repair_logs DROP CONSTRAINT uq_repair_logs_ws_id;
ALTER TABLE warehouse.labels      DROP CONSTRAINT uq_labels_ws_id;
ALTER TABLE warehouse.files       DROP CONSTRAINT uq_files_ws_id;
ALTER TABLE warehouse.companies   DROP CONSTRAINT uq_companies_ws_id;
ALTER TABLE warehouse.categories  DROP CONSTRAINT uq_categories_ws_id;
ALTER TABLE warehouse.inventory   DROP CONSTRAINT uq_inventory_ws_id;
ALTER TABLE warehouse.borrowers   DROP CONSTRAINT uq_borrowers_ws_id;
ALTER TABLE warehouse.containers  DROP CONSTRAINT uq_containers_ws_id;
ALTER TABLE warehouse.locations   DROP CONSTRAINT uq_locations_ws_id;
ALTER TABLE warehouse.items       DROP CONSTRAINT uq_items_ws_id;
