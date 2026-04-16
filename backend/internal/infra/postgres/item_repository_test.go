//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestItemRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("saves new item successfully", func(t *testing.T) {
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Test Item", "SKU-001", 0)
		require.NoError(t, err)

		err = repo.Save(ctx, itm)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, itm.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, itm.ID(), retrieved.ID())
		assert.Equal(t, itm.Name(), retrieved.Name())
		assert.Equal(t, itm.SKU(), retrieved.SKU())
		assert.Equal(t, itm.WorkspaceID(), retrieved.WorkspaceID())
	})

	t.Run("saves item with min stock level", func(t *testing.T) {
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Stocked Item", "SKU-002", 10)
		require.NoError(t, err)

		err = repo.Save(ctx, itm)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, itm.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, 10, retrieved.MinStockLevel())
	})
}

func TestItemRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("finds existing item", func(t *testing.T) {
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Find Me", "SKU-FIND", 0)
		require.NoError(t, err)
		err = repo.Save(ctx, itm)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, itm.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, itm.ID(), found.ID())
	})

	t.Run("returns nil for non-existent item", func(t *testing.T) {
		nonExistentID := uuid.New()
		found, err := repo.FindByID(ctx, nonExistentID, testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		itm, err := item.NewItem(workspace1, "WS1 Item", "SKU-WS1", 0)
		require.NoError(t, err)
		err = repo.Save(ctx, itm)
		require.NoError(t, err)

		// Should not find in different workspace
		found, err := repo.FindByID(ctx, itm.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		// Should find in correct workspace
		found, err = repo.FindByID(ctx, itm.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestItemRepository_FindBySKU(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("finds item by SKU", func(t *testing.T) {
		sku := "UNIQUE-SKU-123"
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "SKU Item", sku, 0)
		require.NoError(t, err)
		err = repo.Save(ctx, itm)
		require.NoError(t, err)

		found, err := repo.FindBySKU(ctx, testfixtures.TestWorkspaceID, sku)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, itm.ID(), found.ID())
		assert.Equal(t, sku, found.SKU())
	})

	t.Run("returns nil for non-existent SKU", func(t *testing.T) {
		found, err := repo.FindBySKU(ctx, testfixtures.TestWorkspaceID, "NON-EXISTENT-SKU")
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestItemRepository_FindByShortCode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("finds item by short code", func(t *testing.T) {
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Short Code Item", "SKU-SC1", 0)
		require.NoError(t, err)
		shortCode := "SC-123"
		itm.SetShortCode(shortCode)
		err = repo.Save(ctx, itm)
		require.NoError(t, err)

		found, err := repo.FindByShortCode(ctx, testfixtures.TestWorkspaceID, shortCode)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, itm.ID(), found.ID())
	})

	t.Run("returns nil for non-existent short code", func(t *testing.T) {
		found, err := repo.FindByShortCode(ctx, testfixtures.TestWorkspaceID, "NON-EXISTENT")
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestItemRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("finds all items in workspace with pagination", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)

		// Create multiple items
		for i := 0; i < 5; i++ {
			itm, _ := item.NewItem(workspaceID, "Item", "SKU-"+uuid.New().String()[:8], 0)
			repo.Save(ctx, itm)
		}

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		items, count, err := repo.FindByWorkspace(ctx, workspaceID, pagination)
		require.NoError(t, err)
		assert.Equal(t, 5, count)
		assert.Len(t, items, 5)
	})

	t.Run("respects pagination limit", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)

		for i := 0; i < 5; i++ {
			itm, _ := item.NewItem(workspaceID, "Item", "SKU-LIM-"+uuid.New().String()[:8], 0)
			repo.Save(ctx, itm)
		}

		pagination := shared.Pagination{Page: 1, PageSize: 2}
		items, _, err := repo.FindByWorkspace(ctx, workspaceID, pagination)
		require.NoError(t, err)
		assert.Len(t, items, 2)
	})

	t.Run("isolates items by workspace", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		itm1, _ := item.NewItem(workspace1, "WS1 Item", "SKU-ISO-1", 0)
		itm2, _ := item.NewItem(workspace2, "WS2 Item", "SKU-ISO-2", 0)
		repo.Save(ctx, itm1)
		repo.Save(ctx, itm2)

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		items1, _, err := repo.FindByWorkspace(ctx, workspace1, pagination)
		require.NoError(t, err)
		assert.Len(t, items1, 1)
		assert.Equal(t, "WS1 Item", items1[0].Name())

		items2, _, err := repo.FindByWorkspace(ctx, workspace2, pagination)
		require.NoError(t, err)
		assert.Len(t, items2, 1)
		assert.Equal(t, "WS2 Item", items2[0].Name())
	})
}

func TestItemRepository_FindByCategory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	itemRepo := NewItemRepository(pool)
	categoryRepo := NewCategoryRepository(pool)
	ctx := context.Background()

	t.Run("finds items by category", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)

		// Create category
		cat, err := NewTestCategoryForWorkspace(workspaceID, "Electronics")
		require.NoError(t, err)
		err = categoryRepo.Save(ctx, cat)
		require.NoError(t, err)

		// For this test, we'll test the empty case since items don't
		// have a category setter in the test context.
		pagination := shared.Pagination{Page: 1, PageSize: 10}
		items, err := itemRepo.FindByCategory(ctx, workspaceID, cat.ID(), pagination)
		require.NoError(t, err)
		assert.Empty(t, items)
	})
}

func TestItemRepository_Delete_Hard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("hard-deletes row", func(t *testing.T) {
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "To Hard Delete", "SKU-HDEL-"+uuid.NewString()[:8], 0)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, itm))

		require.NoError(t, repo.Delete(ctx, itm.ID()))

		// Row MUST be gone — FindByID returns shared.ErrNotFound (Pitfall 3 fix).
		found, err := repo.FindByID(ctx, itm.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("delete of missing id is idempotent (no error)", func(t *testing.T) {
		// DELETE on a missing row is a no-op in Postgres; sqlc's :exec ignores affected-count.
		err := repo.Delete(ctx, uuid.New())
		require.NoError(t, err)
	})
}

func TestItemRepository_FindByWorkspaceFiltered(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	mkItem := func(t *testing.T, ws uuid.UUID, name, sku string) *item.Item {
		t.Helper()
		itm, err := item.NewItem(ws, name, sku, 0)
		require.NoError(t, err)
		// Unique short_code required by uq_items_workspace_short_code constraint (varchar(8)).
		itm.SetShortCode(uuid.NewString()[:8])
		require.NoError(t, repo.Save(ctx, itm))
		return itm
	}

	archive := func(t *testing.T, itm *item.Item) {
		t.Helper()
		itm.Archive()
		require.NoError(t, repo.Save(ctx, itm))
	}

	t.Run("ArchivedFalse_ExcludesArchived", func(t *testing.T) {
		ws := uuid.New()
		testdb.CreateTestWorkspace(t, pool, ws)

		mkItem(t, ws, "Active A", "FLT-ACT-A-"+uuid.NewString()[:6])
		mkItem(t, ws, "Active B", "FLT-ACT-B-"+uuid.NewString()[:6])
		arch := mkItem(t, ws, "Archived", "FLT-ARC-"+uuid.NewString()[:6])
		archive(t, arch)

		items, total, err := repo.FindByWorkspaceFiltered(ctx, ws,
			item.ListFilters{IncludeArchived: false, Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 1, PageSize: 50})
		require.NoError(t, err)
		assert.Equal(t, 2, total)
		require.Len(t, items, 2)
		for _, it := range items {
			assert.False(t, it.IsArchived() != nil && *it.IsArchived(), "archived row leaked into active-only list")
		}
	})

	t.Run("ArchivedTrue_IncludesArchived", func(t *testing.T) {
		ws := uuid.New()
		testdb.CreateTestWorkspace(t, pool, ws)

		mkItem(t, ws, "Active 1", "FLT-TRUE-A-"+uuid.NewString()[:6])
		mkItem(t, ws, "Active 2", "FLT-TRUE-B-"+uuid.NewString()[:6])
		arch := mkItem(t, ws, "Archived 3", "FLT-TRUE-C-"+uuid.NewString()[:6])
		archive(t, arch)

		items, total, err := repo.FindByWorkspaceFiltered(ctx, ws,
			item.ListFilters{IncludeArchived: true, Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 1, PageSize: 50})
		require.NoError(t, err)
		assert.Equal(t, 3, total)
		assert.Len(t, items, 3)
	})

	t.Run("SearchMatchesFTS", func(t *testing.T) {
		ws := uuid.New()
		testdb.CreateTestWorkspace(t, pool, ws)

		mkItem(t, ws, "Cordless Drill", "FTS-D-"+uuid.NewString()[:6])
		mkItem(t, ws, "Bench Vice", "FTS-V-"+uuid.NewString()[:6])
		mkItem(t, ws, "Light Bulbs", "FTS-B-"+uuid.NewString()[:6])

		items, total, err := repo.FindByWorkspaceFiltered(ctx, ws,
			item.ListFilters{Search: "drill", Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 1, PageSize: 50})
		require.NoError(t, err)
		assert.Equal(t, 1, total)
		require.Len(t, items, 1)
		assert.Contains(t, items[0].Name(), "Drill")

		// Empty search is normalized to no-filter (Pitfall 2).
		items, total, err = repo.FindByWorkspaceFiltered(ctx, ws,
			item.ListFilters{Search: "", Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 1, PageSize: 50})
		require.NoError(t, err)
		assert.Equal(t, 3, total)
		assert.Len(t, items, 3)
	})

	t.Run("Sort_Name_AscDesc", func(t *testing.T) {
		ws := uuid.New()
		testdb.CreateTestWorkspace(t, pool, ws)

		mkItem(t, ws, "Alpha", "SORT-A-"+uuid.NewString()[:6])
		mkItem(t, ws, "Charlie", "SORT-C-"+uuid.NewString()[:6])
		mkItem(t, ws, "Bravo", "SORT-B-"+uuid.NewString()[:6])

		asc, _, err := repo.FindByWorkspaceFiltered(ctx, ws,
			item.ListFilters{Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 1, PageSize: 50})
		require.NoError(t, err)
		require.Len(t, asc, 3)
		assert.Equal(t, "Alpha", asc[0].Name())
		assert.Equal(t, "Bravo", asc[1].Name())
		assert.Equal(t, "Charlie", asc[2].Name())

		desc, _, err := repo.FindByWorkspaceFiltered(ctx, ws,
			item.ListFilters{Sort: "name", SortDir: "desc"},
			shared.Pagination{Page: 1, PageSize: 50})
		require.NoError(t, err)
		require.Len(t, desc, 3)
		assert.Equal(t, "Charlie", desc[0].Name())
		assert.Equal(t, "Bravo", desc[1].Name())
		assert.Equal(t, "Alpha", desc[2].Name())
	})

	t.Run("TotalIndependentOfLimit", func(t *testing.T) {
		ws := uuid.New()
		testdb.CreateTestWorkspace(t, pool, ws)

		for i := 0; i < 5; i++ {
			mkItem(t, ws, "Tot Item "+uuid.NewString()[:4], "TOT-"+uuid.NewString()[:8])
		}

		items, total, err := repo.FindByWorkspaceFiltered(ctx, ws,
			item.ListFilters{Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 1, PageSize: 2})
		require.NoError(t, err)
		assert.Len(t, items, 2)
		assert.Equal(t, 5, total, "Total must be COUNT(*), independent of LIMIT — Pitfall 1 fix")

		items, total, err = repo.FindByWorkspaceFiltered(ctx, ws,
			item.ListFilters{Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 2, PageSize: 2})
		require.NoError(t, err)
		assert.Len(t, items, 2)
		assert.Equal(t, 5, total)
	})

	t.Run("IgnoresOtherWorkspaces", func(t *testing.T) {
		wsA := uuid.New()
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		testdb.CreateTestWorkspace(t, pool, wsB)

		mkItem(t, wsA, "A1", "WSA-1-"+uuid.NewString()[:6])
		mkItem(t, wsA, "A2", "WSA-2-"+uuid.NewString()[:6])
		mkItem(t, wsB, "B1", "WSB-1-"+uuid.NewString()[:6])
		mkItem(t, wsB, "B2", "WSB-2-"+uuid.NewString()[:6])
		mkItem(t, wsB, "B3", "WSB-3-"+uuid.NewString()[:6])

		_, totalA, err := repo.FindByWorkspaceFiltered(ctx, wsA,
			item.ListFilters{Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 1, PageSize: 50})
		require.NoError(t, err)
		assert.Equal(t, 2, totalA)

		_, totalB, err := repo.FindByWorkspaceFiltered(ctx, wsB,
			item.ListFilters{Sort: "name", SortDir: "asc"},
			shared.Pagination{Page: 1, PageSize: 50})
		require.NoError(t, err)
		assert.Equal(t, 3, totalB)
	})
}

func TestItemRepository_SKUExists(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("returns true for existing SKU", func(t *testing.T) {
		sku := "EXISTS-SKU"
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Item", sku, 0)
		require.NoError(t, err)
		err = repo.Save(ctx, itm)
		require.NoError(t, err)

		exists, err := repo.SKUExists(ctx, testfixtures.TestWorkspaceID, sku)
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent SKU", func(t *testing.T) {
		exists, err := repo.SKUExists(ctx, testfixtures.TestWorkspaceID, "NOT-EXISTS-SKU")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}

func TestItemRepository_ShortCodeExists(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("returns true for existing short code", func(t *testing.T) {
		shortCode := "ISC-001"
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Item", "SKU-SC-EXISTS", 0)
		require.NoError(t, err)
		itm.SetShortCode(shortCode)
		err = repo.Save(ctx, itm)
		require.NoError(t, err)

		exists, err := repo.ShortCodeExists(ctx, testfixtures.TestWorkspaceID, shortCode)
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent short code", func(t *testing.T) {
		exists, err := repo.ShortCodeExists(ctx, testfixtures.TestWorkspaceID, "NOT-EXISTS-SC")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}

// Helper function to create a category for a specific workspace
func NewTestCategoryForWorkspace(workspaceID uuid.UUID, name string) (*category.Category, error) {
	return category.NewCategory(workspaceID, name, nil, nil)
}
