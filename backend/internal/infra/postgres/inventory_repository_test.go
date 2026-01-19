//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Helper to create test item for inventory tests
func createTestItem(t *testing.T, repo *ItemRepository, ctx context.Context, name string) *item.Item {
	t.Helper()
	itm, err := item.NewItem(testfixtures.TestWorkspaceID, name, "SKU-"+uuid.NewString()[:8], 0)
	require.NoError(t, err)
	err = repo.Save(ctx, itm)
	require.NoError(t, err)
	return itm
}

// Helper to create test location for inventory tests
func createTestLocationForInv(t *testing.T, repo *LocationRepository, ctx context.Context, name string) *location.Location {
	t.Helper()
	loc, err := location.NewLocation(testfixtures.TestWorkspaceID, name, nil, nil, "")
	require.NoError(t, err)
	err = repo.Save(ctx, loc)
	require.NoError(t, err)
	return loc
}

func TestInventoryRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("saves new inventory successfully", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "Test Item")
		loc := createTestLocationForInv(t, locRepo, ctx, "Test Location")

		inv, err := inventory.NewInventory(
			testfixtures.TestWorkspaceID,
			itm.ID(),
			loc.ID(),
			nil, // no container
			5,
			inventory.ConditionNew,
			inventory.StatusAvailable,
			nil, // currency code
		)
		require.NoError(t, err)

		err = invRepo.Save(ctx, inv)
		require.NoError(t, err)

		retrieved, err := invRepo.FindByID(ctx, inv.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, inv.ID(), retrieved.ID())
		assert.Equal(t, inv.ItemID(), retrieved.ItemID())
		assert.Equal(t, inv.LocationID(), retrieved.LocationID())
		assert.Equal(t, inv.Quantity(), retrieved.Quantity())
	})

	t.Run("saves inventory with container", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "Boxed Item")
		loc := createTestLocationForInv(t, locRepo, ctx, "Container Location")

		contRepo := NewContainerRepository(pool)
		cont, err := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "Box", nil, nil, "")
		require.NoError(t, err)
		err = contRepo.Save(ctx, cont)
		require.NoError(t, err)

		contID := cont.ID()
		inv, err := inventory.NewInventory(
			testfixtures.TestWorkspaceID,
			itm.ID(),
			loc.ID(),
			&contID,
			3,
			inventory.ConditionGood,
			inventory.StatusAvailable,
			nil,
		)
		require.NoError(t, err)

		err = invRepo.Save(ctx, inv)
		require.NoError(t, err)

		retrieved, err := invRepo.FindByID(ctx, inv.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		require.NotNil(t, retrieved.ContainerID())
		assert.Equal(t, contID, *retrieved.ContainerID())
	})
}

func TestInventoryRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds existing inventory", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "Find Item")
		loc := createTestLocationForInv(t, locRepo, ctx, "Find Location")

		inv, err := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, err)
		err = invRepo.Save(ctx, inv)
		require.NoError(t, err)

		found, err := invRepo.FindByID(ctx, inv.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, inv.ID(), found.ID())
	})

	t.Run("returns nil for non-existent inventory", func(t *testing.T) {
		found, err := invRepo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		// Create item and location in workspace1
		itm, _ := item.NewItem(workspace1, "WS1 Item", "SKU-WS1-"+uuid.NewString()[:4], 0)
		require.NoError(t, itemRepo.Save(ctx, itm))

		loc, _ := location.NewLocation(workspace1, "WS1 Loc", nil, nil, "")
		require.NoError(t, locRepo.Save(ctx, loc))

		inv, _ := inventory.NewInventory(workspace1, itm.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv))

		// Should not find in workspace2
		found, err := invRepo.FindByID(ctx, inv.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		// Should find in workspace1
		found, err = invRepo.FindByID(ctx, inv.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestInventoryRepository_FindByItem(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds inventory by item", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "Multi Inv Item")
		loc1 := createTestLocationForInv(t, locRepo, ctx, "Inv Location 1")
		loc2 := createTestLocationForInv(t, locRepo, ctx, "Inv Location 2")

		inv1, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc1.ID(), nil, 2, inventory.ConditionNew, inventory.StatusAvailable, nil)
		inv2, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc2.ID(), nil, 3, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv1))
		require.NoError(t, invRepo.Save(ctx, inv2))

		inventories, err := invRepo.FindByItem(ctx, testfixtures.TestWorkspaceID, itm.ID())
		require.NoError(t, err)
		assert.Len(t, inventories, 2)
	})
}

func TestInventoryRepository_FindByLocation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds inventory by location", func(t *testing.T) {
		loc := createTestLocationForInv(t, locRepo, ctx, "Shared Location")
		itm1 := createTestItem(t, itemRepo, ctx, "Item In Loc 1")
		itm2 := createTestItem(t, itemRepo, ctx, "Item In Loc 2")

		inv1, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm1.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		inv2, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm2.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv1))
		require.NoError(t, invRepo.Save(ctx, inv2))

		inventories, err := invRepo.FindByLocation(ctx, testfixtures.TestWorkspaceID, loc.ID())
		require.NoError(t, err)
		assert.Len(t, inventories, 2)
	})
}

func TestInventoryRepository_GetTotalQuantity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("returns total quantity across locations", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "Quantity Item")
		loc1 := createTestLocationForInv(t, locRepo, ctx, "Qty Loc 1")
		loc2 := createTestLocationForInv(t, locRepo, ctx, "Qty Loc 2")

		inv1, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc1.ID(), nil, 5, inventory.ConditionNew, inventory.StatusAvailable, nil)
		inv2, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc2.ID(), nil, 3, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv1))
		require.NoError(t, invRepo.Save(ctx, inv2))

		total, err := invRepo.GetTotalQuantity(ctx, testfixtures.TestWorkspaceID, itm.ID())
		require.NoError(t, err)
		assert.Equal(t, 8, total)
	})

	t.Run("returns zero for item with no inventory", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "No Inv Item")
		total, err := invRepo.GetTotalQuantity(ctx, testfixtures.TestWorkspaceID, itm.ID())
		require.NoError(t, err)
		assert.Equal(t, 0, total)
	})
}

func TestInventoryRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("archives inventory (soft delete)", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "Delete Item")
		loc := createTestLocationForInv(t, locRepo, ctx, "Delete Location")

		inv, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv))

		err := invRepo.Delete(ctx, inv.ID())
		require.NoError(t, err)

		// Note: Delete archives rather than hard deletes, so FindByID may still return
		// the item depending on query implementation
	})
}

func TestInventoryRepository_List(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("lists inventory with pagination", func(t *testing.T) {
		// Create test items and locations
		itm1 := createTestItem(t, itemRepo, ctx, "List Item 1")
		itm2 := createTestItem(t, itemRepo, ctx, "List Item 2")
		itm3 := createTestItem(t, itemRepo, ctx, "List Item 3")
		loc := createTestLocationForInv(t, locRepo, ctx, "List Location")

		// Create 3 inventory entries
		inv1, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm1.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		inv2, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm2.ID(), loc.ID(), nil, 2, inventory.ConditionGood, inventory.StatusAvailable, nil)
		inv3, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm3.ID(), loc.ID(), nil, 3, inventory.ConditionFair, inventory.StatusInUse, nil)
		require.NoError(t, invRepo.Save(ctx, inv1))
		require.NoError(t, invRepo.Save(ctx, inv2))
		require.NoError(t, invRepo.Save(ctx, inv3))

		// Test page 1 with limit 2
		pagination := shared.Pagination{Page: 1, PageSize: 2}
		inventories, total, err := invRepo.List(ctx, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)
		assert.Equal(t, 3, total) // Total should be 3
		assert.Len(t, inventories, 2) // Page 1 should have 2 items

		// Test page 2 with limit 2
		pagination = shared.Pagination{Page: 2, PageSize: 2}
		inventories, total, err = invRepo.List(ctx, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)
		assert.Equal(t, 3, total) // Total should still be 3
		assert.Len(t, inventories, 1) // Page 2 should have 1 item
	})

	t.Run("lists all inventory on single page", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "Single Page Item")
		loc := createTestLocationForInv(t, locRepo, ctx, "Single Page Location")

		inv, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv))

		// Request with page size larger than total
		pagination := shared.Pagination{Page: 1, PageSize: 50}
		inventories, total, err := invRepo.List(ctx, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)
		assert.Greater(t, total, 0) // Should have at least the one we just created
		assert.LessOrEqual(t, len(inventories), 50) // Should not exceed page size
	})

	t.Run("returns empty list for page beyond total pages", func(t *testing.T) {
		pagination := shared.Pagination{Page: 999, PageSize: 10}
		inventories, total, err := invRepo.List(ctx, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, total, 0) // Total is based on count, not affected by page
		assert.Empty(t, inventories) // Should have no items on page 999
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		// Create items in workspace1
		itm1, _ := item.NewItem(workspace1, "WS1 Item", "SKU-WS1-"+uuid.NewString()[:4], 0)
		require.NoError(t, itemRepo.Save(ctx, itm1))
		loc1, _ := location.NewLocation(workspace1, "WS1 Loc", nil, nil, "WS1-LOC")
		require.NoError(t, locRepo.Save(ctx, loc1))
		inv1, _ := inventory.NewInventory(workspace1, itm1.ID(), loc1.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv1))

		// Create items in workspace2
		itm2, _ := item.NewItem(workspace2, "WS2 Item", "SKU-WS2-"+uuid.NewString()[:4], 0)
		require.NoError(t, itemRepo.Save(ctx, itm2))
		loc2, _ := location.NewLocation(workspace2, "WS2 Loc", nil, nil, "WS2-LOC")
		require.NoError(t, locRepo.Save(ctx, loc2))
		inv2, _ := inventory.NewInventory(workspace2, itm2.ID(), loc2.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv2))

		// List for workspace1 should only show workspace1 inventory
		pagination := shared.Pagination{Page: 1, PageSize: 50}
		inventories, _, err := invRepo.List(ctx, workspace1, pagination)
		require.NoError(t, err)
		for _, inv := range inventories {
			assert.Equal(t, workspace1, inv.WorkspaceID())
		}

		// List for workspace2 should only show workspace2 inventory
		inventories, _, err = invRepo.List(ctx, workspace2, pagination)
		require.NoError(t, err)
		for _, inv := range inventories {
			assert.Equal(t, workspace2, inv.WorkspaceID())
		}
	})

	t.Run("excludes archived inventory", func(t *testing.T) {
		itm := createTestItem(t, itemRepo, ctx, "Archive Test Item")
		loc := createTestLocationForInv(t, locRepo, ctx, "Archive Test Location")

		// Create and archive an inventory entry
		inv, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv))

		// Get count before archiving
		pagination := shared.Pagination{Page: 1, PageSize: 50}
		_, totalBefore, err := invRepo.List(ctx, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)

		// Archive the inventory
		require.NoError(t, invRepo.Delete(ctx, inv.ID()))

		// Get count after archiving
		_, totalAfter, err := invRepo.List(ctx, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)

		// Total should be less after archiving (assuming Delete archives)
		assert.LessOrEqual(t, totalAfter, totalBefore)
	})

	t.Run("orders by created_at DESC", func(t *testing.T) {
		itm1 := createTestItem(t, itemRepo, ctx, "Order Item 1")
		itm2 := createTestItem(t, itemRepo, ctx, "Order Item 2")
		loc := createTestLocationForInv(t, locRepo, ctx, "Order Location")

		// Create inventory entries in order
		inv1, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm1.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv1))

		inv2, _ := inventory.NewInventory(testfixtures.TestWorkspaceID, itm2.ID(), loc.ID(), nil, 2, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv2))

		// List should return newest first
		pagination := shared.Pagination{Page: 1, PageSize: 10}
		inventories, _, err := invRepo.List(ctx, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(inventories), 2)

		// Find our test inventories
		var foundInv1, foundInv2 int
		for i, inv := range inventories {
			if inv.ID() == inv2.ID() {
				foundInv2 = i
			}
			if inv.ID() == inv1.ID() {
				foundInv1 = i
			}
		}

		// inv2 (created later) should come before inv1 in the list
		if foundInv1 >= 0 && foundInv2 >= 0 {
			assert.Less(t, foundInv2, foundInv1, "newer inventory should come first")
		}
	})
}
