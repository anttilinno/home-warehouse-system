-- migrate:up

-- Idempotency store for offline-queued CREATE requests (offline-first PWA
-- backend dependency). The frontend mints a stable Idempotency-Key per
-- mutation and replays it on reconnect if the original response was lost;
-- a replayed create must return the ORIGINAL entity instead of a duplicate.
-- Keyed on (workspace_id, idempotency_key) -> (entity_type, entity_id).
-- Scoped to item/container/location CREATE only (the only offline-queued
-- writes in v1) — see item/container/location service.go Create().

CREATE TABLE warehouse.idempotency_keys (
    workspace_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    entity_type warehouse.favorite_type_enum NOT NULL,
    entity_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT idempotency_keys_pkey PRIMARY KEY (workspace_id, idempotency_key)
);

COMMENT ON TABLE warehouse.idempotency_keys IS 'Dedup store for offline-queued CREATE requests: (workspace_id, idempotency_key) -> the entity a prior create already produced. A replayed create with the same key returns that entity instead of creating a duplicate.';
COMMENT ON COLUMN warehouse.idempotency_keys.entity_type IS 'Owning entity table: ITEM, LOCATION, or CONTAINER (reuses favorite_type_enum).';

ALTER TABLE ONLY warehouse.idempotency_keys
    ADD CONSTRAINT idempotency_keys_workspace_fk FOREIGN KEY (workspace_id) REFERENCES auth.workspaces(id) ON DELETE CASCADE;

-- migrate:down

DROP TABLE warehouse.idempotency_keys;
