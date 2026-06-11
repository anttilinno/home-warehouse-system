-- migrate:up

-- ============================================================================
-- pending_changes sync columns (audit A5 / B4, reduced blast radius)
-- ============================================================================
-- The frontend already generates UUIDv7 Idempotency-Key headers per mutation;
-- the schema had nowhere to store them, so a retried offline POST created a
-- duplicate change request. client_change_id gives the key a home and the
-- partial UNIQUE makes retries conflict instead of duplicating.
--
-- base_updated_at is the optimistic-concurrency token: the entity's
-- updated_at as the client saw it when composing the change. Approval logic
-- can compare it to detect conflicting concurrent edits instead of blindly
-- last-write-winning.
--
-- Both are nullable: existing rows and not-yet-upgraded clients keep working.
-- entity_type deliberately stays varchar (NOT converted to
-- warehouse.activity_entity_enum) to limit blast radius.

ALTER TABLE warehouse.pending_changes
    ADD COLUMN client_change_id uuid,
    ADD COLUMN base_updated_at timestamptz;

COMMENT ON COLUMN warehouse.pending_changes.client_change_id IS
'Client-generated idempotency key (UUIDv7 from the Idempotency-Key header). Unique per workspace when present.';

COMMENT ON COLUMN warehouse.pending_changes.base_updated_at IS
'Optimistic concurrency token: the target entity''s updated_at as observed by the client when the change was composed.';

CREATE UNIQUE INDEX uq_pending_changes_ws_client_change
    ON warehouse.pending_changes (workspace_id, client_change_id)
    WHERE client_change_id IS NOT NULL;

-- migrate:down

DROP INDEX warehouse.uq_pending_changes_ws_client_change;

ALTER TABLE warehouse.pending_changes
    DROP COLUMN base_updated_at,
    DROP COLUMN client_change_id;
