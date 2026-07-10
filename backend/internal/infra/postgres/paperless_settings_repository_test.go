//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/paperless"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestPaperlessSettingsRepository_UpsertAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewPaperlessSettingsRepository(pool)
	ctx := context.Background()

	t.Run("upserts settings and gets them by workspace", func(t *testing.T) {
		created, err := repo.Upsert(ctx, paperless.UpsertParams{
			WorkspaceID:       testfixtures.TestWorkspaceID,
			BaseURL:           "https://paperless.example.com",
			APITokenEncrypted: "enc-token-1",
			SyncTagsEnabled:   true,
			IsEnabled:         true,
		})
		require.NoError(t, err)
		require.NotNil(t, created)
		assert.Equal(t, testfixtures.TestWorkspaceID, created.WorkspaceID)
		assert.Equal(t, "https://paperless.example.com", created.BaseURL)
		assert.True(t, created.SyncTagsEnabled)
		assert.True(t, created.IsEnabled)

		found, err := repo.Get(ctx, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, created.ID, found.ID)
		assert.Equal(t, "enc-token-1", found.APITokenEncrypted)
	})

	t.Run("upsert overwrites the existing row for the same workspace", func(t *testing.T) {
		_, err := repo.Upsert(ctx, paperless.UpsertParams{
			WorkspaceID:       testfixtures.TestWorkspaceID,
			BaseURL:           "https://old.example.com",
			APITokenEncrypted: "enc-token-old",
			SyncTagsEnabled:   false,
			IsEnabled:         false,
		})
		require.NoError(t, err)

		updated, err := repo.Upsert(ctx, paperless.UpsertParams{
			WorkspaceID:       testfixtures.TestWorkspaceID,
			BaseURL:           "https://new.example.com",
			APITokenEncrypted: "enc-token-new",
			SyncTagsEnabled:   true,
			IsEnabled:         true,
		})
		require.NoError(t, err)

		found, err := repo.Get(ctx, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, updated.ID, found.ID)
		assert.Equal(t, "https://new.example.com", found.BaseURL)
		assert.Equal(t, "enc-token-new", found.APITokenEncrypted)
		assert.True(t, found.SyncTagsEnabled)
	})

	t.Run("returns ErrNotFound for a workspace without settings", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		found, err := repo.Get(ctx, otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak settings across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		_, err := repo.Upsert(ctx, paperless.UpsertParams{
			WorkspaceID:       testfixtures.TestWorkspaceID,
			BaseURL:           "https://scoped.example.com",
			APITokenEncrypted: "enc-token-scoped",
			SyncTagsEnabled:   false,
			IsEnabled:         true,
		})
		require.NoError(t, err)

		found, err := repo.Get(ctx, otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestPaperlessSettingsRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewPaperlessSettingsRepository(pool)
	ctx := context.Background()

	t.Run("deletes settings for a workspace", func(t *testing.T) {
		_, err := repo.Upsert(ctx, paperless.UpsertParams{
			WorkspaceID:       testfixtures.TestWorkspaceID,
			BaseURL:           "https://delete-me.example.com",
			APITokenEncrypted: "enc-token-del",
			SyncTagsEnabled:   false,
			IsEnabled:         true,
		})
		require.NoError(t, err)

		require.NoError(t, repo.Delete(ctx, testfixtures.TestWorkspaceID))

		found, err := repo.Get(ctx, testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not delete settings belonging to another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		_, err := repo.Upsert(ctx, paperless.UpsertParams{
			WorkspaceID:       testfixtures.TestWorkspaceID,
			BaseURL:           "https://keep-me.example.com",
			APITokenEncrypted: "enc-token-keep",
			SyncTagsEnabled:   false,
			IsEnabled:         true,
		})
		require.NoError(t, err)

		require.NoError(t, repo.Delete(ctx, otherWorkspace))

		found, err := repo.Get(ctx, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}
