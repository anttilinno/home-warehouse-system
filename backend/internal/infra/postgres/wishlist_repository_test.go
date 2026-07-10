//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/wishlist"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestWishlistRepository_SaveAndFindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewWishlistRepository(pool)
	ctx := context.Background()

	t.Run("creates a wishlist item and finds it by id", func(t *testing.T) {
		notes := "spare cables"
		price := 1999
		currency := "USD"

		item, err := wishlist.NewItem(testfixtures.TestWorkspaceID, "HDMI cable", &notes, nil, &price, &currency, wishlist.PriorityDefault, nil, &testfixtures.TestUserID)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, item))

		found, err := repo.FindByID(ctx, item.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, item.ID(), found.ID())
		assert.Equal(t, "HDMI cable", found.Name())
		require.NotNil(t, found.PriceEstimate())
		assert.Equal(t, price, *found.PriceEstimate())
		assert.Equal(t, wishlist.StatusWanted, found.Status())
	})

	t.Run("updates an existing wishlist item", func(t *testing.T) {
		item, err := wishlist.NewItem(testfixtures.TestWorkspaceID, "Drill", nil, nil, nil, nil, wishlist.PriorityDefault, nil, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, item))

		require.NoError(t, item.UpdateDetails("Cordless drill", nil, nil, nil, nil, wishlist.PriorityHighest, nil))
		require.NoError(t, item.TransitionStatus(wishlist.StatusOrdered))
		require.NoError(t, repo.Save(ctx, item))

		found, err := repo.FindByID(ctx, item.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, "Cordless drill", found.Name())
		assert.Equal(t, wishlist.PriorityHighest, found.Priority())
		assert.Equal(t, wishlist.StatusOrdered, found.Status())
	})

	t.Run("returns ErrNotFound for a missing wishlist item", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak a wishlist item across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		item, err := wishlist.NewItem(testfixtures.TestWorkspaceID, "Scoped item", nil, nil, nil, nil, wishlist.PriorityDefault, nil, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, item))

		found, err := repo.FindByID(ctx, item.ID(), otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)

		found, err = repo.FindByID(ctx, item.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestWishlistRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewWishlistRepository(pool)
	ctx := context.Background()

	t.Run("lists items scoped to the workspace, optionally filtered by status", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		wanted, err := wishlist.NewItem(testfixtures.TestWorkspaceID, "Wanted item", nil, nil, nil, nil, wishlist.PriorityDefault, nil, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, wanted))

		ordered, err := wishlist.NewItem(testfixtures.TestWorkspaceID, "Ordered item", nil, nil, nil, nil, wishlist.PriorityDefault, nil, nil)
		require.NoError(t, err)
		require.NoError(t, ordered.TransitionStatus(wishlist.StatusOrdered))
		require.NoError(t, repo.Save(ctx, ordered))

		other, err := wishlist.NewItem(otherWorkspace, "Other workspace item", nil, nil, nil, nil, wishlist.PriorityDefault, nil, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, other))

		found, total, err := repo.FindByWorkspace(ctx, testfixtures.TestWorkspaceID, nil, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 2, total)
		assert.Len(t, found, 2)

		orderedStatus := wishlist.StatusOrdered
		found, total, err = repo.FindByWorkspace(ctx, testfixtures.TestWorkspaceID, &orderedStatus, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 1, total)
		require.Len(t, found, 1)
		assert.Equal(t, ordered.ID(), found[0].ID())
	})
}

func TestWishlistRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewWishlistRepository(pool)
	ctx := context.Background()

	t.Run("deletes a wishlist item", func(t *testing.T) {
		item, err := wishlist.NewItem(testfixtures.TestWorkspaceID, "Delete me", nil, nil, nil, nil, wishlist.PriorityDefault, nil, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, item))

		require.NoError(t, repo.Delete(ctx, item.ID(), testfixtures.TestWorkspaceID))

		found, err := repo.FindByID(ctx, item.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not delete a wishlist item belonging to another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		item, err := wishlist.NewItem(testfixtures.TestWorkspaceID, "Keep me", nil, nil, nil, nil, wishlist.PriorityDefault, nil, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, item))

		require.NoError(t, repo.Delete(ctx, item.ID(), otherWorkspace))

		found, err := repo.FindByID(ctx, item.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}
