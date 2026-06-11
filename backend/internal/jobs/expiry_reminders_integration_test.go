//go:build integration
// +build integration

package jobs

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

func getTestPoolForExpiry(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://wh:wh@localhost:5432/warehouse_test"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Skipf("skipping integration test: database connection failed: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("skipping integration test: database ping failed: %v", err)
	}

	t.Cleanup(func() { pool.Close() })
	return pool
}

// expiryFixture seeds one workspace with a location and creates items +
// inventory rows on demand.
type expiryFixture struct {
	pool        *pgxpool.Pool
	workspaceID uuid.UUID
	locationID  uuid.UUID
}

func newExpiryFixture(t *testing.T, pool *pgxpool.Pool) *expiryFixture {
	t.Helper()
	ctx := context.Background()

	f := &expiryFixture{
		pool:        pool,
		workspaceID: uuid.New(),
		locationID:  uuid.New(),
	}

	_, err := pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Expiry Test Workspace', $2, NOW(), NOW())
	`, f.workspaceID, "expiry-test-"+uuid.New().String()[:8])
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM auth.workspaces WHERE id = $1`, f.workspaceID)
	})

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.locations (id, workspace_id, name, short_code, created_at, updated_at)
		VALUES ($1, $2, 'Expiry Test Location', $3, NOW(), NOW())
	`, f.locationID, f.workspaceID, "L"+uuid.New().String()[:7])
	require.NoError(t, err)

	return f
}

// addInventory creates an item (optionally with lifetime warranty) plus one
// inventory row with the given dates and returns the inventory ID.
func (f *expiryFixture) addInventory(t *testing.T, name string, lifetimeWarranty bool, expirationDate, warrantyExpires *time.Time, archived bool) uuid.UUID {
	t.Helper()
	ctx := context.Background()

	itemID := uuid.New()
	inventoryID := uuid.New()

	_, err := f.pool.Exec(ctx, `
		INSERT INTO warehouse.items (id, workspace_id, name, sku, short_code, min_stock_level, lifetime_warranty, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 0, $6, NOW(), NOW())
	`, itemID, f.workspaceID, name, "EXP-"+uuid.New().String()[:8], "I"+uuid.New().String()[:7], lifetimeWarranty)
	require.NoError(t, err)

	_, err = f.pool.Exec(ctx, `
		INSERT INTO warehouse.inventory (id, workspace_id, item_id, location_id, quantity, condition, status, expiration_date, warranty_expires, is_archived, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, 'NEW', 'AVAILABLE', $5, $6, $7, NOW(), NOW())
	`, inventoryID, f.workspaceID, itemID, f.locationID, expirationDate, warrantyExpires, archived)
	require.NoError(t, err)

	return inventoryID
}

func datePtr(t time.Time) *time.Time { return &t }

func TestListInventoryExpiringSoon_Integration(t *testing.T) {
	pool := getTestPoolForExpiry(t)
	ctx := context.Background()
	q := queries.New(pool)

	f := newExpiryFixture(t, pool)
	other := newExpiryFixture(t, pool)

	now := time.Now()
	inWindow := f.addInventory(t, "Milk", false, datePtr(now.AddDate(0, 0, 5)), nil, false)
	atCutoff := f.addInventory(t, "Pills", false, datePtr(now.AddDate(0, 0, 30)), nil, false)
	f.addInventory(t, "Canned Beans", false, datePtr(now.AddDate(0, 0, 60)), nil, false)  // outside window
	f.addInventory(t, "Old Yogurt", false, datePtr(now.AddDate(0, 0, -2)), nil, false)    // already expired
	f.addInventory(t, "No Expiry", false, nil, nil, false)                                // no date
	f.addInventory(t, "Archived Milk", false, datePtr(now.AddDate(0, 0, 5)), nil, true)   // archived
	other.addInventory(t, "Other WS Milk", false, datePtr(now.AddDate(0, 0, 5)), nil, false) // other workspace

	cutoff := pgtype.Date{Time: now.AddDate(0, 0, 30), Valid: true}
	rows, err := q.ListInventoryExpiringSoon(ctx, queries.ListInventoryExpiringSoonParams{
		WorkspaceID:    f.workspaceID,
		ExpirationDate: cutoff,
	})
	require.NoError(t, err)

	ids := make(map[uuid.UUID]string, len(rows))
	for _, r := range rows {
		ids[r.ID] = r.ItemName
	}

	assert.Len(t, rows, 2, "only in-window, non-archived, same-workspace rows expected")
	assert.Equal(t, "Milk", ids[inWindow])
	assert.Equal(t, "Pills", ids[atCutoff])

	// Sorted by expiration date ascending.
	require.Len(t, rows, 2)
	assert.Equal(t, inWindow, rows[0].ID)
	assert.Equal(t, atCutoff, rows[1].ID)

	// 7-day cutoff narrows the result (param-driven windows).
	rows7, err := q.ListInventoryExpiringSoon(ctx, queries.ListInventoryExpiringSoonParams{
		WorkspaceID:    f.workspaceID,
		ExpirationDate: pgtype.Date{Time: now.AddDate(0, 0, 7), Valid: true},
	})
	require.NoError(t, err)
	require.Len(t, rows7, 1)
	assert.Equal(t, inWindow, rows7[0].ID)
}

func TestListWarrantiesExpiringSoon_Integration(t *testing.T) {
	pool := getTestPoolForExpiry(t)
	ctx := context.Background()
	q := queries.New(pool)

	f := newExpiryFixture(t, pool)
	other := newExpiryFixture(t, pool)

	now := time.Now()
	inWindow := f.addInventory(t, "Drill", false, nil, datePtr(now.AddDate(0, 0, 10)), false)
	f.addInventory(t, "Lifetime Wrench", true, nil, datePtr(now.AddDate(0, 0, 10)), false) // lifetime warranty: skipped
	f.addInventory(t, "Long Warranty TV", false, nil, datePtr(now.AddDate(0, 0, 90)), false)
	f.addInventory(t, "Lapsed Toaster", false, nil, datePtr(now.AddDate(0, 0, -30)), false)
	other.addInventory(t, "Other WS Drill", false, nil, datePtr(now.AddDate(0, 0, 10)), false)

	rows, err := q.ListWarrantiesExpiringSoon(ctx, queries.ListWarrantiesExpiringSoonParams{
		WorkspaceID:     f.workspaceID,
		WarrantyExpires: pgtype.Date{Time: now.AddDate(0, 0, 30), Valid: true},
	})
	require.NoError(t, err)

	require.Len(t, rows, 1, "lifetime-warranty, lapsed, out-of-window and other-workspace rows must be excluded")
	assert.Equal(t, inWindow, rows[0].ID)
	assert.Equal(t, "Drill", rows[0].ItemName)
}
