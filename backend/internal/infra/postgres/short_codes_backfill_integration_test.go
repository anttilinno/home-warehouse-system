//go:build integration
// +build integration

package postgres_test

// Backfill collision test for migration 005 (warehouse.short_codes registry).
//
// The backfill's collision policy cannot be observed on a migrated database
// (the registry already exists), so this test replays the REAL migration
// file: inside a single transaction it executes the `migrate:down` section
// (restoring the pre-registry schema), seeds colliding + nonconforming
// short_code rows with controlled created_at timestamps, executes the
// `migrate:up` section (which runs the backfill), asserts the oldest-wins
// policy, and rolls everything back. The test DB schema is untouched
// afterwards — Postgres DDL is transactional.

import (
	"context"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

const migration005Path = "../../../db/migrations/005_short_codes_registry.sql"

// loadMigration005 splits the dbmate file into its up and down scripts.
func loadMigration005(t *testing.T) (up, down string) {
	t.Helper()
	raw, err := os.ReadFile(migration005Path)
	require.NoError(t, err, "read migration 005")
	parts := strings.SplitN(string(raw), "-- migrate:down", 2)
	require.Len(t, parts, 2, "migration 005 must contain a migrate:down marker")
	up = strings.TrimPrefix(parts[0], "-- migrate:up")
	return up, parts[1]
}

// execScript runs a multi-statement SQL script over the simple protocol on
// the acquired connection (pgx's extended protocol is single-statement only).
func execScript(t *testing.T, conn *pgxpool.Conn, script string) {
	t.Helper()
	_, err := conn.Conn().PgConn().Exec(context.Background(), script).ReadAll()
	require.NoError(t, err, "script must execute cleanly")
}

func TestShortCodesBackfill_CollisionPolicy_Integration(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	ctx := context.Background()

	wsA := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	wsB := uuid.New()
	testdb.CreateTestWorkspace(t, pool, wsB) // committed outside the replay tx

	up, down := loadMigration005(t)

	conn, err := pool.Acquire(ctx)
	require.NoError(t, err)
	defer conn.Release()

	execScript(t, conn, "BEGIN")
	defer execScript(t, conn, "ROLLBACK") // leave the migrated schema untouched

	// Restore the pre-registry world (per-table unique constraints, no
	// registry, no triggers).
	execScript(t, conn, down)

	// Seed the pre-migration state. 'dupe0001' exists three times across
	// workspaces/tables — legal under per-workspace uniqueness. created_at
	// fixes the age order: itemA (2024-01) is the oldest and must keep the
	// code. 'BAD-CODE' fails the registry CHECK and must be regenerated.
	var itemA, itemB, locB, contB uuid.UUID
	require.NoError(t, conn.QueryRow(ctx, `
		INSERT INTO warehouse.items (workspace_id, sku, name, min_stock_level, short_code, created_at)
		VALUES ($1, 'SKU-OLD', 'Oldest Item', 0, 'dupe0001', '2024-01-01T00:00:00Z')
		RETURNING id`, wsA).Scan(&itemA))
	require.NoError(t, conn.QueryRow(ctx, `
		INSERT INTO warehouse.locations (workspace_id, name, short_code, created_at)
		VALUES ($1, 'Newer Location', 'dupe0001', '2024-06-01T00:00:00Z')
		RETURNING id`, wsB).Scan(&locB))
	require.NoError(t, conn.QueryRow(ctx, `
		INSERT INTO warehouse.items (workspace_id, sku, name, min_stock_level, short_code, created_at)
		VALUES ($1, 'SKU-NEW', 'Newest Item', 0, 'dupe0001', '2025-01-01T00:00:00Z')
		RETURNING id`, wsB).Scan(&itemB))
	require.NoError(t, conn.QueryRow(ctx, `
		INSERT INTO warehouse.containers (workspace_id, name, location_id, short_code, created_at)
		VALUES ($1, 'Hyphen Container', $2, 'BAD-CODE', '2024-03-01T00:00:00Z')
		RETURNING id`, wsB, locB).Scan(&contB))

	// Replay the migration: creates the registry and runs the backfill.
	execScript(t, conn, up)

	regenerated := regexp.MustCompile(`^[a-f0-9]{8}$`)

	// Oldest entity keeps its code; the registry points at it.
	var code string
	var needsReview bool
	require.NoError(t, conn.QueryRow(ctx,
		`SELECT short_code, needs_review FROM warehouse.items WHERE id = $1`, itemA).
		Scan(&code, &needsReview))
	assert.Equal(t, "dupe0001", code, "oldest entity keeps the contested code")
	assert.False(t, needsReview, "the winner must not be flagged")

	var regEntityID uuid.UUID
	var regType string
	require.NoError(t, conn.QueryRow(ctx,
		`SELECT entity_id, lower(entity_type::text) FROM warehouse.short_codes WHERE code = 'dupe0001'`).
		Scan(&regEntityID, &regType))
	assert.Equal(t, itemA, regEntityID)
	assert.Equal(t, "item", regType)

	// Newer location loses the code and gets a regenerated conforming one.
	require.NoError(t, conn.QueryRow(ctx,
		`SELECT short_code FROM warehouse.locations WHERE id = $1`, locB).Scan(&code))
	assert.NotEqual(t, "dupe0001", code, "newer location must lose the code")
	assert.Regexp(t, regenerated, code)

	// Newest item loses the code AND is flagged needs_review.
	require.NoError(t, conn.QueryRow(ctx,
		`SELECT short_code, needs_review FROM warehouse.items WHERE id = $1`, itemB).
		Scan(&code, &needsReview))
	assert.NotEqual(t, "dupe0001", code, "newest item must lose the code")
	assert.Regexp(t, regenerated, code)
	assert.True(t, needsReview, "regenerated items are flagged for review")

	// Nonconforming code is regenerated even without a collision.
	require.NoError(t, conn.QueryRow(ctx,
		`SELECT short_code FROM warehouse.containers WHERE id = $1`, contB).Scan(&code))
	assert.NotEqual(t, "BAD-CODE", code, "nonconforming code must be regenerated")
	assert.Regexp(t, regenerated, code)

	// Every seeded entity ended up registered exactly once.
	var n int
	require.NoError(t, conn.QueryRow(ctx,
		`SELECT count(*) FROM warehouse.short_codes WHERE entity_id IN ($1, $2, $3, $4)`,
		itemA, itemB, locB, contB).Scan(&n))
	assert.Equal(t, 4, n, "all four entities must be in the registry")
}
