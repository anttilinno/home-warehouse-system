-- migrate:up
ALTER TABLE warehouse.items ADD COLUMN needs_review boolean DEFAULT false;

-- migrate:down
ALTER TABLE warehouse.items DROP COLUMN needs_review;
