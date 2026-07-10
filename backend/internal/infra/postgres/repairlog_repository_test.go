//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairlog"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
	"github.com/jackc/pgx/v5/pgxpool"
)

// createTestInventoryForRepairLog creates an inventory row (with backing item
// + location) in workspaceID for repair log repo tests, which FK to
// warehouse.inventory rather than warehouse.items.
func createTestInventoryForRepairLog(t *testing.T, pool *pgxpool.Pool, workspaceID uuid.UUID) uuid.UUID {
	t.Helper()

	itm, err := item.NewItem(workspaceID, "Repair Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
	require.NoError(t, err)
	itm.SetShortCode(uuid.NewString()[:8])
	require.NoError(t, NewItemRepository(pool).Save(context.Background(), itm))

	loc, err := location.NewLocation(workspaceID, "Repair Loc "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
	require.NoError(t, err)
	require.NoError(t, NewLocationRepository(pool).Save(context.Background(), loc))

	inv, err := inventory.NewInventory(workspaceID, itm.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
	require.NoError(t, err)
	require.NoError(t, NewInventoryRepository(pool).Save(context.Background(), inv))

	return inv.ID()
}

func TestRepairLogRepository_SaveAndFindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairLogRepository(pool)
	ctx := context.Background()

	t.Run("creates a repair log and finds it by id", func(t *testing.T) {
		inventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)
		cost := 4500
		currency := "USD"
		provider := "Acme Repairs"

		r, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "Fix screen", nil, &cost, &currency, &provider, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, r))

		found, err := repo.FindByID(ctx, r.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, r.ID(), found.ID())
		assert.Equal(t, "Fix screen", found.Description())
		assert.Equal(t, repairlog.StatusPending, found.Status())
		require.NotNil(t, found.Cost())
		assert.Equal(t, cost, *found.Cost())
	})

	t.Run("progresses status through Save", func(t *testing.T) {
		inventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)
		r, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "Replace battery", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, r))

		require.NoError(t, r.StartRepair())
		require.NoError(t, repo.Save(ctx, r))

		found, err := repo.FindByID(ctx, r.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, repairlog.StatusInProgress, found.Status())

		require.NoError(t, r.Complete(nil))
		require.NoError(t, repo.Save(ctx, r))

		found, err = repo.FindByID(ctx, r.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, repairlog.StatusCompleted, found.Status())
		assert.NotNil(t, found.CompletedAt())
	})

	t.Run("returns ErrNotFound for a missing repair log", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak a repair log across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		inventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)
		r, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "Scoped repair", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, r))

		found, err := repo.FindByID(ctx, r.ID(), otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)

		found, err = repo.FindByID(ctx, r.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestRepairLogRepository_FindByWorkspaceAndInventory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairLogRepository(pool)
	ctx := context.Background()

	t.Run("lists repair logs scoped to the workspace and inventory item", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		inventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)
		otherInventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)
		otherWorkspaceInventoryID := createTestInventoryForRepairLog(t, pool, otherWorkspace)

		r1, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "Repair 1", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, r1))

		r2, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, otherInventoryID, "Repair 2", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, r2))

		other, err := repairlog.NewRepairLog(otherWorkspace, otherWorkspaceInventoryID, "Other workspace repair", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, other))

		byInventory, err := repo.FindByInventory(ctx, testfixtures.TestWorkspaceID, inventoryID)
		require.NoError(t, err)
		require.Len(t, byInventory, 1)
		assert.Equal(t, r1.ID(), byInventory[0].ID())

		byWorkspace, total, err := repo.FindByWorkspace(ctx, testfixtures.TestWorkspaceID, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 2, total)
		assert.Len(t, byWorkspace, 2)
	})
}

func TestRepairLogRepository_FindByStatus(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairLogRepository(pool)
	ctx := context.Background()

	t.Run("filters repair logs by status within the workspace", func(t *testing.T) {
		inventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)

		pending, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "Pending repair", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, pending))

		inProgress, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "In progress repair", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, inProgress.StartRepair())
		require.NoError(t, repo.Save(ctx, inProgress))

		found, err := repo.FindByStatus(ctx, testfixtures.TestWorkspaceID, repairlog.StatusInProgress, shared.DefaultPagination())
		require.NoError(t, err)
		require.Len(t, found, 1)
		assert.Equal(t, inProgress.ID(), found[0].ID())
	})
}

func TestRepairLogRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairLogRepository(pool)
	ctx := context.Background()

	t.Run("deletes a repair log", func(t *testing.T) {
		inventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)
		r, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "Delete me", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, r))

		require.NoError(t, repo.Delete(ctx, r.ID(), testfixtures.TestWorkspaceID))

		found, err := repo.FindByID(ctx, r.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not delete a repair log belonging to another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		inventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)
		r, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "Keep me", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, r))

		require.NoError(t, repo.Delete(ctx, r.ID(), otherWorkspace))

		found, err := repo.FindByID(ctx, r.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestRepairLogRepository_WarrantyAndReminder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairLogRepository(pool)
	ctx := context.Background()

	t.Run("updates warranty claim and reminder fields, scoped by workspace", func(t *testing.T) {
		inventoryID := createTestInventoryForRepairLog(t, pool, testfixtures.TestWorkspaceID)
		r, err := repairlog.NewRepairLog(testfixtures.TestWorkspaceID, inventoryID, "Warranty repair", nil, nil, nil, nil, nil, false, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, r))

		require.NoError(t, repo.UpdateWarrantyClaim(ctx, r.ID(), testfixtures.TestWorkspaceID, true))

		reminderDate := time.Now().AddDate(0, 0, 7).Truncate(24 * time.Hour)
		require.NoError(t, repo.UpdateReminderDate(ctx, r.ID(), testfixtures.TestWorkspaceID, &reminderDate))
		require.NoError(t, repo.MarkReminderSent(ctx, r.ID(), testfixtures.TestWorkspaceID))

		found, err := repo.FindByID(ctx, r.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.True(t, found.IsWarrantyClaim())
		require.NotNil(t, found.ReminderDate())
		assert.True(t, found.ReminderSent())
	})
}
