//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// dashboardRepos bundles the repositories needed to seed dashboard fixtures.
type dashboardRepos struct {
	analytics *AnalyticsRepository
	item      *ItemRepository
	inventory *InventoryRepository
	location  *LocationRepository
	container *ContainerRepository
	category  *CategoryRepository
	borrower  *BorrowerRepository
	loan      *LoanRepository
}

func newDashboardRepos(pool *pgxpool.Pool) dashboardRepos {
	return dashboardRepos{
		analytics: NewAnalyticsRepository(pool),
		item:      NewItemRepository(pool),
		inventory: NewInventoryRepository(pool),
		location:  NewLocationRepository(pool),
		container: NewContainerRepository(pool),
		category:  NewCategoryRepository(pool),
		borrower:  NewBorrowerRepository(pool),
		loan:      NewLoanRepository(pool),
	}
}

// seedDashboardData creates one of each entity type in workspaceID: a
// well-stocked item, a low-stock item (min_stock_level 5, qty 2), an active
// loan, and an overdue loan.
func seedDashboardData(t *testing.T, r dashboardRepos, ctx context.Context, workspaceID uuid.UUID) {
	t.Helper()

	loc, err := location.NewLocation(workspaceID, "Dash Location", nil, nil, uuid.NewString()[:8])
	require.NoError(t, err)
	require.NoError(t, r.location.Save(ctx, loc))

	con, err := container.NewContainer(workspaceID, loc.ID(), "Dash Container", nil, nil, uuid.NewString()[:8])
	require.NoError(t, err)
	require.NoError(t, r.container.Save(ctx, con))

	cat, err := category.NewCategory(workspaceID, "Dash Category", nil, nil)
	require.NoError(t, err)
	require.NoError(t, r.category.Save(ctx, cat))

	// Well-stocked item.
	itm, err := item.NewItem(workspaceID, "Dash Item", "SKU-"+uuid.NewString()[:8], 0)
	require.NoError(t, err)
	itm.SetShortCode(uuid.NewString()[:8])
	require.NoError(t, r.item.Save(ctx, itm))
	inv, err := inventory.NewInventory(workspaceID, itm.ID(), loc.ID(), nil, 10, inventory.ConditionNew, inventory.StatusAvailable, nil)
	require.NoError(t, err)
	require.NoError(t, r.inventory.Save(ctx, inv))

	// Low-stock item: min_stock_level 5, only 2 on hand.
	lowItm, err := item.NewItem(workspaceID, "Low Stock Item", "SKU-"+uuid.NewString()[:8], 5)
	require.NoError(t, err)
	lowItm.SetShortCode(uuid.NewString()[:8])
	require.NoError(t, r.item.Save(ctx, lowItm))
	lowInv, err := inventory.NewInventory(workspaceID, lowItm.ID(), loc.ID(), nil, 2, inventory.ConditionNew, inventory.StatusAvailable, nil)
	require.NoError(t, err)
	require.NoError(t, r.inventory.Save(ctx, lowInv))

	bor, err := borrower.NewBorrower(workspaceID, "Dash Borrower", nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, r.borrower.Create(ctx, bor))

	// Active loan, not overdue.
	activeLoan, err := loan.NewLoan(workspaceID, inv.ID(), bor.ID(), 1, time.Now(), nil, nil)
	require.NoError(t, err)
	require.NoError(t, r.loan.Save(ctx, activeLoan))

	// Active loan that is also overdue.
	pastDue := time.Now().AddDate(0, 0, -7)
	overdueLoan, err := loan.NewLoan(workspaceID, lowInv.ID(), bor.ID(), 1, time.Now().AddDate(0, 0, -14), &pastDue, nil)
	require.NoError(t, err)
	require.NoError(t, r.loan.Save(ctx, overdueLoan))
}

func TestAnalyticsRepository_GetDashboardStats(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repos := newDashboardRepos(pool)
	ctx := context.Background()

	t.Run("aggregates counts correctly against seeded rows", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)
		seedDashboardData(t, repos, ctx, workspaceID)

		stats, err := repos.analytics.GetDashboardStats(ctx, workspaceID)
		require.NoError(t, err)

		assert.EqualValues(t, 2, stats.TotalItems)
		assert.EqualValues(t, 2, stats.TotalInventory)
		assert.EqualValues(t, 1, stats.TotalLocations)
		assert.EqualValues(t, 1, stats.TotalContainers)
		assert.EqualValues(t, 2, stats.ActiveLoans)
		assert.EqualValues(t, 1, stats.OverdueLoans)
		assert.EqualValues(t, 1, stats.LowStockItems)
		assert.EqualValues(t, 1, stats.TotalCategories)
		assert.EqualValues(t, 1, stats.TotalBorrowers)
	})

	t.Run("is scoped by workspace", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		seedDashboardData(t, repos, ctx, workspace1)

		stats2, err := repos.analytics.GetDashboardStats(ctx, workspace2)
		require.NoError(t, err)

		assert.EqualValues(t, 0, stats2.TotalItems)
		assert.EqualValues(t, 0, stats2.TotalInventory)
		assert.EqualValues(t, 0, stats2.TotalLocations)
		assert.EqualValues(t, 0, stats2.TotalContainers)
		assert.EqualValues(t, 0, stats2.ActiveLoans)
		assert.EqualValues(t, 0, stats2.OverdueLoans)
		assert.EqualValues(t, 0, stats2.LowStockItems)
		assert.EqualValues(t, 0, stats2.TotalCategories)
		assert.EqualValues(t, 0, stats2.TotalBorrowers)

		stats1, err := repos.analytics.GetDashboardStats(ctx, workspace1)
		require.NoError(t, err)
		assert.EqualValues(t, 2, stats1.TotalItems)
	})
}
