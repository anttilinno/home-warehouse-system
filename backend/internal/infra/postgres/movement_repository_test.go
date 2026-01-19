//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/movement"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

// createTestInventoryForMovement creates an inventory for movement tests
func createTestInventoryForMovement(t *testing.T, invRepo *InventoryRepository, itemRepo *ItemRepository, locRepo *LocationRepository, ctx context.Context) (*inventory.Inventory, *location.Location) {
	t.Helper()
	itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Move Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
	require.NoError(t, err)
	err = itemRepo.Save(ctx, itm)
	require.NoError(t, err)

	loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Move Loc "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
	require.NoError(t, err)
	err = locRepo.Save(ctx, loc)
	require.NoError(t, err)

	inv, err := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc.ID(), nil, 10, inventory.ConditionNew, inventory.StatusAvailable, nil)
	require.NoError(t, err)
	err = invRepo.Save(ctx, inv)
	require.NoError(t, err)

	return inv, loc
}

func TestMovementRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	movRepo := NewMovementRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("saves new movement successfully", func(t *testing.T) {
		inv, fromLoc := createTestInventoryForMovement(t, invRepo, itemRepo, locRepo, ctx)

		toLoc, err := location.NewLocation(testfixtures.TestWorkspaceID, "To Loc "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
		require.NoError(t, err)
		err = locRepo.Save(ctx, toLoc)
		require.NoError(t, err)

		fromLocID := fromLoc.ID()
		toLocID := toLoc.ID()
		reason := "Inventory relocation"

		m, err := movement.NewInventoryMovement(
			testfixtures.TestWorkspaceID,
			inv.ID(),
			&fromLocID,
			nil,
			&toLocID,
			nil,
			5,
			nil,
			&reason,
		)
		require.NoError(t, err)

		err = movRepo.Save(ctx, m)
		require.NoError(t, err)

		retrieved, err := movRepo.FindByID(ctx, m.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, m.ID(), retrieved.ID())
		assert.Equal(t, m.InventoryID(), retrieved.InventoryID())
		assert.Equal(t, m.Quantity(), retrieved.Quantity())
		assert.Equal(t, reason, *retrieved.Reason())
	})

	t.Run("saves movement with all fields", func(t *testing.T) {
		inv, fromLoc := createTestInventoryForMovement(t, invRepo, itemRepo, locRepo, ctx)

		toLoc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Full To Loc "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
		require.NoError(t, err)
		err = locRepo.Save(ctx, toLoc)
		require.NoError(t, err)

		fromLocID := fromLoc.ID()
		toLocID := toLoc.ID()
		reason := "Full movement test"
		userID := testfixtures.TestUserID

		m, err := movement.NewInventoryMovement(
			testfixtures.TestWorkspaceID,
			inv.ID(),
			&fromLocID,
			nil,
			&toLocID,
			nil,
			3,
			&userID,
			&reason,
		)
		require.NoError(t, err)

		err = movRepo.Save(ctx, m)
		require.NoError(t, err)

		retrieved, err := movRepo.FindByID(ctx, m.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, fromLocID, *retrieved.FromLocationID())
		assert.Equal(t, toLocID, *retrieved.ToLocationID())
		assert.Equal(t, userID, *retrieved.MovedBy())
	})
}

func TestMovementRepository_FindByInventory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	movRepo := NewMovementRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds movements by inventory", func(t *testing.T) {
		inv, fromLoc := createTestInventoryForMovement(t, invRepo, itemRepo, locRepo, ctx)
		fromLocID := fromLoc.ID()

		// Create multiple movements for the same inventory
		for i := 0; i < 3; i++ {
			toLoc, _ := location.NewLocation(testfixtures.TestWorkspaceID, "Mv Loc "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
			locRepo.Save(ctx, toLoc)
			toLocID := toLoc.ID()

			m, _ := movement.NewInventoryMovement(testfixtures.TestWorkspaceID, inv.ID(), &fromLocID, nil, &toLocID, nil, 1, nil, nil)
			require.NoError(t, movRepo.Save(ctx, m))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		movements, err := movRepo.FindByInventory(ctx, inv.ID(), testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)
		assert.Len(t, movements, 3)
	})
}

func TestMovementRepository_FindByLocation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	movRepo := NewMovementRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds movements by location", func(t *testing.T) {
		inv, fromLoc := createTestInventoryForMovement(t, invRepo, itemRepo, locRepo, ctx)
		fromLocID := fromLoc.ID()

		toLoc, _ := location.NewLocation(testfixtures.TestWorkspaceID, "By Loc To "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
		locRepo.Save(ctx, toLoc)
		toLocID := toLoc.ID()

		m, _ := movement.NewInventoryMovement(testfixtures.TestWorkspaceID, inv.ID(), &fromLocID, nil, &toLocID, nil, 2, nil, nil)
		require.NoError(t, movRepo.Save(ctx, m))

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		movements, err := movRepo.FindByLocation(ctx, fromLocID, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)
		assert.NotEmpty(t, movements)
	})
}

func TestMovementRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	movRepo := NewMovementRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("lists movements by workspace with pagination", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		// Create item and locations in the workspace
		itm, _ := item.NewItem(workspace, "WS Item", "SKU-WS-"+uuid.NewString()[:4], 0)
		require.NoError(t, itemRepo.Save(ctx, itm))

		fromLoc, _ := location.NewLocation(workspace, "WS From Loc", nil, nil, "WS-FROM")
		require.NoError(t, locRepo.Save(ctx, fromLoc))

		inv, _ := inventory.NewInventory(workspace, itm.ID(), fromLoc.ID(), nil, 10, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv))

		fromLocID := fromLoc.ID()
		for i := 0; i < 5; i++ {
			toLoc, _ := location.NewLocation(workspace, "WS To Loc "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
			locRepo.Save(ctx, toLoc)
			toLocID := toLoc.ID()

			m, _ := movement.NewInventoryMovement(workspace, inv.ID(), &fromLocID, nil, &toLocID, nil, 1, nil, nil)
			require.NoError(t, movRepo.Save(ctx, m))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 3}
		movements, err := movRepo.FindByWorkspace(ctx, workspace, pagination)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(movements), 3)
	})
}
