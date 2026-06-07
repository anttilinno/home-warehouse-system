//go:build integration
// +build integration

package postgres_test

// Quick task 260607-vdf (Part C) — Postgres integration test for the s.go
// shortlink resolver.
//
// Why this test exists: ShortlinkRepository.Resolve is a single UNION ALL over
// warehouse.items / warehouse.containers / warehouse.locations, scoped by
// `short_code = $1 AND workspace_id = ANY($2)` with a literal sort_key that
// keeps item rows first. The unit tests (handler_test.go) use a fakeResolver
// and therefore cannot assert the real SQL behaviour — specifically the
// cross-workspace ANY($2) scoping (Pitfall #5 / T-uzt-02) and the item-first
// priority that the handler relies on to pick a single redirect target. This
// test exercises the real repo against real Postgres and asserts those truths
// directly, locking them against regression at the real-DB layer.
//
// Run with (needs a live, migrated Postgres test DB — see CLAUDE.md):
//   cd backend
//   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
//     go test -tags=integration -count=1 ./internal/infra/postgres/... -run Shortlink -v
//
// Without the integration build tag this file is invisible to plain
// `go test ./...`, so the default CI lane stays fast.

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/shortlink"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// seedItem inserts a warehouse.items row directly (bypassing Service.Create —
// the resolver itself is under test) and returns the generated id.
func seedItem(t *testing.T, pool *pgxpool.Pool, ws uuid.UUID, code string) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	var id uuid.UUID
	err := pool.QueryRow(ctx, `
		INSERT INTO warehouse.items (workspace_id, sku, name, min_stock_level, short_code)
		VALUES ($1, $2, $3, 0, $4)
		RETURNING id
	`, ws, "SKU-"+code, "Item "+code, code).Scan(&id)
	require.NoError(t, err, "seed item %q must succeed", code)
	return id
}

// seedLocation inserts a warehouse.locations row directly and returns the id.
func seedLocation(t *testing.T, pool *pgxpool.Pool, ws uuid.UUID, code string) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	var id uuid.UUID
	err := pool.QueryRow(ctx, `
		INSERT INTO warehouse.locations (workspace_id, name, short_code)
		VALUES ($1, $2, $3)
		RETURNING id
	`, ws, "Location "+code, code).Scan(&id)
	require.NoError(t, err, "seed location %q must succeed", code)
	return id
}

// seedContainer inserts a warehouse.containers row directly and returns the id.
// containers.location_id is NOT NULL, so the caller must pass a real location id
// in the same workspace.
func seedContainer(t *testing.T, pool *pgxpool.Pool, ws, locID uuid.UUID, code string) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	var id uuid.UUID
	err := pool.QueryRow(ctx, `
		INSERT INTO warehouse.containers (workspace_id, name, location_id, short_code)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, ws, "Container "+code, locID, code).Scan(&id)
	require.NoError(t, err, "seed container %q must succeed", code)
	return id
}

// TestShortlinkRepository_Resolve_Integration exercises the real UNION resolver
// against real Postgres: per-type matches, item-first priority, cross-workspace
// scoping, and the empty/sentinel not-found contract.
func TestShortlinkRepository_Resolve_Integration(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	ctx := context.Background()

	// Default fixture workspace from testdb.SetupTestDB.
	wsA := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	// A second workspace for the cross-workspace scoping subtest.
	wsB := uuid.New()
	testdb.CreateTestWorkspace(t, pool, wsB)

	repo := postgres.NewShortlinkRepository(pool)

	t.Run("item match", func(t *testing.T) {
		code := "itm00001"
		itemID := seedItem(t, pool, wsA, code)

		matches, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		require.Len(t, matches, 1)
		assert.Equal(t, shortlink.TypeItem, matches[0].Type)
		assert.Equal(t, itemID, matches[0].ID)
		assert.Equal(t, wsA, matches[0].WorkspaceID)
	})

	t.Run("container match", func(t *testing.T) {
		// containers.location_id is NOT NULL — seed a location first (distinct
		// code so it does not collide with the container's short_code).
		locID := seedLocation(t, pool, wsA, "ctn00loc")
		code := "ctn00001"
		containerID := seedContainer(t, pool, wsA, locID, code)

		matches, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		require.Len(t, matches, 1)
		assert.Equal(t, shortlink.TypeContainer, matches[0].Type)
		assert.Equal(t, containerID, matches[0].ID)
		assert.Equal(t, wsA, matches[0].WorkspaceID)
	})

	t.Run("location match", func(t *testing.T) {
		code := "loc00001"
		locID := seedLocation(t, pool, wsA, code)

		matches, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		require.Len(t, matches, 1)
		assert.Equal(t, shortlink.TypeLocation, matches[0].Type)
		assert.Equal(t, locID, matches[0].ID)
		assert.Equal(t, wsA, matches[0].WorkspaceID)
	})

	t.Run("item-first priority", func(t *testing.T) {
		// All three entity types share the same short_code within wsA. The
		// literal sort_key (0 for items) must keep the item row first so the
		// handler can pick the highest-priority single target.
		code := "prio0001"
		itemID := seedItem(t, pool, wsA, code)
		locID := seedLocation(t, pool, wsA, code)
		_ = seedContainer(t, pool, wsA, locID, code)

		matches, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(matches), 2)
		assert.Equal(t, shortlink.TypeItem, matches[0].Type, "item must sort first")
		assert.Equal(t, itemID, matches[0].ID)
	})

	t.Run("cross-workspace scoping", func(t *testing.T) {
		// Code exists ONLY in wsB.
		code := "xws00001"
		itemID := seedItem(t, pool, wsB, code)

		// Scoped to wsA only → must be invisible (ANY($2) excludes wsB).
		matches, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		assert.Len(t, matches, 0, "code in wsB must not leak to a wsA-scoped query")

		// Scoped to both → the wsB row is visible.
		matches, err = repo.Resolve(ctx, code, []uuid.UUID{wsA, wsB})
		require.NoError(t, err)
		require.Len(t, matches, 1)
		assert.Equal(t, shortlink.TypeItem, matches[0].Type)
		assert.Equal(t, itemID, matches[0].ID)
		assert.Equal(t, wsB, matches[0].WorkspaceID)
	})

	t.Run("not-found sentinel", func(t *testing.T) {
		// A guaranteed-unique code that was never seeded. <=8 chars, distinct
		// from every other subtest's code.
		code := "nf00abcd"

		matches, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err, "no match must return a nil error, not an error")
		assert.Len(t, matches, 0, "no match returns an empty slice")

		// Empty workspace set short-circuits to nil, nil per the len==0 guard.
		matches, err = repo.Resolve(ctx, code, nil)
		require.NoError(t, err)
		assert.Nil(t, matches)
	})
}
