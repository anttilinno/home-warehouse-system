//go:build integration
// +build integration

package postgres_test

// Postgres integration tests for the s.go shortlink resolver and the
// warehouse.short_codes registry (migration 005).
//
// Why these tests exist: ShortlinkRepository.Resolve is a single lookup
// against the global short_codes registry, scoped by `code = $1 AND
// workspace_id = ANY($2)`. The unit tests (handler_test.go) use a
// fakeResolver and therefore cannot assert the real SQL behaviour —
// specifically the cross-workspace ANY($2) membership scoping (Pitfall #5 /
// T-uzt-02), the enum→tag mapping, and the trigger-maintained registry rows
// the resolver depends on. These tests exercise the real repo against real
// Postgres and lock those truths against regression at the real-DB layer.
//
// Run with (needs a live, migrated Postgres test DB — see CLAUDE.md):
//   cd backend
//   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
//     go test -tags=integration -count=1 ./internal/infra/postgres/... -run 'Shortlink|ShortCodes' -v
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
// the resolver itself is under test) and returns the generated id. The
// short_codes_sync trigger registers the code in the same statement.
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

// registryRow fetches the short_codes registry row for a code (or false).
func registryRow(t *testing.T, pool *pgxpool.Pool, code string) (entityType string, entityID, wsID uuid.UUID, found bool) {
	t.Helper()
	err := pool.QueryRow(context.Background(), `
		SELECT lower(entity_type::text), entity_id, workspace_id
		FROM warehouse.short_codes WHERE code = $1
	`, code).Scan(&entityType, &entityID, &wsID)
	if err != nil {
		return "", uuid.Nil, uuid.Nil, false
	}
	return entityType, entityID, wsID, true
}

// TestShortlinkRepository_Resolve_Integration exercises the real registry
// resolver against real Postgres: per-type matches, cross-workspace
// membership scoping (foreign workspace → nil → claim wizard), and the
// nil-on-miss contract.
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

		match, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		require.NotNil(t, match)
		assert.Equal(t, shortlink.TypeItem, match.Type)
		assert.Equal(t, itemID, match.ID)
		assert.Equal(t, wsA, match.WorkspaceID)
	})

	t.Run("container match", func(t *testing.T) {
		// containers.location_id is NOT NULL — seed a location first (distinct
		// code; codes are globally unique in the registry).
		locID := seedLocation(t, pool, wsA, "ctn00loc")
		code := "ctn00001"
		containerID := seedContainer(t, pool, wsA, locID, code)

		match, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		require.NotNil(t, match)
		assert.Equal(t, shortlink.TypeContainer, match.Type)
		assert.Equal(t, containerID, match.ID)
		assert.Equal(t, wsA, match.WorkspaceID)
	})

	t.Run("location match", func(t *testing.T) {
		code := "loc00001"
		locID := seedLocation(t, pool, wsA, code)

		match, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		require.NotNil(t, match)
		assert.Equal(t, shortlink.TypeLocation, match.Type)
		assert.Equal(t, locID, match.ID)
		assert.Equal(t, wsA, match.WorkspaceID)
	})

	t.Run("foreign workspace is invisible", func(t *testing.T) {
		// Code exists ONLY in wsB.
		code := "xws00001"
		itemID := seedItem(t, pool, wsB, code)

		// Scoped to wsA only → must be invisible (ANY($2) excludes wsB), which
		// the handler turns into the claim-wizard redirect.
		match, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err)
		assert.Nil(t, match, "code in wsB must not leak to a wsA-scoped query")

		// Scoped to both → the wsB row is visible.
		match, err = repo.Resolve(ctx, code, []uuid.UUID{wsA, wsB})
		require.NoError(t, err)
		require.NotNil(t, match)
		assert.Equal(t, shortlink.TypeItem, match.Type)
		assert.Equal(t, itemID, match.ID)
		assert.Equal(t, wsB, match.WorkspaceID)
	})

	t.Run("not-found sentinel", func(t *testing.T) {
		// A guaranteed-unique code that was never seeded.
		code := "nf00abcd"

		match, err := repo.Resolve(ctx, code, []uuid.UUID{wsA})
		require.NoError(t, err, "no match must return a nil error, not an error")
		assert.Nil(t, match, "no match returns a nil match")

		// Empty workspace set short-circuits to nil, nil per the len==0 guard.
		match, err = repo.Resolve(ctx, code, nil)
		require.NoError(t, err)
		assert.Nil(t, match)
	})
}

// TestShortCodesRegistry_WritePath_Integration asserts that the
// short_codes_sync triggers maintain the registry in the same transaction as
// every entity write: INSERT registers, UPDATE of short_code re-points the
// row, DELETE unregisters, and a duplicate code anywhere (cross-workspace,
// cross-entity-type) is rejected by the registry PK.
func TestShortCodesRegistry_WritePath_Integration(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	ctx := context.Background()

	wsA := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	wsB := uuid.New()
	testdb.CreateTestWorkspace(t, pool, wsB)

	t.Run("insert registers, update re-points, delete unregisters", func(t *testing.T) {
		code := "wp000001"
		itemID := seedItem(t, pool, wsA, code)

		etype, eid, ews, found := registryRow(t, pool, code)
		require.True(t, found, "insert must register the code")
		assert.Equal(t, "item", etype)
		assert.Equal(t, itemID, eid)
		assert.Equal(t, wsA, ews)

		// UPDATE short_code → registry row follows (same tx, via trigger).
		newCode := "wp000002"
		_, err := pool.Exec(ctx, `UPDATE warehouse.items SET short_code = $1 WHERE id = $2`, newCode, itemID)
		require.NoError(t, err)

		_, _, _, found = registryRow(t, pool, code)
		assert.False(t, found, "old code must be released on update")
		_, eid, _, found = registryRow(t, pool, newCode)
		require.True(t, found, "new code must be registered on update")
		assert.Equal(t, itemID, eid)

		// DELETE the entity → registry row goes away.
		_, err = pool.Exec(ctx, `DELETE FROM warehouse.items WHERE id = $1`, itemID)
		require.NoError(t, err)
		_, _, _, found = registryRow(t, pool, newCode)
		assert.False(t, found, "delete must unregister the code")
	})

	t.Run("global uniqueness across workspaces and entity types", func(t *testing.T) {
		code := "uq000001"
		seedItem(t, pool, wsA, code)

		// Same code, different workspace, different entity type → rejected.
		_, err := pool.Exec(ctx, `
			INSERT INTO warehouse.locations (workspace_id, name, short_code)
			VALUES ($1, 'Dup Location', $2)
		`, wsB, code)
		require.Error(t, err, "duplicate code must violate short_codes_pkey")
		assert.Contains(t, err.Error(), "short_codes_pkey")

		// A released code is claimable again.
		_, err = pool.Exec(ctx, `DELETE FROM warehouse.items WHERE workspace_id = $1 AND short_code = $2`, wsA, code)
		require.NoError(t, err)
		seedLocation(t, pool, wsB, code)
		etype, _, ews, found := registryRow(t, pool, code)
		require.True(t, found)
		assert.Equal(t, "location", etype)
		assert.Equal(t, wsB, ews)
	})

	t.Run("nonconforming code is rejected by the registry CHECK", func(t *testing.T) {
		_, err := pool.Exec(ctx, `
			INSERT INTO warehouse.items (workspace_id, sku, name, min_stock_level, short_code)
			VALUES ($1, 'SKU-BAD', 'Bad Code Item', 0, 'BAD-CODE')
		`, wsA)
		require.Error(t, err, "hyphenated code must violate chk_short_codes_code")
		assert.Contains(t, err.Error(), "chk_short_codes_code")
	})
}
