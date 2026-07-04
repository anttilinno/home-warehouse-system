// Package idempotency dedupes replayed CREATE requests from the offline-first
// PWA. The frontend mints a stable Idempotency-Key per mutation (persisted in
// the paused-mutation queue) and resends it on reconnect if the original
// response never arrived; without a server-side dedup, that replay would
// create a duplicate item/container/location.
//
// Scoped to item/container/location CREATE only (the only offline-queued
// writes in v1) — see each domain's service.go Create().
package idempotency

import (
	"context"

	"github.com/google/uuid"
)

// EntityType identifies which warehouse entity table an idempotency record
// points at. Mirrors warehouse.favorite_type_enum (reused by the
// idempotency_keys table, migration 008) — same convention as
// favorite.FavoriteType.
type EntityType string

const (
	TypeItem      EntityType = "ITEM"
	TypeLocation  EntityType = "LOCATION"
	TypeContainer EntityType = "CONTAINER"
	TypeInventory EntityType = "INVENTORY"
)

// Store is a tiny shared dependency injected into the item/container/location
// services (one instance, one Postgres-backed impl — not worth three
// copy-pasted repo methods for two queries).
type Store interface {
	// FindByIdempotencyKey looks up a previously stored idempotency key for
	// the workspace. found=false means no replay has happened yet — the
	// caller should proceed with a normal create.
	FindByIdempotencyKey(ctx context.Context, workspaceID uuid.UUID, key string) (entityID uuid.UUID, found bool, err error)
	// SaveIdempotencyKey records the mapping from (workspaceID, key) to the
	// just-created entity. ON CONFLICT DO NOTHING: the per-entity short_code
	// unique constraint is the backstop against a racing double-create, this
	// insert just needs to not error when that race is lost.
	SaveIdempotencyKey(ctx context.Context, workspaceID uuid.UUID, key string, entityType EntityType, entityID uuid.UUID) error
}
