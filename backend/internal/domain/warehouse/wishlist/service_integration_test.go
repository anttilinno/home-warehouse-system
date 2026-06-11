//go:build integration
// +build integration

package wishlist_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/wishlist"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

func getTestPool(t *testing.T) *pgxpool.Pool {
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

// seedWorkspace creates a workspace with a category and an item and returns
// (workspaceID, categoryID, itemID). The workspace is deleted on cleanup
// (cascades through everything).
func seedWorkspace(t *testing.T, pool *pgxpool.Pool) (uuid.UUID, uuid.UUID, uuid.UUID) {
	t.Helper()
	ctx := context.Background()

	workspaceID := uuid.New()
	categoryID := uuid.New()
	itemID := uuid.New()

	_, err := pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Wishlist Test Workspace', $2, NOW(), NOW())
	`, workspaceID, "wish-test-"+uuid.New().String()[:8])
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM auth.workspaces WHERE id = $1`, workspaceID)
	})

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.categories (id, workspace_id, name, created_at, updated_at)
		VALUES ($1, $2, 'Tools', NOW(), NOW())
	`, categoryID, workspaceID)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.items (id, workspace_id, name, sku, short_code, min_stock_level, created_at, updated_at)
		VALUES ($1, $2, 'Cordless Drill', $3, $4, 0, NOW(), NOW())
	`, itemID, workspaceID, "WSH-"+uuid.New().String()[:8], "W"+uuid.New().String()[:7])
	require.NoError(t, err)

	return workspaceID, categoryID, itemID
}

func newService(pool *pgxpool.Pool) *wishlist.Service {
	return wishlist.NewService(
		postgres.NewWishlistRepository(pool),
		postgres.NewCategoryRepository(pool),
		postgres.NewItemRepository(pool),
	)
}

func TestService_CRUDLifecycle(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceID, categoryID, _ := seedWorkspace(t, pool)
	svc := newService(pool)

	price := 12999
	currency := "EUR"
	url := "https://shop.example/drill"
	created, err := svc.Create(ctx, wishlist.CreateInput{
		WorkspaceID:       workspaceID,
		Name:              "New drill",
		URL:               &url,
		PriceEstimate:     &price,
		CurrencyCode:      &currency,
		Priority:          1,
		DesiredCategoryID: &categoryID,
	})
	require.NoError(t, err)
	assert.Equal(t, wishlist.StatusWanted, created.Status())

	// Round-trips through the database.
	loaded, err := svc.GetByID(ctx, created.ID(), workspaceID)
	require.NoError(t, err)
	assert.Equal(t, "New drill", loaded.Name())
	require.NotNil(t, loaded.PriceEstimate())
	assert.Equal(t, price, *loaded.PriceEstimate())
	require.NotNil(t, loaded.DesiredCategoryID())
	assert.Equal(t, categoryID, *loaded.DesiredCategoryID())

	// Partial update keeps untouched fields.
	newName := "New cordless drill"
	updated, err := svc.Update(ctx, created.ID(), workspaceID, wishlist.UpdateInput{Name: &newName})
	require.NoError(t, err)
	assert.Equal(t, newName, updated.Name())
	require.NotNil(t, updated.PriceEstimate())
	assert.Equal(t, price, *updated.PriceEstimate())

	// Delete removes the row.
	require.NoError(t, svc.Delete(ctx, created.ID(), workspaceID))
	_, err = svc.GetByID(ctx, created.ID(), workspaceID)
	assert.ErrorIs(t, err, shared.ErrNotFound)
}

func TestService_List_StatusFilterAndPrioritySort(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceID, _, _ := seedWorkspace(t, pool)
	svc := newService(pool)

	mk := func(name string, priority int) *wishlist.Item {
		item, err := svc.Create(ctx, wishlist.CreateInput{
			WorkspaceID: workspaceID,
			Name:        name,
			Priority:    priority,
		})
		require.NoError(t, err)
		return item
	}

	low := mk("Low priority wish", 5)
	high := mk("High priority wish", 1)
	mid := mk("Mid priority wish", 3)

	// Move one to ordered.
	ordered := wishlist.StatusOrdered
	_, err := svc.Update(ctx, mid.ID(), workspaceID, wishlist.UpdateInput{Status: &ordered})
	require.NoError(t, err)

	// All statuses, sorted by priority (1 first).
	all, total, err := svc.List(ctx, workspaceID, nil, shared.Pagination{Page: 1, PageSize: 50})
	require.NoError(t, err)
	assert.Equal(t, 3, total)
	require.Len(t, all, 3)
	assert.Equal(t, high.ID(), all[0].ID())
	assert.Equal(t, mid.ID(), all[1].ID())
	assert.Equal(t, low.ID(), all[2].ID())

	// Status filter.
	wanted := wishlist.StatusWanted
	onlyWanted, total, err := svc.List(ctx, workspaceID, &wanted, shared.Pagination{Page: 1, PageSize: 50})
	require.NoError(t, err)
	assert.Equal(t, 2, total)
	require.Len(t, onlyWanted, 2)
	for _, w := range onlyWanted {
		assert.Equal(t, wishlist.StatusWanted, w.Status())
	}
}

// TestService_AcquireFlow exercises the orchestrated acquire path: the
// frontend creates the real item, then PATCHes the wishlist row with
// status=acquired + acquired_item_id to link back and close it.
func TestService_AcquireFlow(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceID, _, itemID := seedWorkspace(t, pool)
	svc := newService(pool)

	wish, err := svc.Create(ctx, wishlist.CreateInput{
		WorkspaceID: workspaceID,
		Name:        "Cordless Drill",
		Priority:    2,
	})
	require.NoError(t, err)

	acquired := wishlist.StatusAcquired
	closed, err := svc.Update(ctx, wish.ID(), workspaceID, wishlist.UpdateInput{
		Status:         &acquired,
		AcquiredItemID: &itemID,
	})
	require.NoError(t, err)
	assert.Equal(t, wishlist.StatusAcquired, closed.Status())
	require.NotNil(t, closed.AcquiredItemID())
	assert.Equal(t, itemID, *closed.AcquiredItemID())

	// Terminal: re-opening an acquired row is rejected.
	wantedAgain := wishlist.StatusWanted
	_, err = svc.Update(ctx, wish.ID(), workspaceID, wishlist.UpdateInput{Status: &wantedAgain})
	assert.ErrorIs(t, err, wishlist.ErrInvalidStatusTransition)

	// Linking an item from another workspace is rejected (tenant scoping).
	otherWorkspaceID, _, otherItemID := seedWorkspace(t, pool)
	_ = otherWorkspaceID
	wish2, err := svc.Create(ctx, wishlist.CreateInput{
		WorkspaceID: workspaceID,
		Name:        "Other wish",
		Priority:    3,
	})
	require.NoError(t, err)
	_, err = svc.Update(ctx, wish2.ID(), workspaceID, wishlist.UpdateInput{
		Status:         &acquired,
		AcquiredItemID: &otherItemID,
	})
	assert.ErrorIs(t, err, shared.ErrNotFound, "cross-tenant acquired_item_id must 404")
}

// TestService_CrossWorkspaceIsolation guards the workspace scoping of reads.
func TestService_CrossWorkspaceIsolation(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceA, _, _ := seedWorkspace(t, pool)
	workspaceB, _, _ := seedWorkspace(t, pool)
	svc := newService(pool)

	wish, err := svc.Create(ctx, wishlist.CreateInput{
		WorkspaceID: workspaceA,
		Name:        "Workspace A wish",
		Priority:    3,
	})
	require.NoError(t, err)

	_, err = svc.GetByID(ctx, wish.ID(), workspaceB)
	assert.ErrorIs(t, err, shared.ErrNotFound)

	items, total, err := svc.List(ctx, workspaceB, nil, shared.Pagination{Page: 1, PageSize: 50})
	require.NoError(t, err)
	assert.Equal(t, 0, total)
	assert.Empty(t, items)
}
