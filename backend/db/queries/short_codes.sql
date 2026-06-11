-- Shortlink registry (warehouse.short_codes, migration 005). Codes are
-- globally unique; the registry is maintained by row triggers on
-- items/locations/containers. Resolution for GET /r/{code} lives in
-- internal/infra/postgres/shortlink_repository.go.

-- name: ShortCodeExists :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.short_codes
    WHERE code = $1
);
