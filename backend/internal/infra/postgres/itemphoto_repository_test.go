package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func createTestItemPhoto(workspaceID, itemID, userID uuid.UUID) *itemphoto.ItemPhoto {
	return &itemphoto.ItemPhoto{
		ID:            uuid.New(),
		ItemID:        itemID,
		WorkspaceID:   workspaceID,
		Filename:      "test-photo.jpg",
		StoragePath:   "/storage/path/test-photo.jpg",
		ThumbnailPath: "/storage/path/thumbnails/test-photo.jpg",
		FileSize:      1024000,
		MimeType:      itemphoto.MimeTypeJPEG,
		Width:         1920,
		Height:        1080,
		DisplayOrder:  0,
		IsPrimary:     false,
		Caption:       nil,
		UploadedBy:    userID,
	}
}

func TestItemPhotoRepository_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("creates new item photo successfully", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)

		created, err := repo.Create(ctx, photo)
		require.NoError(t, err)
		require.NotNil(t, created)

		assert.Equal(t, photo.ID, created.ID)
		assert.Equal(t, photo.ItemID, created.ItemID)
		assert.Equal(t, photo.Filename, created.Filename)
		assert.Equal(t, photo.FileSize, created.FileSize)
		assert.Equal(t, photo.Width, created.Width)
		assert.Equal(t, photo.Height, created.Height)
	})

	t.Run("creates photo with caption", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		caption := "Test caption"
		photo.Caption = &caption

		created, err := repo.Create(ctx, photo)
		require.NoError(t, err)
		require.NotNil(t, created.Caption)
		assert.Equal(t, caption, *created.Caption)
	})

	t.Run("creates primary photo", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		photo.IsPrimary = true

		created, err := repo.Create(ctx, photo)
		require.NoError(t, err)
		assert.True(t, created.IsPrimary)
	})
}

func TestItemPhotoRepository_GetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("retrieves existing photo", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		_, err := repo.Create(ctx, photo)
		require.NoError(t, err)

		retrieved, err := repo.GetByID(ctx, photo.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, photo.ID, retrieved.ID)
		assert.Equal(t, photo.Filename, retrieved.Filename)
	})

	t.Run("returns error for non-existent photo", func(t *testing.T) {
		_, err := repo.GetByID(ctx, uuid.New())
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
	})
}

func TestItemPhotoRepository_GetByItem(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("retrieves all photos for item ordered by display_order", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		// Create photos with different display orders
		for i := 0; i < 3; i++ {
			photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
			photo.DisplayOrder = int32(i)
			_, err := repo.Create(ctx, photo)
			require.NoError(t, err)
		}

		photos, err := repo.GetByItem(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.Len(t, photos, 3)

		// Verify ordering
		for i := 0; i < 3; i++ {
			assert.Equal(t, int32(i), photos[i].DisplayOrder)
		}
	})

	t.Run("returns empty slice for item with no photos", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photos, err := repo.GetByItem(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Empty(t, photos)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		itemID1 := testfixtures.CreateTestItem(t, pool, workspace1)
		photo := createTestItemPhoto(workspace1, itemID1, testfixtures.TestUserID)
		_, err := repo.Create(ctx, photo)
		require.NoError(t, err)

		// Try to get photos from wrong workspace
		photos, err := repo.GetByItem(ctx, itemID1, workspace2)
		require.NoError(t, err)
		assert.Empty(t, photos)

		// Get photos from correct workspace
		photos, err = repo.GetByItem(ctx, itemID1, workspace1)
		require.NoError(t, err)
		assert.Len(t, photos, 1)
	})
}

func TestItemPhotoRepository_GetPrimary(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("retrieves primary photo", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		// Create non-primary photo
		photo1 := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		_, err := repo.Create(ctx, photo1)
		require.NoError(t, err)

		// Create primary photo
		photo2 := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		photo2.IsPrimary = true
		_, err = repo.Create(ctx, photo2)
		require.NoError(t, err)

		primary, err := repo.GetPrimary(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, primary)
		assert.Equal(t, photo2.ID, primary.ID)
		assert.True(t, primary.IsPrimary)
	})

	t.Run("returns error when no primary photo exists", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		_, err := repo.Create(ctx, photo)
		require.NoError(t, err)

		_, err = repo.GetPrimary(ctx, itemID, testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
	})
}

func TestItemPhotoRepository_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("updates photo fields", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		_, err := repo.Create(ctx, photo)
		require.NoError(t, err)

		// Update fields
		newFilename := "updated-photo.jpg"
		newCaption := "Updated caption"
		photo.Filename = newFilename
		photo.Caption = &newCaption
		photo.DisplayOrder = 5

		err = repo.Update(ctx, photo)
		require.NoError(t, err)

		// Verify updates
		updated, err := repo.GetByID(ctx, photo.ID)
		require.NoError(t, err)
		assert.Equal(t, newFilename, updated.Filename)
		assert.Equal(t, newCaption, *updated.Caption)
		assert.Equal(t, int32(5), updated.DisplayOrder)
	})
}

func TestItemPhotoRepository_UpdateDisplayOrder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("updates display order", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		_, err := repo.Create(ctx, photo)
		require.NoError(t, err)

		err = repo.UpdateDisplayOrder(ctx, photo.ID, 10)
		require.NoError(t, err)

		updated, err := repo.GetByID(ctx, photo.ID)
		require.NoError(t, err)
		assert.Equal(t, int32(10), updated.DisplayOrder)
	})
}

func TestItemPhotoRepository_SetPrimary(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("sets photo as primary and unsets others", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		// Create first primary photo
		photo1 := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		photo1.IsPrimary = true
		_, err := repo.Create(ctx, photo1)
		require.NoError(t, err)

		// Create second photo (not primary)
		photo2 := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		_, err = repo.Create(ctx, photo2)
		require.NoError(t, err)

		// Set second photo as primary
		err = repo.SetPrimary(ctx, photo2.ID)
		require.NoError(t, err)

		// Verify only photo2 is primary
		updated1, err := repo.GetByID(ctx, photo1.ID)
		require.NoError(t, err)
		assert.False(t, updated1.IsPrimary)

		updated2, err := repo.GetByID(ctx, photo2.ID)
		require.NoError(t, err)
		assert.True(t, updated2.IsPrimary)

		// Verify GetPrimary returns photo2
		primary, err := repo.GetPrimary(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, photo2.ID, primary.ID)
	})

	t.Run("ensures only one primary photo per item", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		// Create multiple photos
		photoIDs := make([]uuid.UUID, 3)
		for i := 0; i < 3; i++ {
			photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
			created, err := repo.Create(ctx, photo)
			require.NoError(t, err)
			photoIDs[i] = created.ID
		}

		// Set each photo as primary in sequence
		for _, photoID := range photoIDs {
			err := repo.SetPrimary(ctx, photoID)
			require.NoError(t, err)

			// Verify only one is primary
			photos, err := repo.GetByItem(ctx, itemID, testfixtures.TestWorkspaceID)
			require.NoError(t, err)

			primaryCount := 0
			for _, p := range photos {
				if p.IsPrimary {
					primaryCount++
					assert.Equal(t, photoID, p.ID)
				}
			}
			assert.Equal(t, 1, primaryCount, "Should have exactly one primary photo")
		}
	})
}

func TestItemPhotoRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("deletes photo", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		_, err := repo.Create(ctx, photo)
		require.NoError(t, err)

		err = repo.Delete(ctx, photo.ID)
		require.NoError(t, err)

		_, err = repo.GetByID(ctx, photo.ID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
	})
}

func TestItemPhotoRepository_DeleteByItem(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("deletes all photos for item", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		// Create multiple photos
		for i := 0; i < 3; i++ {
			photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
			_, err := repo.Create(ctx, photo)
			require.NoError(t, err)
		}

		// Verify photos exist
		photos, err := repo.GetByItem(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Len(t, photos, 3)

		// Delete all photos
		err = repo.DeleteByItem(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)

		// Verify all photos deleted
		photos, err = repo.GetByItem(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Empty(t, photos)
	})
}

func TestItemPhotoRepository_CascadeDeleteOnItemDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	txManager := NewTxManager(pool)
	repo := NewItemPhotoRepository(pool, txManager)
	ctx := context.Background()

	t.Run("photos are deleted when item is deleted (cascade)", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		// Create photo
		photo := createTestItemPhoto(testfixtures.TestWorkspaceID, itemID, testfixtures.TestUserID)
		_, err := repo.Create(ctx, photo)
		require.NoError(t, err)

		// Delete item (this should cascade to photos)
		testfixtures.DeleteTestItem(t, pool, itemID)

		// Verify photo is deleted
		_, err = repo.GetByID(ctx, photo.ID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
	})
}
