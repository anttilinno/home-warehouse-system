package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/deleted"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestDeletedRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewDeletedRepository(pool)
	ctx := context.Background()

	t.Run("saves deleted record successfully", func(t *testing.T) {
		entityID := uuid.New()
		userID := testfixtures.TestUserID

		d, err := deleted.NewDeletedRecord(
			testfixtures.TestWorkspaceID,
			activity.EntityItem,
			entityID,
			&userID,
		)
		require.NoError(t, err)

		err = repo.Save(ctx, d)
		require.NoError(t, err)
	})

	t.Run("saves deleted record without user", func(t *testing.T) {
		entityID := uuid.New()

		d, err := deleted.NewDeletedRecord(
			testfixtures.TestWorkspaceID,
			activity.EntityLocation,
			entityID,
			nil,
		)
		require.NoError(t, err)

		err = repo.Save(ctx, d)
		require.NoError(t, err)
	})
}

func TestDeletedRepository_FindSince(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewDeletedRepository(pool)
	ctx := context.Background()

	t.Run("finds deleted records since a given time", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		// Create deleted records
		for i := 0; i < 3; i++ {
			entityID := uuid.New()
			d, _ := deleted.NewDeletedRecord(workspace, activity.EntityItem, entityID, nil)
			require.NoError(t, repo.Save(ctx, d))
		}

		// Find records since an hour ago
		since := time.Now().Add(-1 * time.Hour)
		records, err := repo.FindSince(ctx, workspace, since)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(records), 3)
	})

	t.Run("returns empty for future timestamp", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		entityID := uuid.New()
		d, _ := deleted.NewDeletedRecord(workspace, activity.EntityItem, entityID, nil)
		require.NoError(t, repo.Save(ctx, d))

		// Find records since future time
		since := time.Now().Add(1 * time.Hour)
		records, err := repo.FindSince(ctx, workspace, since)
		require.NoError(t, err)
		assert.Empty(t, records)
	})
}

func TestDeletedRepository_CleanupOld(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewDeletedRepository(pool)
	ctx := context.Background()

	t.Run("cleans up old records", func(t *testing.T) {
		// This test just verifies the cleanup doesn't error
		// Actual old record cleanup would require time manipulation
		before := time.Now().Add(-30 * 24 * time.Hour) // 30 days ago
		err := repo.CleanupOld(ctx, before)
		require.NoError(t, err)
	})
}
