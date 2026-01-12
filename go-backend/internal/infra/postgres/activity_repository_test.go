package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestActivityRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewActivityRepository(pool)
	ctx := context.Background()

	t.Run("saves activity log successfully", func(t *testing.T) {
		userID := testfixtures.TestUserID
		entityID := uuid.New()
		changes := map[string]interface{}{"name": "old_value"}
		metadata := map[string]interface{}{"ip": "127.0.0.1"}

		a, err := activity.NewActivityLog(
			testfixtures.TestWorkspaceID,
			&userID,
			activity.ActionCreate,
			activity.EntityItem,
			entityID,
			"Test Item",
			changes,
			metadata,
		)
		require.NoError(t, err)

		err = repo.Save(ctx, a)
		require.NoError(t, err)
	})

	t.Run("saves activity log without user", func(t *testing.T) {
		entityID := uuid.New()

		a, err := activity.NewActivityLog(
			testfixtures.TestWorkspaceID,
			nil,
			activity.ActionUpdate,
			activity.EntityLocation,
			entityID,
			"Test Location",
			nil,
			nil,
		)
		require.NoError(t, err)

		err = repo.Save(ctx, a)
		require.NoError(t, err)
	})
}

func TestActivityRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewActivityRepository(pool)
	ctx := context.Background()

	t.Run("lists activity logs with pagination", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		for i := 0; i < 5; i++ {
			entityID := uuid.New()
			a, _ := activity.NewActivityLog(workspace, nil, activity.ActionCreate, activity.EntityItem, entityID, "Item "+uuid.NewString()[:4], nil, nil)
			require.NoError(t, repo.Save(ctx, a))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 3}
		logs, err := repo.FindByWorkspace(ctx, workspace, pagination)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(logs), 3)
	})
}

func TestActivityRepository_FindByEntity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewActivityRepository(pool)
	ctx := context.Background()

	t.Run("finds activity logs by entity", func(t *testing.T) {
		entityID := uuid.New()

		// Create multiple activity logs for the same entity
		for _, action := range []activity.Action{activity.ActionCreate, activity.ActionUpdate} {
			a, _ := activity.NewActivityLog(testfixtures.TestWorkspaceID, nil, action, activity.EntityItem, entityID, "Entity Item", nil, nil)
			require.NoError(t, repo.Save(ctx, a))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		logs, err := repo.FindByEntity(ctx, testfixtures.TestWorkspaceID, activity.EntityItem, entityID, pagination)
		require.NoError(t, err)
		assert.Len(t, logs, 2)
	})
}

func TestActivityRepository_FindByUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewActivityRepository(pool)
	ctx := context.Background()

	t.Run("finds activity logs by user", func(t *testing.T) {
		userID := testfixtures.TestUserID

		for i := 0; i < 3; i++ {
			entityID := uuid.New()
			a, _ := activity.NewActivityLog(testfixtures.TestWorkspaceID, &userID, activity.ActionCreate, activity.EntityContainer, entityID, "Container "+uuid.NewString()[:4], nil, nil)
			require.NoError(t, repo.Save(ctx, a))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		logs, err := repo.FindByUser(ctx, testfixtures.TestWorkspaceID, userID, pagination)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(logs), 3)
	})
}

func TestActivityRepository_FindRecentActivity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewActivityRepository(pool)
	ctx := context.Background()

	t.Run("finds recent activity", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		// Create some activity logs
		for i := 0; i < 3; i++ {
			entityID := uuid.New()
			a, _ := activity.NewActivityLog(workspace, nil, activity.ActionCreate, activity.EntityLabel, entityID, "Label "+uuid.NewString()[:4], nil, nil)
			require.NoError(t, repo.Save(ctx, a))
		}

		// Find activity since an hour ago
		since := time.Now().Add(-1 * time.Hour)
		logs, err := repo.FindRecentActivity(ctx, workspace, since)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(logs), 3)
	})
}
