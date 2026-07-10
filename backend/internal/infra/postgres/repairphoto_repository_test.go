//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairlog"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairphoto"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
	"github.com/jackc/pgx/v5/pgxpool"
)

// createTestRepairLogForPhoto creates an inventory-backed repair log in
// workspaceID for repair photo/attachment repo tests, which FK to
// warehouse.repair_logs rather than directly to inventory.
func createTestRepairLogForPhoto(t *testing.T, pool *pgxpool.Pool, workspaceID uuid.UUID) uuid.UUID {
	t.Helper()

	inventoryID := createTestInventoryForRepairLog(t, pool, workspaceID)
	r, err := repairlog.NewRepairLog(workspaceID, inventoryID, "Repair for photo test", nil, nil, nil, nil, nil, false, nil)
	require.NoError(t, err)
	require.NoError(t, NewRepairLogRepository(pool).Save(context.Background(), r))

	return r.ID()
}

func newTestRepairPhoto(t *testing.T, repairLogID, workspaceID uuid.UUID) *repairphoto.RepairPhoto {
	t.Helper()

	p, err := repairphoto.NewRepairPhoto(
		repairLogID, workspaceID, testfixtures.TestUserID,
		repairphoto.PhotoTypeBefore,
		"before.jpg", "storage/before.jpg", "storage/before-thumb.jpg", repairphoto.MimeTypeJPEG,
		1024, 640, 480, 0, nil,
	)
	require.NoError(t, err)
	return p
}

func TestRepairPhotoRepository_CreateAndGetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairPhotoRepository(pool)
	ctx := context.Background()

	t.Run("creates a repair photo and gets it by id", func(t *testing.T) {
		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		p := newTestRepairPhoto(t, repairLogID, testfixtures.TestWorkspaceID)

		created, err := repo.Create(ctx, p)
		require.NoError(t, err)
		require.NotNil(t, created)

		found, err := repo.GetByID(ctx, created.ID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, created.ID, found.ID)
		assert.Equal(t, repairphoto.PhotoTypeBefore, found.PhotoType)
		assert.Equal(t, "before.jpg", found.Filename)
	})

	t.Run("returns ErrNotFound for a missing repair photo", func(t *testing.T) {
		found, err := repo.GetByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak a repair photo across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		p := newTestRepairPhoto(t, repairLogID, testfixtures.TestWorkspaceID)
		created, err := repo.Create(ctx, p)
		require.NoError(t, err)

		found, err := repo.GetByID(ctx, created.ID, otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestRepairPhotoRepository_ListByRepairLog(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairPhotoRepository(pool)
	ctx := context.Background()

	t.Run("lists photos scoped to the repair log and workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		otherRepairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		otherWorkspaceRepairLogID := createTestRepairLogForPhoto(t, pool, otherWorkspace)

		p1 := newTestRepairPhoto(t, repairLogID, testfixtures.TestWorkspaceID)
		_, err := repo.Create(ctx, p1)
		require.NoError(t, err)

		p2 := newTestRepairPhoto(t, otherRepairLogID, testfixtures.TestWorkspaceID)
		_, err = repo.Create(ctx, p2)
		require.NoError(t, err)

		p3 := newTestRepairPhoto(t, otherWorkspaceRepairLogID, otherWorkspace)
		_, err = repo.Create(ctx, p3)
		require.NoError(t, err)

		found, err := repo.ListByRepairLog(ctx, repairLogID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.Len(t, found, 1)
		assert.Equal(t, p1.ID, found[0].ID)
	})
}

func TestRepairPhotoRepository_UpdateCaptionAndDisplayOrder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairPhotoRepository(pool)
	ctx := context.Background()

	t.Run("updates caption and display order, scoped by workspace", func(t *testing.T) {
		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		p := newTestRepairPhoto(t, repairLogID, testfixtures.TestWorkspaceID)
		created, err := repo.Create(ctx, p)
		require.NoError(t, err)

		caption := "Cracked screen"
		updated, err := repo.UpdateCaption(ctx, created.ID, testfixtures.TestWorkspaceID, &caption)
		require.NoError(t, err)
		require.NotNil(t, updated.Caption)
		assert.Equal(t, caption, *updated.Caption)

		require.NoError(t, repo.UpdateDisplayOrder(ctx, created.ID, testfixtures.TestWorkspaceID, 3))

		found, err := repo.GetByID(ctx, created.ID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, int32(3), found.DisplayOrder)
	})

	t.Run("returns ErrNotFound when updating caption for another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		p := newTestRepairPhoto(t, repairLogID, testfixtures.TestWorkspaceID)
		created, err := repo.Create(ctx, p)
		require.NoError(t, err)

		caption := "Hijacked"
		updated, err := repo.UpdateCaption(ctx, created.ID, otherWorkspace, &caption)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, updated)
	})
}

func TestRepairPhotoRepository_GetMaxDisplayOrder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairPhotoRepository(pool)
	ctx := context.Background()

	t.Run("returns the highest display order for the repair log", func(t *testing.T) {
		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)

		p1 := newTestRepairPhoto(t, repairLogID, testfixtures.TestWorkspaceID)
		_, err := repo.Create(ctx, p1)
		require.NoError(t, err)

		p2, err := repairphoto.NewRepairPhoto(
			repairLogID, testfixtures.TestWorkspaceID, testfixtures.TestUserID,
			repairphoto.PhotoTypeAfter,
			"after.jpg", "storage/after.jpg", "storage/after-thumb.jpg", repairphoto.MimeTypeJPEG,
			2048, 640, 480, 5, nil,
		)
		require.NoError(t, err)
		_, err = repo.Create(ctx, p2)
		require.NoError(t, err)

		maxOrder, err := repo.GetMaxDisplayOrder(ctx, repairLogID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, int32(5), maxOrder)
	})
}

func TestRepairPhotoRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairPhotoRepository(pool)
	ctx := context.Background()

	t.Run("deletes a repair photo", func(t *testing.T) {
		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		p := newTestRepairPhoto(t, repairLogID, testfixtures.TestWorkspaceID)
		created, err := repo.Create(ctx, p)
		require.NoError(t, err)

		require.NoError(t, repo.Delete(ctx, created.ID, testfixtures.TestWorkspaceID))

		found, err := repo.GetByID(ctx, created.ID, testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not delete a repair photo belonging to another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		p := newTestRepairPhoto(t, repairLogID, testfixtures.TestWorkspaceID)
		created, err := repo.Create(ctx, p)
		require.NoError(t, err)

		require.NoError(t, repo.Delete(ctx, created.ID, otherWorkspace))

		found, err := repo.GetByID(ctx, created.ID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}
