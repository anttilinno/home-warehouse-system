package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/favorite"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestFavoriteRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewFavoriteRepository(pool)
	itemRepo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("saves favorite item successfully", func(t *testing.T) {
		itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Fav Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, err)
		err = itemRepo.Save(ctx, itm)
		require.NoError(t, err)

		f, err := favorite.NewFavorite(
			testfixtures.TestUserID,
			testfixtures.TestWorkspaceID,
			favorite.TypeItem,
			itm.ID(),
		)
		require.NoError(t, err)

		err = repo.Save(ctx, f)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, f.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, f.ID(), retrieved.ID())
		assert.Equal(t, f.UserID(), retrieved.UserID())
		assert.Equal(t, favorite.TypeItem, retrieved.FavoriteType())
		assert.Equal(t, itm.ID(), *retrieved.ItemID())
	})

	t.Run("saves favorite location successfully", func(t *testing.T) {
		locRepo := NewLocationRepository(pool)
		loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Fav Loc "+uuid.NewString()[:4], nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)
		err = locRepo.Save(ctx, loc)
		require.NoError(t, err)

		f, err := favorite.NewFavorite(
			testfixtures.TestUserID,
			testfixtures.TestWorkspaceID,
			favorite.TypeLocation,
			loc.ID(),
		)
		require.NoError(t, err)

		err = repo.Save(ctx, f)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, f.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, favorite.TypeLocation, retrieved.FavoriteType())
		assert.Equal(t, loc.ID(), *retrieved.LocationID())
	})
}

func TestFavoriteRepository_FindByUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewFavoriteRepository(pool)
	itemRepo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("finds favorites by user", func(t *testing.T) {
		// Create multiple favorite items
		for i := 0; i < 3; i++ {
			itm, _ := item.NewItem(testfixtures.TestWorkspaceID, "Multi Fav Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
			require.NoError(t, itemRepo.Save(ctx, itm))

			f, _ := favorite.NewFavorite(testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
			require.NoError(t, repo.Save(ctx, f))
		}

		favorites, err := repo.FindByUser(ctx, testfixtures.TestUserID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(favorites), 3)
	})
}

func TestFavoriteRepository_IsFavorite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewFavoriteRepository(pool)
	itemRepo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("returns true for favorited item", func(t *testing.T) {
		itm, _ := item.NewItem(testfixtures.TestWorkspaceID, "Is Fav Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, itemRepo.Save(ctx, itm))

		f, _ := favorite.NewFavorite(testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
		require.NoError(t, repo.Save(ctx, f))

		isFav, err := repo.IsFavorite(ctx, testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
		require.NoError(t, err)
		assert.True(t, isFav)
	})

	t.Run("returns false for non-favorited item", func(t *testing.T) {
		itm, _ := item.NewItem(testfixtures.TestWorkspaceID, "Not Fav Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, itemRepo.Save(ctx, itm))

		isFav, err := repo.IsFavorite(ctx, testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
		require.NoError(t, err)
		assert.False(t, isFav)
	})
}

func TestFavoriteRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewFavoriteRepository(pool)
	itemRepo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("deletes favorite", func(t *testing.T) {
		itm, _ := item.NewItem(testfixtures.TestWorkspaceID, "Del Fav Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, itemRepo.Save(ctx, itm))

		f, _ := favorite.NewFavorite(testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
		require.NoError(t, repo.Save(ctx, f))

		err := repo.Delete(ctx, f.ID(), testfixtures.TestUserID)
		require.NoError(t, err)

		isFav, err := repo.IsFavorite(ctx, testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
		require.NoError(t, err)
		assert.False(t, isFav)
	})
}

func TestFavoriteRepository_DeleteByTarget(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewFavoriteRepository(pool)
	itemRepo := NewItemRepository(pool)
	ctx := context.Background()

	t.Run("deletes favorite by target", func(t *testing.T) {
		itm, _ := item.NewItem(testfixtures.TestWorkspaceID, "Del Target Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, itemRepo.Save(ctx, itm))

		f, _ := favorite.NewFavorite(testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
		require.NoError(t, repo.Save(ctx, f))

		err := repo.DeleteByTarget(ctx, testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
		require.NoError(t, err)

		isFav, err := repo.IsFavorite(ctx, testfixtures.TestUserID, testfixtures.TestWorkspaceID, favorite.TypeItem, itm.ID())
		require.NoError(t, err)
		assert.False(t, isFav)
	})
}
