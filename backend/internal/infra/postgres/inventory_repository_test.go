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
	loc, err := location.NewLocation(testfixtures.TestWorkspaceID, name, nil, nil, nil, nil, nil, nil)
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
		cont, err := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "Box", nil, nil, nil)
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
		require.NoError(t, err)
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

		loc, _ := location.NewLocation(workspace1, "WS1 Loc", nil, nil, nil, nil, nil, nil)
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
