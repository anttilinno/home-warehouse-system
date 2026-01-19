//go:build integration
// +build integration

package postgres

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/pendingchange"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestPendingChangeRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewPendingChangeRepository(pool)
	ctx := context.Background()

	t.Run("saves new pending change successfully", func(t *testing.T) {
		entityID := uuid.New()
		payload := json.RawMessage(`{"name": "Test Item", "sku": "TEST-001"}`)

		change, err := pendingchange.NewPendingChange(
			testfixtures.TestWorkspaceID,
			testfixtures.TestUserID,
			"items",
			&entityID,
			pendingchange.ActionCreate,
			payload,
		)
		require.NoError(t, err)

		err = repo.Save(ctx, change)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, change.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, change.ID(), retrieved.ID())
		assert.Equal(t, change.WorkspaceID(), retrieved.WorkspaceID())
		assert.Equal(t, change.RequesterID(), retrieved.RequesterID())
		assert.Equal(t, change.EntityType(), retrieved.EntityType())
		assert.Equal(t, change.Action(), retrieved.Action())
		assert.Equal(t, change.Status(), retrieved.Status())
	})

	t.Run("saves pending change without entity ID", func(t *testing.T) {
		payload := json.RawMessage(`{"name": "New Item"}`)

		change, err := pendingchange.NewPendingChange(
			testfixtures.TestWorkspaceID,
			testfixtures.TestUserID,
			"items",
			nil,
			pendingchange.ActionCreate,
			payload,
		)
		require.NoError(t, err)

		err = repo.Save(ctx, change)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, change.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Nil(t, retrieved.EntityID())
	})
}

func TestPendingChangeRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewPendingChangeRepository(pool)
	ctx := context.Background()

	t.Run("finds existing pending change", func(t *testing.T) {
		payload := json.RawMessage(`{"test": "data"}`)
		change, err := pendingchange.NewPendingChange(
			testfixtures.TestWorkspaceID,
			testfixtures.TestUserID,
			"items",
			nil,
			pendingchange.ActionUpdate,
			payload,
		)
		require.NoError(t, err)
		err = repo.Save(ctx, change)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, change.ID())
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, change.ID(), found.ID())
	})

	t.Run("returns error for non-existent pending change", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New())
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestPendingChangeRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewPendingChangeRepository(pool)
	ctx := context.Background()

	t.Run("lists pending changes for workspace", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)
		user := testfixtures.TestUserID

		payload := json.RawMessage(`{"test": "data"}`)
		for i := 0; i < 3; i++ {
			change, _ := pendingchange.NewPendingChange(
				workspace,
				user,
				"items",
				nil,
				pendingchange.ActionCreate,
				payload,
			)
			require.NoError(t, repo.Save(ctx, change))
		}

		changes, err := repo.FindByWorkspace(ctx, workspace, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(changes), 3)
	})

	t.Run("filters by status", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)
		user := testfixtures.TestUserID
		reviewer := testfixtures.TestUserID

		payload := json.RawMessage(`{"test": "data"}`)

		// Create pending change
		pendingChange, _ := pendingchange.NewPendingChange(
			workspace,
			user,
			"items",
			nil,
			pendingchange.ActionCreate,
			payload,
		)
		require.NoError(t, repo.Save(ctx, pendingChange))

		// Create approved change
		approvedChange, _ := pendingchange.NewPendingChange(
			workspace,
			user,
			"items",
			nil,
			pendingchange.ActionCreate,
			payload,
		)
		require.NoError(t, approvedChange.Approve(reviewer))
		require.NoError(t, repo.Save(ctx, approvedChange))

		// Filter by pending status
		status := pendingchange.StatusPending
		pendingChanges, err := repo.FindByWorkspace(ctx, workspace, &status)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(pendingChanges), 1)
		for _, c := range pendingChanges {
			assert.Equal(t, pendingchange.StatusPending, c.Status())
		}
	})

	t.Run("returns empty for workspace with no changes", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		changes, err := repo.FindByWorkspace(ctx, workspace, nil)
		require.NoError(t, err)
		assert.Empty(t, changes)
	})
}

func TestPendingChangeRepository_FindByRequester(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewPendingChangeRepository(pool)
	ctx := context.Background()

	t.Run("lists changes by requester", func(t *testing.T) {
		user := testfixtures.TestUserID
		payload := json.RawMessage(`{"test": "data"}`)

		for i := 0; i < 2; i++ {
			change, _ := pendingchange.NewPendingChange(
				testfixtures.TestWorkspaceID,
				user,
				"items",
				nil,
				pendingchange.ActionCreate,
				payload,
			)
			require.NoError(t, repo.Save(ctx, change))
		}

		changes, err := repo.FindByRequester(ctx, user, nil)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(changes), 2)
		for _, c := range changes {
			assert.Equal(t, user, c.RequesterID())
		}
	})

	t.Run("filters by status", func(t *testing.T) {
		user := testfixtures.TestUserID
		payload := json.RawMessage(`{"test": "data"}`)

		change, _ := pendingchange.NewPendingChange(
			testfixtures.TestWorkspaceID,
			user,
			"items",
			nil,
			pendingchange.ActionCreate,
			payload,
		)
		require.NoError(t, repo.Save(ctx, change))

		status := pendingchange.StatusPending
		changes, err := repo.FindByRequester(ctx, user, &status)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(changes), 1)
	})
}

func TestPendingChangeRepository_FindByEntity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewPendingChangeRepository(pool)
	ctx := context.Background()

	t.Run("lists changes for specific entity", func(t *testing.T) {
		entityID := uuid.New()
		payload := json.RawMessage(`{"test": "data"}`)

		// Create multiple changes for the same entity
		for i := 0; i < 2; i++ {
			change, _ := pendingchange.NewPendingChange(
				testfixtures.TestWorkspaceID,
				testfixtures.TestUserID,
				"items",
				&entityID,
				pendingchange.ActionUpdate,
				payload,
			)
			require.NoError(t, repo.Save(ctx, change))
		}

		changes, err := repo.FindByEntity(ctx, "items", entityID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(changes), 2)
		for _, c := range changes {
			assert.Equal(t, "items", c.EntityType())
			assert.NotNil(t, c.EntityID())
			assert.Equal(t, entityID, *c.EntityID())
		}
	})

	t.Run("returns empty for entity with no changes", func(t *testing.T) {
		changes, err := repo.FindByEntity(ctx, "items", uuid.New())
		require.NoError(t, err)
		assert.Empty(t, changes)
	})
}

func TestPendingChangeRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewPendingChangeRepository(pool)
	ctx := context.Background()

	t.Run("deletes pending change", func(t *testing.T) {
		payload := json.RawMessage(`{"test": "data"}`)
		change, err := pendingchange.NewPendingChange(
			testfixtures.TestWorkspaceID,
			testfixtures.TestUserID,
			"items",
			nil,
			pendingchange.ActionCreate,
			payload,
		)
		require.NoError(t, err)
		err = repo.Save(ctx, change)
		require.NoError(t, err)

		err = repo.Delete(ctx, change.ID())
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, change.ID())
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}
