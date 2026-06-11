-- migrate:up

-- Wishlist / Purchase Planning (ROADMAP "Wishlist / Purchase Planning").
-- Models items you intend to acquire. A wishlist row converts into a real
-- item on purchase: the frontend opens the item create wizard prefilled from
-- the row, then links the created item back via acquired_item_id and closes
-- the row (status = 'acquired'). See internal/domain/warehouse/wishlist.

CREATE TABLE warehouse.wishlist_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    notes text,
    url character varying(2000),
    price_estimate integer,
    currency_code character varying(3),
    priority smallint DEFAULT 3 NOT NULL,
    desired_category_id uuid,
    status character varying(20) DEFAULT 'wanted' NOT NULL,
    acquired_item_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wishlist_items_pkey PRIMARY KEY (id),
    CONSTRAINT uq_wishlist_items_ws_id UNIQUE (workspace_id, id),
    CONSTRAINT chk_wishlist_items_price_nonneg CHECK ((price_estimate IS NULL) OR (price_estimate >= 0)),
    CONSTRAINT chk_wishlist_items_currency CHECK ((currency_code IS NULL) OR (currency_code ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT chk_wishlist_items_priority_range CHECK ((priority >= 1) AND (priority <= 5)),
    CONSTRAINT chk_wishlist_items_status CHECK ((status)::text = ANY (ARRAY['wanted'::text, 'ordered'::text, 'acquired'::text]))
);

COMMENT ON TABLE warehouse.wishlist_items IS 'Purchase-planning entries: items the workspace intends to acquire. Converted into a real item on purchase (acquired_item_id links back).';
COMMENT ON COLUMN warehouse.wishlist_items.price_estimate IS 'Estimated price in cents. NULL = unknown.';
COMMENT ON COLUMN warehouse.wishlist_items.priority IS 'Purchase priority 1 (highest) to 5 (lowest).';
COMMENT ON COLUMN warehouse.wishlist_items.status IS 'Lifecycle: wanted -> ordered -> acquired (wanted <-> ordered may go backward; acquired is terminal).';
COMMENT ON COLUMN warehouse.wishlist_items.acquired_item_id IS 'The warehouse.items row created when this wish was acquired. Set by the acquire flow.';

ALTER TABLE ONLY warehouse.wishlist_items
    ADD CONSTRAINT wishlist_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;

-- Composite FKs per the 005 tenancy pattern (UNIQUE (workspace_id, id) on the
-- parent makes cross-tenant references impossible).
ALTER TABLE ONLY warehouse.wishlist_items
    ADD CONSTRAINT wishlist_items_category_fk FOREIGN KEY (workspace_id, desired_category_id) REFERENCES warehouse.categories(workspace_id, id) ON DELETE SET NULL (desired_category_id);

ALTER TABLE ONLY warehouse.wishlist_items
    ADD CONSTRAINT wishlist_items_acquired_item_fk FOREIGN KEY (workspace_id, acquired_item_id) REFERENCES warehouse.items(workspace_id, id) ON DELETE SET NULL (acquired_item_id);

ALTER TABLE ONLY warehouse.wishlist_items
    ADD CONSTRAINT wishlist_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX ix_wishlist_items_ws_status_priority ON warehouse.wishlist_items USING btree (workspace_id, status, priority);

-- migrate:down

DROP TABLE warehouse.wishlist_items;
