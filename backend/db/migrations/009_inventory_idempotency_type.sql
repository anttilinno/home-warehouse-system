-- migrate:up

-- Offline-first PWA C-create: offline creation of inventory (stock) entries
-- replays a queued POST /inventory on reconnect, so — like item/container/
-- location creates (migration 008) — it dedupes on an Idempotency-Key. The
-- idempotency_keys.entity_type column is warehouse.favorite_type_enum, which
-- only had ITEM/LOCATION/CONTAINER; add INVENTORY so an inventory create can
-- record its dedup mapping.
ALTER TYPE warehouse.favorite_type_enum ADD VALUE IF NOT EXISTS 'INVENTORY';

-- migrate:down

-- PostgreSQL does not support removing enum values. The added value is
-- harmless if unused, so down is intentionally a no-op.
