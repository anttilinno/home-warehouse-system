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
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/maintenance"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
	"github.com/jackc/pgx/v5/pgxpool"
)

// createTestInventoryForMaintenance creates an inventory row (with backing
// item + location) in workspaceID for maintenance repo tests, which FK to
// warehouse.inventory rather than warehouse.items.
func createTestInventoryForMaintenance(t *testing.T, pool *pgxpool.Pool, workspaceID uuid.UUID) uuid.UUID {
	t.Helper()

	itm, err := item.NewItem(workspaceID, "Maintenance Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
	require.NoError(t, err)
	itm.SetShortCode(uuid.NewString()[:8])
	require.NoError(t, NewItemRepository(pool).Save(context.Background(), itm))

	loc, err := location.NewLocation(workspaceID, "Maintenance Loc "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
	require.NoError(t, err)
	require.NoError(t, NewLocationRepository(pool).Save(context.Background(), loc))

	inv, err := inventory.NewInventory(workspaceID, itm.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
	require.NoError(t, err)
	require.NoError(t, NewInventoryRepository(pool).Save(context.Background(), inv))

	return inv.ID()
}

func TestMaintenanceRepository_SaveAndFindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMaintenanceRepository(pool)
	ctx := context.Background()

	t.Run("creates a schedule and finds it by id", func(t *testing.T) {
		inventoryID := createTestInventoryForMaintenance(t, pool, testfixtures.TestWorkspaceID)
		notes := "replace filter"
		nextDue := time.Now().AddDate(0, 0, 90).Truncate(24 * time.Hour)

		s, err := maintenance.NewSchedule(testfixtures.TestWorkspaceID, inventoryID, "Replace HVAC filter", &notes, 90, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, s))

		found, err := repo.FindByID(ctx, s.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, s.ID(), found.ID())
		assert.Equal(t, "Replace HVAC filter", found.Title())
		require.NotNil(t, found.Notes())
		assert.Equal(t, notes, *found.Notes())
		assert.Equal(t, 90, found.IntervalDays())
		assert.True(t, found.IsActive())
	})

	t.Run("updates an existing schedule", func(t *testing.T) {
		inventoryID := createTestInventoryForMaintenance(t, pool, testfixtures.TestWorkspaceID)
		nextDue := time.Now().AddDate(0, 0, 30).Truncate(24 * time.Hour)

		s, err := maintenance.NewSchedule(testfixtures.TestWorkspaceID, inventoryID, "Rotate tires", nil, 30, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, s))

		newNextDue := time.Now().AddDate(0, 0, 60).Truncate(24 * time.Hour)
		require.NoError(t, s.UpdateDetails("Rotate tires (updated)", nil, 60, newNextDue, false))
		require.NoError(t, repo.Save(ctx, s))

		found, err := repo.FindByID(ctx, s.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, "Rotate tires (updated)", found.Title())
		assert.Equal(t, 60, found.IntervalDays())
		assert.False(t, found.IsActive())
	})

	t.Run("returns ErrNotFound for a missing schedule", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak a schedule across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		inventoryID := createTestInventoryForMaintenance(t, pool, testfixtures.TestWorkspaceID)
		nextDue := time.Now().AddDate(0, 0, 10).Truncate(24 * time.Hour)
		s, err := maintenance.NewSchedule(testfixtures.TestWorkspaceID, inventoryID, "Descale kettle", nil, 10, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, s))

		found, err := repo.FindByID(ctx, s.ID(), otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)

		found, err = repo.FindByID(ctx, s.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestMaintenanceRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMaintenanceRepository(pool)
	ctx := context.Background()

	t.Run("lists schedules scoped to the workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		inventoryID := createTestInventoryForMaintenance(t, pool, testfixtures.TestWorkspaceID)
		otherInventoryID := createTestInventoryForMaintenance(t, pool, otherWorkspace)

		nextDue := time.Now().AddDate(0, 0, 45).Truncate(24 * time.Hour)
		s1, err := maintenance.NewSchedule(testfixtures.TestWorkspaceID, inventoryID, "Sharpen blades", nil, 45, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, s1))

		other, err := maintenance.NewSchedule(otherWorkspace, otherInventoryID, "Other workspace schedule", nil, 45, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, other))

		found, total, err := repo.FindByWorkspace(ctx, testfixtures.TestWorkspaceID, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 1, total)
		require.Len(t, found, 1)
		assert.Equal(t, s1.ID(), found[0].ID())
	})
}

func TestMaintenanceRepository_FindByInventory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMaintenanceRepository(pool)
	ctx := context.Background()

	t.Run("lists schedules for an inventory entry", func(t *testing.T) {
		inventoryID := createTestInventoryForMaintenance(t, pool, testfixtures.TestWorkspaceID)
		otherInventoryID := createTestInventoryForMaintenance(t, pool, testfixtures.TestWorkspaceID)
		nextDue := time.Now().AddDate(0, 0, 20).Truncate(24 * time.Hour)

		s, err := maintenance.NewSchedule(testfixtures.TestWorkspaceID, inventoryID, "Clean filter", nil, 20, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, s))

		other, err := maintenance.NewSchedule(testfixtures.TestWorkspaceID, otherInventoryID, "Other item schedule", nil, 20, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, other))

		found, err := repo.FindByInventory(ctx, testfixtures.TestWorkspaceID, inventoryID)
		require.NoError(t, err)
		require.Len(t, found, 1)
		assert.Equal(t, s.ID(), found[0].ID())
	})
}

func TestMaintenanceRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMaintenanceRepository(pool)
	ctx := context.Background()

	t.Run("deletes a schedule", func(t *testing.T) {
		inventoryID := createTestInventoryForMaintenance(t, pool, testfixtures.TestWorkspaceID)
		nextDue := time.Now().AddDate(0, 0, 15).Truncate(24 * time.Hour)
		s, err := maintenance.NewSchedule(testfixtures.TestWorkspaceID, inventoryID, "Delete me", nil, 15, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, s))

		require.NoError(t, repo.Delete(ctx, s.ID(), testfixtures.TestWorkspaceID))

		found, err := repo.FindByID(ctx, s.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not delete a schedule belonging to another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		inventoryID := createTestInventoryForMaintenance(t, pool, testfixtures.TestWorkspaceID)
		nextDue := time.Now().AddDate(0, 0, 15).Truncate(24 * time.Hour)
		s, err := maintenance.NewSchedule(testfixtures.TestWorkspaceID, inventoryID, "Keep me", nil, 15, nextDue)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, s))

		require.NoError(t, repo.Delete(ctx, s.ID(), otherWorkspace))

		found, err := repo.FindByID(ctx, s.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}
