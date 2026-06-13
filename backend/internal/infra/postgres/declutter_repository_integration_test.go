//go:build integration
// +build integration

package postgres

// Plan 17-04 (POL-01) gap-fill. The declutter domain was the single
// HTTP-crossing flow with ZERO real-backend coverage: its only test
// (internal/domain/warehouse/declutter/handler_test.go) is a mock.Mock unit
// test, and on the browser side the /declutter route is only render-swept by
// e2e/a11y-sweep.spec.ts (no GET /declutter data flow, no POST mark-used).
//
// This tagged integration test exercises the full declutter Service -> repo
// -> real Postgres stack via the tests/testdb harness (Phase-65-11 pattern):
//   * GET  /declutter        (ListUnused: threshold + score)
//   * GET  /declutter/counts (GetCounts: unused_90/value_90 aggregates, cents)
//   * POST /inventory/{id}/mark-used (MarkUsed: clears the unused flag +
//     enforces WHERE workspace_id tenant isolation)
//
// The unused query keys off `COALESCE(last_used_at, created_at) < NOW() -
// interval`, so a freshly-created row is NOT unused; we backdate created_at
// via direct SQL to make the threshold deterministic.

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/declutter"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func containsInv(items []declutter.DeclutterItem, id uuid.UUID) bool {
	for i := range items {
		if items[i].ID == id {
			return true
		}
	}
	return false
}

func TestDeclutterService_UnusedLifecycle(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	ctx := context.Background()

	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	invRepo := NewInventoryRepository(pool)
	declutterRepo := NewDeclutterRepository(pool)
	svc := declutter.NewService(declutterRepo)

	ws := testfixtures.TestWorkspaceID

	// seed creates one inventory row, then backdates created_at past the
	// declutter threshold and attaches a purchase price (cents) so both the
	// COALESCE(last_used_at, created_at) cutoff and the value_* aggregates fire.
	seed := func(t *testing.T, name string, ageDays, priceCents int) uuid.UUID {
		t.Helper()

		itm, err := item.NewItem(ws, name, "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, err)
		itm.SetShortCode(uuid.NewString()[:8])
		require.NoError(t, itemRepo.Save(ctx, itm))

		loc, err := location.NewLocation(ws, name+" Loc", nil, nil, uuid.NewString()[:8])
		require.NoError(t, err)
		require.NoError(t, locRepo.Save(ctx, loc))

		inv, err := inventory.NewInventory(
			ws, itm.ID(), loc.ID(), nil, 1,
			inventory.ConditionGood, inventory.StatusAvailable, nil,
		)
		require.NoError(t, err)
		require.NoError(t, invRepo.Save(ctx, inv))

		_, err = pool.Exec(ctx, `
			UPDATE warehouse.inventory
			SET created_at = NOW() - make_interval(days => $2),
			    last_used_at = NULL,
			    purchase_price = $3
			WHERE id = $1
		`, inv.ID(), ageDays, priceCents)
		require.NoError(t, err)

		return inv.ID()
	}

	t.Run("ListUnused surfaces a backdated row with a non-zero score", func(t *testing.T) {
		invID := seed(t, "Dusty Drill", 200, 5000) // 200 days unused, 50.00

		res, err := svc.ListUnused(ctx, declutter.ListParams{
			WorkspaceID:   ws,
			ThresholdDays: 90,
			GroupBy:       declutter.GroupByNone,
			Page:          1,
			PageSize:      50,
		})
		require.NoError(t, err)
		require.NotNil(t, res)
		assert.GreaterOrEqual(t, res.Total, 1)

		var found *declutter.DeclutterItem
		for i := range res.Items {
			if res.Items[i].ID == invID {
				found = &res.Items[i]
				break
			}
		}
		require.NotNil(t, found, "backdated inventory should appear in the unused list")
		assert.GreaterOrEqual(t, found.DaysUnused, 90)
		assert.Greater(t, found.Score, 0, "service layer must compute a score")
	})

	t.Run("GetCounts aggregates unused buckets and value in cents", func(t *testing.T) {
		_ = seed(t, "Old Ladder", 400, 12000) // crosses 90/180/365, 120.00

		counts, err := svc.GetCounts(ctx, ws)
		require.NoError(t, err)
		require.NotNil(t, counts)
		assert.GreaterOrEqual(t, counts.Unused365, 1)
		assert.GreaterOrEqual(t, counts.Value365, int64(12000),
			"value_* are summed purchase_price cents")
	})

	t.Run("MarkUsed clears the unused flag for the owning workspace", func(t *testing.T) {
		invID := seed(t, "Forgotten Saw", 300, 3000)

		before, err := svc.ListUnused(ctx, declutter.ListParams{
			WorkspaceID: ws, ThresholdDays: 90, GroupBy: declutter.GroupByNone,
			Page: 1, PageSize: 200,
		})
		require.NoError(t, err)
		assert.True(t, containsInv(before.Items, invID), "row is unused before MarkUsed")

		require.NoError(t, svc.MarkUsed(ctx, invID, ws))

		after, err := svc.ListUnused(ctx, declutter.ListParams{
			WorkspaceID: ws, ThresholdDays: 90, GroupBy: declutter.GroupByNone,
			Page: 1, PageSize: 200,
		})
		require.NoError(t, err)
		assert.False(t, containsInv(after.Items, invID),
			"MarkUsed sets last_used_at=NOW(), so the row drops off the unused list")
	})

	t.Run("MarkUsed enforces workspace isolation (cross-tenant 404)", func(t *testing.T) {
		invID := seed(t, "Tenant-Scoped Wrench", 300, 1000)

		otherWS := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWS)

		err := svc.MarkUsed(ctx, invID, otherWS)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err),
			"mark-used on a row from another workspace must be ErrNotFound, not a silent cross-tenant write")
	})
}
