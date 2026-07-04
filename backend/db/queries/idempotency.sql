-- Idempotency store (warehouse.idempotency_keys, migration 008). Dedupes
-- replayed CREATE requests keyed on (workspace_id, idempotency_key). Used by
-- item/container/location Service.Create — see
-- internal/domain/warehouse/idempotency/store.go.

-- name: FindIdempotencyKey :one
SELECT entity_id FROM warehouse.idempotency_keys
WHERE workspace_id = $1 AND idempotency_key = $2;

-- name: SaveIdempotencyKey :exec
INSERT INTO warehouse.idempotency_keys (workspace_id, idempotency_key, entity_type, entity_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (workspace_id, idempotency_key) DO NOTHING;
