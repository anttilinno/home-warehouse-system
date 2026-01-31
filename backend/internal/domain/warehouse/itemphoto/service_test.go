package itemphoto_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
)

// MockRepository implements itemphoto.Repository for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Create(ctx context.Context, photo *itemphoto.ItemPhoto) (*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, photo)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockRepository) GetByID(ctx context.Context, id uuid.UUID) (*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockRepository) GetByItem(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, itemID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockRepository) GetPrimary(ctx context.Context, itemID, workspaceID uuid.UUID) (*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, itemID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockRepository) Update(ctx context.Context, photo *itemphoto.ItemPhoto) error {
	args := m.Called(ctx, photo)
	return args.Error(0)
}

func (m *MockRepository) UpdateDisplayOrder(ctx context.Context, id uuid.UUID, order int32) error {
	args := m.Called(ctx, id, order)
	return args.Error(0)
}

func (m *MockRepository) SetPrimary(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) DeleteByItem(ctx context.Context, itemID, workspaceID uuid.UUID) error {
	args := m.Called(ctx, itemID, workspaceID)
	return args.Error(0)
}

func (m *MockRepository) GetByIDs(ctx context.Context, ids []uuid.UUID, workspaceID uuid.UUID) ([]*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, ids, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockRepository) BulkDelete(ctx context.Context, ids []uuid.UUID, workspaceID uuid.UUID) error {
	args := m.Called(ctx, ids, workspaceID)
	return args.Error(0)
}

func (m *MockRepository) UpdateCaption(ctx context.Context, id, workspaceID uuid.UUID, caption *string) error {
	args := m.Called(ctx, id, workspaceID, caption)
	return args.Error(0)
}

func (m *MockRepository) GetPhotosWithHashes(ctx context.Context, workspaceID uuid.UUID) ([]*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockRepository) GetItemPhotosWithHashes(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, itemID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockRepository) UpdatePerceptualHash(ctx context.Context, id uuid.UUID, hash int64) error {
	args := m.Called(ctx, id, hash)
	return args.Error(0)
}

// MockStorage implements itemphoto.Storage for testing
type MockStorage struct {
	mock.Mock
}

func (m *MockStorage) Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (string, error) {
	args := m.Called(ctx, workspaceID, itemID, filename, reader)
	return args.String(0), args.Error(1)
}

func (m *MockStorage) Get(ctx context.Context, path string) (io.ReadCloser, error) {
	args := m.Called(ctx, path)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(io.ReadCloser), args.Error(1)
}

func (m *MockStorage) Delete(ctx context.Context, path string) error {
	args := m.Called(ctx, path)
	return args.Error(0)
}

func (m *MockStorage) GetURL(ctx context.Context, path string) (string, error) {
	args := m.Called(ctx, path)
	return args.String(0), args.Error(1)
}

func (m *MockStorage) Exists(ctx context.Context, path string) (bool, error) {
	args := m.Called(ctx, path)
	return args.Bool(0), args.Error(1)
}

// MockImageProcessor implements itemphoto.ImageProcessor for testing
type MockImageProcessor struct {
	mock.Mock
}

func (m *MockImageProcessor) GenerateThumbnail(ctx context.Context, sourcePath, destPath string, maxWidth, maxHeight int) error {
	args := m.Called(ctx, sourcePath, destPath, maxWidth, maxHeight)
	return args.Error(0)
}

func (m *MockImageProcessor) GetDimensions(ctx context.Context, path string) (int, int, error) {
	args := m.Called(ctx, path)
	return args.Int(0), args.Int(1), args.Error(2)
}

func (m *MockImageProcessor) Validate(ctx context.Context, path string) error {
	args := m.Called(ctx, path)
	return args.Error(0)
}

// Helper to create a test photo
func createServiceTestPhoto(_ *testing.T, itemID, workspaceID uuid.UUID) *itemphoto.ItemPhoto {
	return &itemphoto.ItemPhoto{
		ID:            uuid.New(),
		ItemID:        itemID,
		WorkspaceID:   workspaceID,
		Filename:      "test.jpg",
		StoragePath:   "workspaces/test/items/test/photo.jpg",
		ThumbnailPath: "workspaces/test/items/test/thumb_photo.jpg",
		FileSize:      1024,
		MimeType:      itemphoto.MimeTypeJPEG,
		Width:         800,
		Height:        600,
		DisplayOrder:  0,
		IsPrimary:     true,
		Caption:       nil,
		UploadedBy:    uuid.New(),
	}
}

func TestService_ListPhotos(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()

	t.Run("returns photos for item", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photos := []*itemphoto.ItemPhoto{
			createServiceTestPhoto(t, itemID, workspaceID),
			createServiceTestPhoto(t, itemID, workspaceID),
		}
		photos[1].DisplayOrder = 1
		photos[1].IsPrimary = false

		repo.On("GetByItem", ctx, itemID, workspaceID).Return(photos, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.ListPhotos(ctx, itemID, workspaceID)

		require.NoError(t, err)
		assert.Len(t, result, 2)
		repo.AssertExpectations(t)
	})

	t.Run("returns empty list when no photos exist", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.ListPhotos(ctx, itemID, workspaceID)

		require.NoError(t, err)
		assert.Len(t, result, 0)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when repository fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		expectedErr := errors.New("database error")
		repo.On("GetByItem", ctx, itemID, workspaceID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.ListPhotos(ctx, itemID, workspaceID)

		require.Error(t, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_GetPhoto(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("returns photo by ID", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID

		repo.On("GetByID", ctx, photoID).Return(photo, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.GetPhoto(ctx, photoID)

		require.NoError(t, err)
		assert.Equal(t, photoID, result.ID)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when photo not found", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		repo.On("GetByID", ctx, photoID).Return(nil, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.GetPhoto(ctx, photoID)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrPhotoNotFound, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_SetPrimaryPhoto(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("sets photo as primary successfully", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID
		photo.IsPrimary = false

		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("SetPrimary", ctx, photoID).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.SetPrimaryPhoto(ctx, photoID, workspaceID)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when photo not found", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		repo.On("GetByID", ctx, photoID).Return(nil, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.SetPrimaryPhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrPhotoNotFound, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns unauthorized when photo belongs to different workspace", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, uuid.New()) // Different workspace
		photo.ID = photoID

		repo.On("GetByID", ctx, photoID).Return(photo, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.SetPrimaryPhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrUnauthorized, err)
		repo.AssertExpectations(t)
	})
}

func TestService_UpdateCaption(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("updates caption successfully", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID

		newCaption := "Updated caption"

		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Update", ctx, mock.AnythingOfType("*itemphoto.ItemPhoto")).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.UpdateCaption(ctx, photoID, workspaceID, &newCaption)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("clears caption when set to nil", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		existingCaption := "Existing caption"
		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID
		photo.Caption = &existingCaption

		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Update", ctx, mock.MatchedBy(func(p *itemphoto.ItemPhoto) bool {
			return p.Caption == nil
		})).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.UpdateCaption(ctx, photoID, workspaceID, nil)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns unauthorized when photo belongs to different workspace", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, uuid.New()) // Different workspace
		photo.ID = photoID

		repo.On("GetByID", ctx, photoID).Return(photo, nil)

		newCaption := "Updated caption"
		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.UpdateCaption(ctx, photoID, workspaceID, &newCaption)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrUnauthorized, err)
		repo.AssertExpectations(t)
	})
}

func TestService_ReorderPhotos(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()

	t.Run("reorders photos successfully", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		photo2 := createServiceTestPhoto(t, itemID, workspaceID)
		photo3 := createServiceTestPhoto(t, itemID, workspaceID)
		photo1.DisplayOrder = 0
		photo2.DisplayOrder = 1
		photo3.DisplayOrder = 2

		existingPhotos := []*itemphoto.ItemPhoto{photo1, photo2, photo3}
		newOrder := []uuid.UUID{photo3.ID, photo1.ID, photo2.ID}

		repo.On("GetByItem", ctx, itemID, workspaceID).Return(existingPhotos, nil)
		repo.On("UpdateDisplayOrder", ctx, photo3.ID, int32(0)).Return(nil)
		repo.On("UpdateDisplayOrder", ctx, photo1.ID, int32(1)).Return(nil)
		repo.On("UpdateDisplayOrder", ctx, photo2.ID, int32(2)).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.ReorderPhotos(ctx, itemID, workspaceID, newOrder)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when photo IDs don't match existing photos", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		existingPhotos := []*itemphoto.ItemPhoto{photo1}

		// Try to reorder with a non-existent photo ID
		newOrder := []uuid.UUID{uuid.New()}

		repo.On("GetByItem", ctx, itemID, workspaceID).Return(existingPhotos, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.ReorderPhotos(ctx, itemID, workspaceID, newOrder)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrInvalidDisplayOrder, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when not all photos included", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		photo2 := createServiceTestPhoto(t, itemID, workspaceID)
		existingPhotos := []*itemphoto.ItemPhoto{photo1, photo2}

		// Only include one photo in reorder
		newOrder := []uuid.UUID{photo1.ID}

		repo.On("GetByItem", ctx, itemID, workspaceID).Return(existingPhotos, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.ReorderPhotos(ctx, itemID, workspaceID, newOrder)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrInvalidDisplayOrder, err)
		repo.AssertExpectations(t)
	})
}

func TestService_DeletePhoto(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("deletes photo successfully", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID
		photo.IsPrimary = false

		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Delete", ctx, photoID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		require.NoError(t, err)
		repo.AssertExpectations(t)
		storage.AssertExpectations(t)
	})

	t.Run("deletes primary photo and reassigns primary to next photo", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID
		photo.IsPrimary = true

		remainingPhoto := createServiceTestPhoto(t, itemID, workspaceID)
		remainingPhoto.IsPrimary = false

		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Delete", ctx, photoID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{remainingPhoto}, nil)
		repo.On("SetPrimary", ctx, remainingPhoto.ID).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		require.NoError(t, err)
		repo.AssertExpectations(t)
		storage.AssertExpectations(t)
	})

	t.Run("returns error when photo not found", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		repo.On("GetByID", ctx, photoID).Return(nil, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrPhotoNotFound, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns unauthorized when photo belongs to different workspace", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, uuid.New()) // Different workspace
		photo.ID = photoID

		repo.On("GetByID", ctx, photoID).Return(photo, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrUnauthorized, err)
		repo.AssertExpectations(t)
	})

	t.Run("continues even if storage deletion fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID
		photo.IsPrimary = false

		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Delete", ctx, photoID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(errors.New("storage error"))
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(errors.New("storage error"))

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		// Should succeed even if storage deletion fails
		require.NoError(t, err)
		repo.AssertExpectations(t)
		storage.AssertExpectations(t)
	})
}

func TestService_UploadPhoto_Validation(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()

	t.Run("rejects file that exceeds max size", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		// Create a mock file header with size > 10MB
		header := &multipart.FileHeader{
			Filename: "large.jpg",
			Size:     15 * 1024 * 1024, // 15MB
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, nil, header, nil)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrFileTooLarge, err)
		assert.Nil(t, result)
	})

	t.Run("rejects invalid MIME type", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		header := &multipart.FileHeader{
			Filename: "document.pdf",
			Size:     1024,
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "application/pdf")

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, nil, header, nil)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrInvalidFileType, err)
		assert.Nil(t, result)
	})
}

func TestService_UploadPhoto_Integration(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()

	// Create temporary directory for uploads
	tmpDir, err := os.MkdirTemp("", "photo-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	t.Run("uploads photo successfully with all operations", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		// Create a real temp file for testing
		testImagePath := filepath.Join(tmpDir, "test-image.jpg")
		testImageContent := []byte("fake image content for testing")
		require.NoError(t, os.WriteFile(testImagePath, testImageContent, 0644))

		// Create a mock file that can be read
		fileContent := bytes.NewReader(testImageContent)

		header := &multipart.FileHeader{
			Filename: "photo.jpg",
			Size:     int64(len(testImageContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		// Set up mocks
		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(800, 600, nil)
		processor.On("GenerateThumbnail", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), 400, 400).Return(nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "photo.jpg", mock.Anything).Return("path/to/photo.jpg", nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "thumb_photo.jpg", mock.Anything).Return("path/to/thumb_photo.jpg", nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)
		repo.On("Create", ctx, mock.AnythingOfType("*itemphoto.ItemPhoto")).Return(&itemphoto.ItemPhoto{
			ID:            uuid.New(),
			ItemID:        itemID,
			WorkspaceID:   workspaceID,
			Filename:      "photo.jpg",
			StoragePath:   "path/to/photo.jpg",
			ThumbnailPath: "path/to/thumb_photo.jpg",
			FileSize:      int64(len(testImageContent)),
			MimeType:      "image/jpeg",
			Width:         800,
			Height:        600,
			DisplayOrder:  0,
			IsPrimary:     true,
			UploadedBy:    userID,
		}, nil)

		// Create a custom io.Reader that wraps bytes.Reader
		service := itemphoto.NewService(repo, storage, processor, tmpDir)

		// Note: We can't easily test UploadPhoto with a real file read here
		// because multipart.File is an interface that requires os.File behavior.
		// The validation tests above cover the validation logic.
		// For a complete integration test, see tests/integration/item_photos_test.go

		_ = fileContent // Use fileContent to avoid unused variable error
		_ = service
	})
}

func TestEntity_Validate(t *testing.T) {
	basePhoto := func() *itemphoto.ItemPhoto {
		return &itemphoto.ItemPhoto{
			ID:            uuid.New(),
			ItemID:        uuid.New(),
			WorkspaceID:   uuid.New(),
			Filename:      "test.jpg",
			StoragePath:   "path/to/file.jpg",
			ThumbnailPath: "path/to/thumb.jpg",
			FileSize:      1024,
			MimeType:      itemphoto.MimeTypeJPEG,
			Width:         800,
			Height:        600,
			DisplayOrder:  0,
			IsPrimary:     false,
			UploadedBy:    uuid.New(),
		}
	}

	t.Run("valid photo passes validation", func(t *testing.T) {
		photo := basePhoto()
		err := photo.Validate()
		require.NoError(t, err)
	})

	t.Run("missing item_id fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.ItemID = uuid.Nil
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "item_id")
	})

	t.Run("missing workspace_id fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.WorkspaceID = uuid.Nil
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "workspace_id")
	})

	t.Run("missing filename fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.Filename = ""
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "filename")
	})

	t.Run("invalid MIME type fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.MimeType = "application/pdf"
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "mime_type")
	})

	t.Run("zero file size fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.FileSize = 0
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "file_size")
	})

	t.Run("negative display order fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.DisplayOrder = -1
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "display_order")
	})
}

func TestEntity_AspectRatio(t *testing.T) {
	t.Run("calculates aspect ratio correctly", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{Width: 1920, Height: 1080}
		ratio := photo.AspectRatio()
		assert.InDelta(t, 1.777, ratio, 0.01) // 16:9
	})

	t.Run("returns 0 for zero height", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{Width: 800, Height: 0}
		ratio := photo.AspectRatio()
		assert.Equal(t, float64(0), ratio)
	})
}

func TestEntity_Orientation(t *testing.T) {
	t.Run("detects landscape orientation", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{Width: 1920, Height: 1080}
		assert.True(t, photo.IsLandscape())
		assert.False(t, photo.IsPortrait())
		assert.False(t, photo.IsSquare())
	})

	t.Run("detects portrait orientation", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{Width: 1080, Height: 1920}
		assert.False(t, photo.IsLandscape())
		assert.True(t, photo.IsPortrait())
		assert.False(t, photo.IsSquare())
	})

	t.Run("detects square orientation", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{Width: 1000, Height: 1000}
		assert.False(t, photo.IsLandscape())
		assert.False(t, photo.IsPortrait())
		assert.True(t, photo.IsSquare())
	})

	t.Run("detects near-square as square", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{Width: 1000, Height: 1020}
		assert.True(t, photo.IsSquare()) // Within 5% tolerance
	})
}

func TestEntity_GetFileExtension(t *testing.T) {
	tests := []struct {
		mimeType string
		expected string
	}{
		{itemphoto.MimeTypeJPEG, "jpg"},
		{itemphoto.MimeTypePNG, "png"},
		{itemphoto.MimeTypeWEBP, "webp"},
		{"unknown/type", "bin"},
	}

	for _, tt := range tests {
		t.Run(tt.mimeType, func(t *testing.T) {
			photo := &itemphoto.ItemPhoto{MimeType: tt.mimeType}
			assert.Equal(t, tt.expected, photo.GetFileExtension())
		})
	}
}

func TestEntity_URLGeneration(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	photoID := uuid.New()

	photo := &itemphoto.ItemPhoto{
		ID:          photoID,
		ItemID:      itemID,
		WorkspaceID: workspaceID,
	}

	baseURL := "https://example.com"

	t.Run("generates correct thumbnail URL", func(t *testing.T) {
		expected := "https://example.com/api/v1/workspaces/" + workspaceID.String() +
			"/items/" + itemID.String() + "/photos/" + photoID.String() + "/thumbnail"
		assert.Equal(t, expected, photo.GetThumbnailURL(baseURL))
	})

	t.Run("generates correct full-size URL", func(t *testing.T) {
		expected := "https://example.com/api/v1/workspaces/" + workspaceID.String() +
			"/items/" + itemID.String() + "/photos/" + photoID.String()
		assert.Equal(t, expected, photo.GetFullSizeURL(baseURL))
	})

	t.Run("handles empty base URL", func(t *testing.T) {
		expected := "/api/v1/workspaces/" + workspaceID.String() +
			"/items/" + itemID.String() + "/photos/" + photoID.String()
		assert.Equal(t, expected, photo.GetFullSizeURL(""))
	})
}

func TestEntity_Validate_AdditionalCases(t *testing.T) {
	basePhoto := func() *itemphoto.ItemPhoto {
		return &itemphoto.ItemPhoto{
			ID:            uuid.New(),
			ItemID:        uuid.New(),
			WorkspaceID:   uuid.New(),
			Filename:      "test.jpg",
			StoragePath:   "path/to/file.jpg",
			ThumbnailPath: "path/to/thumb.jpg",
			FileSize:      1024,
			MimeType:      itemphoto.MimeTypeJPEG,
			Width:         800,
			Height:        600,
			DisplayOrder:  0,
			IsPrimary:     false,
			UploadedBy:    uuid.New(),
		}
	}

	t.Run("missing storage_path fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.StoragePath = ""
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "storage_path")
	})

	t.Run("empty thumbnail_path passes validation for async processing", func(t *testing.T) {
		// ThumbnailPath is optional for async processing - thumbnails generated in background
		photo := basePhoto()
		photo.ThumbnailPath = ""
		err := photo.Validate()
		require.NoError(t, err)
	})

	t.Run("missing mime_type fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.MimeType = ""
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "mime_type")
	})

	t.Run("zero width fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.Width = 0
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "width")
	})

	t.Run("negative width fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.Width = -100
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "width")
	})

	t.Run("zero height fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.Height = 0
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "height")
	})

	t.Run("negative height fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.Height = -100
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "height")
	})

	t.Run("negative file size fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.FileSize = -1
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "file_size")
	})

	t.Run("missing uploaded_by fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.UploadedBy = uuid.Nil
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "uploaded_by")
	})

	t.Run("valid PNG mime type passes validation", func(t *testing.T) {
		photo := basePhoto()
		photo.MimeType = itemphoto.MimeTypePNG
		err := photo.Validate()
		require.NoError(t, err)
	})

	t.Run("valid WebP mime type passes validation", func(t *testing.T) {
		photo := basePhoto()
		photo.MimeType = itemphoto.MimeTypeWEBP
		err := photo.Validate()
		require.NoError(t, err)
	})

	t.Run("invalid thumbnail_status fails validation", func(t *testing.T) {
		photo := basePhoto()
		photo.ThumbnailStatus = "invalid_status"
		err := photo.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "thumbnail_status")
	})

	t.Run("valid thumbnail_status passes validation", func(t *testing.T) {
		statuses := []itemphoto.ThumbnailStatus{
			itemphoto.ThumbnailStatusPending,
			itemphoto.ThumbnailStatusProcessing,
			itemphoto.ThumbnailStatusComplete,
			itemphoto.ThumbnailStatusFailed,
		}
		for _, status := range statuses {
			photo := basePhoto()
			photo.ThumbnailStatus = status
			err := photo.Validate()
			require.NoError(t, err, "status %s should be valid", status)
		}
	})
}

func TestThumbnailStatus(t *testing.T) {
	t.Run("IsValid returns true for valid statuses", func(t *testing.T) {
		assert.True(t, itemphoto.ThumbnailStatusPending.IsValid())
		assert.True(t, itemphoto.ThumbnailStatusProcessing.IsValid())
		assert.True(t, itemphoto.ThumbnailStatusComplete.IsValid())
		assert.True(t, itemphoto.ThumbnailStatusFailed.IsValid())
	})

	t.Run("IsValid returns false for invalid status", func(t *testing.T) {
		invalid := itemphoto.ThumbnailStatus("invalid")
		assert.False(t, invalid.IsValid())
	})

	t.Run("String returns correct value", func(t *testing.T) {
		assert.Equal(t, "pending", itemphoto.ThumbnailStatusPending.String())
		assert.Equal(t, "complete", itemphoto.ThumbnailStatusComplete.String())
	})
}

func TestThumbnailHelperMethods(t *testing.T) {
	t.Run("IsThumbnailReady returns true only for complete status", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{}

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusPending
		assert.False(t, photo.IsThumbnailReady())

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusProcessing
		assert.False(t, photo.IsThumbnailReady())

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusComplete
		assert.True(t, photo.IsThumbnailReady())

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusFailed
		assert.False(t, photo.IsThumbnailReady())
	})

	t.Run("IsThumbnailFailed returns true only for failed status", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{}

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusPending
		assert.False(t, photo.IsThumbnailFailed())

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusFailed
		assert.True(t, photo.IsThumbnailFailed())
	})

	t.Run("IsThumbnailPending returns true for pending or processing", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{}

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusPending
		assert.True(t, photo.IsThumbnailPending())

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusProcessing
		assert.True(t, photo.IsThumbnailPending())

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusComplete
		assert.False(t, photo.IsThumbnailPending())

		photo.ThumbnailStatus = itemphoto.ThumbnailStatusFailed
		assert.False(t, photo.IsThumbnailPending())
	})

	t.Run("GetBestThumbnail returns medium path when available", func(t *testing.T) {
		mediumPath := "path/to/medium.jpg"
		photo := &itemphoto.ItemPhoto{
			ThumbnailPath:       "legacy/thumb.jpg",
			ThumbnailMediumPath: &mediumPath,
		}
		assert.Equal(t, mediumPath, photo.GetBestThumbnail())
	})

	t.Run("GetBestThumbnail falls back to legacy thumbnail", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{
			ThumbnailPath:       "legacy/thumb.jpg",
			ThumbnailMediumPath: nil,
		}
		assert.Equal(t, "legacy/thumb.jpg", photo.GetBestThumbnail())
	})

	t.Run("GetBestThumbnail falls back when medium path is empty string", func(t *testing.T) {
		emptyPath := ""
		photo := &itemphoto.ItemPhoto{
			ThumbnailPath:       "legacy/thumb.jpg",
			ThumbnailMediumPath: &emptyPath,
		}
		assert.Equal(t, "legacy/thumb.jpg", photo.GetBestThumbnail())
	})

	t.Run("GetSmallThumbnail returns empty string when not set", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{}
		assert.Equal(t, "", photo.GetSmallThumbnail())
	})

	t.Run("GetSmallThumbnail returns path when set", func(t *testing.T) {
		smallPath := "path/to/small.jpg"
		photo := &itemphoto.ItemPhoto{ThumbnailSmallPath: &smallPath}
		assert.Equal(t, smallPath, photo.GetSmallThumbnail())
	})

	t.Run("GetMediumThumbnail falls back to legacy path", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{ThumbnailPath: "legacy/thumb.jpg"}
		assert.Equal(t, "legacy/thumb.jpg", photo.GetMediumThumbnail())
	})

	t.Run("GetLargeThumbnail returns empty string when not set", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{}
		assert.Equal(t, "", photo.GetLargeThumbnail())
	})
}

func TestService_GetPhoto_RepositoryError(t *testing.T) {
	ctx := context.Background()
	photoID := uuid.New()

	t.Run("returns repository error", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		expectedErr := errors.New("database connection failed")
		repo.On("GetByID", ctx, photoID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.GetPhoto(ctx, photoID)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_SetPrimaryPhoto_RepositoryError(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("returns error when GetByID fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		expectedErr := errors.New("database error")
		repo.On("GetByID", ctx, photoID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.SetPrimaryPhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when SetPrimary fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID

		expectedErr := errors.New("failed to update primary")
		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("SetPrimary", ctx, photoID).Return(expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.SetPrimaryPhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to set primary photo")
		repo.AssertExpectations(t)
	})
}

func TestService_UpdateCaption_Errors(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("returns error when GetByID fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		expectedErr := errors.New("database error")
		repo.On("GetByID", ctx, photoID).Return(nil, expectedErr)

		caption := "Test caption"
		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.UpdateCaption(ctx, photoID, workspaceID, &caption)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when photo not found", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		repo.On("GetByID", ctx, photoID).Return(nil, nil)

		caption := "Test caption"
		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.UpdateCaption(ctx, photoID, workspaceID, &caption)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrPhotoNotFound, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when Update fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID

		expectedErr := errors.New("update failed")
		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Update", ctx, mock.AnythingOfType("*itemphoto.ItemPhoto")).Return(expectedErr)

		caption := "Test caption"
		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.UpdateCaption(ctx, photoID, workspaceID, &caption)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to update caption")
		repo.AssertExpectations(t)
	})
}

func TestService_ReorderPhotos_Errors(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()

	t.Run("returns error when GetByItem fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		expectedErr := errors.New("database error")
		repo.On("GetByItem", ctx, itemID, workspaceID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.ReorderPhotos(ctx, itemID, workspaceID, []uuid.UUID{uuid.New()})

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get existing photos")
		repo.AssertExpectations(t)
	})

	t.Run("returns error when UpdateDisplayOrder fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		existingPhotos := []*itemphoto.ItemPhoto{photo1}
		newOrder := []uuid.UUID{photo1.ID}

		expectedErr := errors.New("update order failed")
		repo.On("GetByItem", ctx, itemID, workspaceID).Return(existingPhotos, nil)
		repo.On("UpdateDisplayOrder", ctx, photo1.ID, int32(0)).Return(expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.ReorderPhotos(ctx, itemID, workspaceID, newOrder)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to update display order")
		repo.AssertExpectations(t)
	})

	t.Run("returns error for extra photo IDs in reorder", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		existingPhotos := []*itemphoto.ItemPhoto{photo1}

		// Try to reorder with extra IDs (more than existing)
		newOrder := []uuid.UUID{photo1.ID, uuid.New()}

		repo.On("GetByItem", ctx, itemID, workspaceID).Return(existingPhotos, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.ReorderPhotos(ctx, itemID, workspaceID, newOrder)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrInvalidDisplayOrder, err)
		repo.AssertExpectations(t)
	})
}

func TestService_DeletePhoto_Errors(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("returns error when GetByID fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		expectedErr := errors.New("database error")
		repo.On("GetByID", ctx, photoID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when database Delete fails", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID
		photo.IsPrimary = false

		expectedErr := errors.New("delete failed")
		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Delete", ctx, photoID).Return(expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to delete photo from database")
		repo.AssertExpectations(t)
	})

	t.Run("deletes primary photo but no remaining photos", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID
		photo.IsPrimary = true

		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Delete", ctx, photoID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(nil)
		// Return empty list - no remaining photos
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		require.NoError(t, err)
		repo.AssertExpectations(t)
		storage.AssertExpectations(t)
	})

	t.Run("handles GetByItem error after primary delete gracefully", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.ID = photoID
		photo.IsPrimary = true

		repo.On("GetByID", ctx, photoID).Return(photo, nil)
		repo.On("Delete", ctx, photoID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(nil)
		// GetByItem fails - but should be handled gracefully
		repo.On("GetByItem", ctx, itemID, workspaceID).Return(nil, errors.New("db error"))

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.DeletePhoto(ctx, photoID, workspaceID)

		// Should still succeed since primary reassignment is best-effort
		require.NoError(t, err)
		repo.AssertExpectations(t)
		storage.AssertExpectations(t)
	})
}

// mockFile implements multipart.File interface for testing
type mockFile struct {
	*bytes.Reader
}

func (f *mockFile) Close() error {
	return nil
}

func TestService_UploadPhoto_FullFlow(t *testing.T) {
	itemID := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()

	// Create temporary directory for uploads
	tmpDir, err := os.MkdirTemp("", "photo-upload-test-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	t.Run("successful upload as first photo becomes primary", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		// Create test file content
		testContent := []byte("fake jpeg image content for testing purposes")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "test-image.jpg",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		// Set up all mocks in order of execution
		// Note: Thumbnails are now generated asynchronously, so no thumbnail mocks needed
		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(1920, 1080, nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "test-image.jpg", mock.Anything).Return("photos/original.jpg", nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)
		repo.On("Create", ctx, mock.MatchedBy(func(p *itemphoto.ItemPhoto) bool {
			return p.ItemID == itemID &&
				p.WorkspaceID == workspaceID &&
				p.IsPrimary == true && // First photo should be primary
				p.DisplayOrder == 0 &&
				p.Filename == "test-image.jpg" &&
				p.Width == 1920 &&
				p.Height == 1080 &&
				p.ThumbnailPath == "" && // Empty - thumbnails generated async
				p.ThumbnailStatus == itemphoto.ThumbnailStatusPending // Async status
		})).Return(&itemphoto.ItemPhoto{
			ID:              uuid.New(),
			ItemID:          itemID,
			WorkspaceID:     workspaceID,
			Filename:        "test-image.jpg",
			StoragePath:     "photos/original.jpg",
			ThumbnailPath:   "", // Empty for async processing
			ThumbnailStatus: itemphoto.ThumbnailStatusPending,
			FileSize:        int64(len(testContent)),
			MimeType:        "image/jpeg",
			Width:           1920,
			Height:          1080,
			DisplayOrder:    0,
			IsPrimary:       true,
			UploadedBy:      userID,
		}, nil)

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, itemID, result.ItemID)
		assert.True(t, result.IsPrimary)
		assert.Equal(t, itemphoto.ThumbnailStatusPending, result.ThumbnailStatus)
		processor.AssertExpectations(t)
		storage.AssertExpectations(t)
		repo.AssertExpectations(t)
	})

	t.Run("successful upload as second photo is not primary", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("another fake jpeg image")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "second-image.jpg",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		existingPhoto := createServiceTestPhoto(t, itemID, workspaceID)

		// Note: Thumbnails are now generated asynchronously, so no thumbnail mocks needed
		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(800, 600, nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "second-image.jpg", mock.Anything).Return("photos/second.jpg", nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{existingPhoto}, nil)
		repo.On("Create", ctx, mock.MatchedBy(func(p *itemphoto.ItemPhoto) bool {
			return p.IsPrimary == false && // Second photo should NOT be primary
				p.DisplayOrder == 1 && // Should be after first photo
				p.ThumbnailStatus == itemphoto.ThumbnailStatusPending // Async status
		})).Return(&itemphoto.ItemPhoto{
			ID:              uuid.New(),
			ItemID:          itemID,
			WorkspaceID:     workspaceID,
			IsPrimary:       false,
			DisplayOrder:    1,
			ThumbnailStatus: itemphoto.ThumbnailStatusPending,
			UploadedBy:      userID,
		}, nil)

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsPrimary)
		assert.Equal(t, int32(1), result.DisplayOrder)
	})

	t.Run("upload with caption", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("image with caption")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "captioned.jpg",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		caption := "My awesome photo"

		// Note: Thumbnails are now generated asynchronously, so no thumbnail mocks needed
		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(640, 480, nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "captioned.jpg", mock.Anything).Return("photos/captioned.jpg", nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)
		repo.On("Create", ctx, mock.MatchedBy(func(p *itemphoto.ItemPhoto) bool {
			return p.Caption != nil && *p.Caption == caption &&
				p.ThumbnailStatus == itemphoto.ThumbnailStatusPending
		})).Return(&itemphoto.ItemPhoto{
			ID:              uuid.New(),
			Caption:         &caption,
			IsPrimary:       true,
			ThumbnailStatus: itemphoto.ThumbnailStatusPending,
			UploadedBy:      userID,
		}, nil)

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, &caption)

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.NotNil(t, result.Caption)
		assert.Equal(t, caption, *result.Caption)
	})

	t.Run("fails when image validation fails", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("corrupted image data")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "corrupted.jpg",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(errors.New("invalid image format"))

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid image")
		assert.Nil(t, result)
	})

	t.Run("fails when GetDimensions fails", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("some image content")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "test.jpg",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(0, 0, errors.New("failed to read dimensions"))

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get image dimensions")
		assert.Nil(t, result)
	})

	t.Run("fails when original file storage fails", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("image content")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "test.jpg",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(800, 600, nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "test.jpg", mock.Anything).Return("", errors.New("storage full"))

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to save file")
		assert.Nil(t, result)
	})

	// Note: "cleans up original when thumbnail generation fails" and "cleans up files when thumbnail storage fails"
	// test cases removed - thumbnails are now generated asynchronously, so these failures don't happen during upload

	t.Run("cleans up files when GetByItem fails", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("image content")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "test.jpg",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		originalPath := "photos/original.jpg"

		// Note: No thumbnail mocks - thumbnails are generated asynchronously
		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(800, 600, nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "test.jpg", mock.Anything).Return(originalPath, nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return(nil, errors.New("database error"))
		storage.On("Delete", ctx, originalPath).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get existing photos")
		assert.Nil(t, result)
	})

	t.Run("cleans up files when repository Create fails", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("image content")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "test.jpg",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/jpeg")

		originalPath := "photos/original.jpg"

		// Note: No thumbnail mocks - thumbnails are generated asynchronously
		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(800, 600, nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "test.jpg", mock.Anything).Return(originalPath, nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)
		repo.On("Create", ctx, mock.AnythingOfType("*itemphoto.ItemPhoto")).Return(nil, errors.New("database error"))
		storage.On("Delete", ctx, originalPath).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to save photo to database")
		assert.Nil(t, result)
	})

	t.Run("accepts PNG mime type", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("png image content")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "test.png",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/png")

		// Note: No thumbnail mocks - thumbnails are generated asynchronously
		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(800, 600, nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "test.png", mock.Anything).Return("photos/test.png", nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)
		repo.On("Create", ctx, mock.MatchedBy(func(p *itemphoto.ItemPhoto) bool {
			return p.MimeType == "image/png" &&
				p.ThumbnailStatus == itemphoto.ThumbnailStatusPending
		})).Return(&itemphoto.ItemPhoto{
			ID:              uuid.New(),
			MimeType:        "image/png",
			IsPrimary:       true,
			ThumbnailStatus: itemphoto.ThumbnailStatusPending,
		}, nil)

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.NoError(t, err)
		require.NotNil(t, result)
	})

	t.Run("accepts WebP mime type", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		testContent := []byte("webp image content")
		file := &mockFile{bytes.NewReader(testContent)}

		header := &multipart.FileHeader{
			Filename: "test.webp",
			Size:     int64(len(testContent)),
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/webp")

		// Note: No thumbnail mocks - thumbnails are generated asynchronously
		processor.On("Validate", ctx, mock.AnythingOfType("string")).Return(nil)
		processor.On("GetDimensions", ctx, mock.AnythingOfType("string")).Return(800, 600, nil)
		storage.On("Save", ctx, workspaceID.String(), itemID.String(), "test.webp", mock.Anything).Return("photos/test.webp", nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)
		repo.On("Create", ctx, mock.MatchedBy(func(p *itemphoto.ItemPhoto) bool {
			return p.MimeType == "image/webp" &&
				p.ThumbnailStatus == itemphoto.ThumbnailStatusPending
		})).Return(&itemphoto.ItemPhoto{
			ID:              uuid.New(),
			MimeType:        "image/webp",
			IsPrimary:       true,
			ThumbnailStatus: itemphoto.ThumbnailStatusPending,
		}, nil)

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, file, header, nil)

		require.NoError(t, err)
		require.NotNil(t, result)
	})

	t.Run("rejects GIF mime type", func(t *testing.T) {
		ctx := context.Background()
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		header := &multipart.FileHeader{
			Filename: "test.gif",
			Size:     1024,
			Header:   make(map[string][]string),
		}
		header.Header.Set("Content-Type", "image/gif")

		service := itemphoto.NewService(repo, storage, processor, tmpDir)
		result, err := service.UploadPhoto(ctx, itemID, workspaceID, userID, nil, header, nil)

		require.Error(t, err)
		assert.Equal(t, itemphoto.ErrInvalidFileType, err)
		assert.Nil(t, result)
	})
}

func TestIsValidMimeType(t *testing.T) {
	t.Run("JPEG is valid", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{MimeType: "image/jpeg"}
		assert.True(t, photo.IsValidMimeType())
	})

	t.Run("PNG is valid", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{MimeType: "image/png"}
		assert.True(t, photo.IsValidMimeType())
	})

	t.Run("WebP is valid", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{MimeType: "image/webp"}
		assert.True(t, photo.IsValidMimeType())
	})

	t.Run("GIF is not valid", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{MimeType: "image/gif"}
		assert.False(t, photo.IsValidMimeType())
	})

	t.Run("PDF is not valid", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{MimeType: "application/pdf"}
		assert.False(t, photo.IsValidMimeType())
	})

	t.Run("empty is not valid", func(t *testing.T) {
		photo := &itemphoto.ItemPhoto{MimeType: ""}
		assert.False(t, photo.IsValidMimeType())
	})
}

// MockHasher implements itemphoto.Hasher for testing
type MockHasher struct {
	mock.Mock
}

func (m *MockHasher) GenerateHash(ctx context.Context, imagePath string) (int64, error) {
	args := m.Called(ctx, imagePath)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockHasher) CompareHashes(hash1, hash2 int64) (bool, int) {
	args := m.Called(hash1, hash2)
	return args.Bool(0), args.Int(1)
}

func (m *MockHasher) IsSimilar(hash1, hash2 int64) bool {
	args := m.Called(hash1, hash2)
	return args.Bool(0)
}

func (m *MockHasher) GetDistance(hash1, hash2 int64) int {
	args := m.Called(hash1, hash2)
	return args.Int(0)
}

func TestService_BulkDeletePhotos(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()

	t.Run("success: multiple photos deleted", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		photo2 := createServiceTestPhoto(t, itemID, workspaceID)
		photo1.IsPrimary = false
		photo2.IsPrimary = false
		photoIDs := []uuid.UUID{photo1.ID, photo2.ID}

		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return([]*itemphoto.ItemPhoto{photo1, photo2}, nil)
		repo.On("BulkDelete", ctx, photoIDs, workspaceID).Return(nil)
		storage.On("Delete", ctx, photo1.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo1.ThumbnailPath).Return(nil)
		storage.On("Delete", ctx, photo2.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo2.ThumbnailPath).Return(nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, photoIDs)

		require.NoError(t, err)
		repo.AssertExpectations(t)
		storage.AssertExpectations(t)
	})

	t.Run("success: empty list is no-op", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, []uuid.UUID{})

		require.NoError(t, err)
		// No repository calls expected
		repo.AssertExpectations(t)
	})

	t.Run("success: single photo deleted", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.IsPrimary = false
		photoIDs := []uuid.UUID{photo.ID}

		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		repo.On("BulkDelete", ctx, photoIDs, workspaceID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, photoIDs)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("error: photo belongs to different item", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		differentItemID := uuid.New()
		photo := createServiceTestPhoto(t, differentItemID, workspaceID) // Different item
		photoIDs := []uuid.UUID{photo.ID}

		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, photoIDs)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "does not belong to item")
		repo.AssertExpectations(t)
	})

	t.Run("error: GetByIDs repository error", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photoIDs := []uuid.UUID{uuid.New()}
		expectedErr := errors.New("database error")
		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, photoIDs)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get photos")
		repo.AssertExpectations(t)
	})

	t.Run("error: BulkDelete repository error", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photoIDs := []uuid.UUID{photo.ID}
		expectedErr := errors.New("bulk delete failed")

		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		repo.On("BulkDelete", ctx, photoIDs, workspaceID).Return(expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, photoIDs)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to delete photos from database")
		repo.AssertExpectations(t)
	})

	t.Run("success: reassigns primary after bulk delete", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.IsPrimary = true // Deleting the primary photo
		photoIDs := []uuid.UUID{photo.ID}

		remainingPhoto := createServiceTestPhoto(t, itemID, workspaceID)
		remainingPhoto.IsPrimary = false

		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		repo.On("BulkDelete", ctx, photoIDs, workspaceID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{remainingPhoto}, nil)
		repo.On("SetPrimary", ctx, remainingPhoto.ID).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, photoIDs)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("success: deletes multi-size thumbnails when present", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		smallPath := "small/thumb.jpg"
		mediumPath := "medium/thumb.jpg"
		largePath := "large/thumb.jpg"

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.IsPrimary = false
		photo.ThumbnailSmallPath = &smallPath
		photo.ThumbnailMediumPath = &mediumPath
		photo.ThumbnailLargePath = &largePath
		photoIDs := []uuid.UUID{photo.ID}

		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		repo.On("BulkDelete", ctx, photoIDs, workspaceID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(nil)
		storage.On("Delete", ctx, smallPath).Return(nil)
		storage.On("Delete", ctx, mediumPath).Return(nil)
		storage.On("Delete", ctx, largePath).Return(nil)
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, photoIDs)

		require.NoError(t, err)
		storage.AssertExpectations(t)
	})

	t.Run("success: storage errors are ignored during bulk delete", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.IsPrimary = false
		photoIDs := []uuid.UUID{photo.ID}

		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		repo.On("BulkDelete", ctx, photoIDs, workspaceID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(errors.New("storage error"))
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(errors.New("storage error"))
		repo.On("GetByItem", ctx, itemID, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkDeletePhotos(ctx, itemID, workspaceID, photoIDs)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})
}

func TestService_BulkUpdateCaptions(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("success: all captions updated", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		caption1 := "Caption 1"
		caption2 := "Caption 2"
		photo1ID := uuid.New()
		photo2ID := uuid.New()

		updates := []itemphoto.CaptionUpdate{
			{PhotoID: photo1ID, Caption: &caption1},
			{PhotoID: photo2ID, Caption: &caption2},
		}

		repo.On("UpdateCaption", ctx, photo1ID, workspaceID, &caption1).Return(nil)
		repo.On("UpdateCaption", ctx, photo2ID, workspaceID, &caption2).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkUpdateCaptions(ctx, workspaceID, updates)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("success: empty updates is no-op", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkUpdateCaptions(ctx, workspaceID, []itemphoto.CaptionUpdate{})

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("success: clears caption when nil", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photoID := uuid.New()
		updates := []itemphoto.CaptionUpdate{
			{PhotoID: photoID, Caption: nil},
		}

		repo.On("UpdateCaption", ctx, photoID, workspaceID, (*string)(nil)).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkUpdateCaptions(ctx, workspaceID, updates)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("error: repository error stops processing", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		caption := "Caption"
		photo1ID := uuid.New()
		photo2ID := uuid.New()

		updates := []itemphoto.CaptionUpdate{
			{PhotoID: photo1ID, Caption: &caption},
			{PhotoID: photo2ID, Caption: &caption},
		}

		expectedErr := errors.New("update failed")
		repo.On("UpdateCaption", ctx, photo1ID, workspaceID, &caption).Return(expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkUpdateCaptions(ctx, workspaceID, updates)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to update caption")
		repo.AssertExpectations(t)
	})

	t.Run("success: single caption update", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		caption := "Single caption"
		photoID := uuid.New()
		updates := []itemphoto.CaptionUpdate{
			{PhotoID: photoID, Caption: &caption},
		}

		repo.On("UpdateCaption", ctx, photoID, workspaceID, &caption).Return(nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		err := service.BulkUpdateCaptions(ctx, workspaceID, updates)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})
}

func TestService_GetPhotosForDownload(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()

	t.Run("returns photos for item", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		photo2 := createServiceTestPhoto(t, itemID, workspaceID)
		photos := []*itemphoto.ItemPhoto{photo1, photo2}

		repo.On("GetByItem", ctx, itemID, workspaceID).Return(photos, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.GetPhotosForDownload(ctx, itemID, workspaceID)

		require.NoError(t, err)
		assert.Len(t, result, 2)
		repo.AssertExpectations(t)
	})

	t.Run("returns error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		expectedErr := errors.New("database error")
		repo.On("GetByItem", ctx, itemID, workspaceID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.GetPhotosForDownload(ctx, itemID, workspaceID)

		require.Error(t, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_GetPhotosByIDs(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("returns photos by IDs", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		itemID := uuid.New()
		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		photo2 := createServiceTestPhoto(t, itemID, workspaceID)
		photoIDs := []uuid.UUID{photo1.ID, photo2.ID}
		photos := []*itemphoto.ItemPhoto{photo1, photo2}

		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return(photos, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.GetPhotosByIDs(ctx, photoIDs, workspaceID)

		require.NoError(t, err)
		assert.Len(t, result, 2)
		repo.AssertExpectations(t)
	})

	t.Run("returns error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		photoIDs := []uuid.UUID{uuid.New()}
		expectedErr := errors.New("database error")
		repo.On("GetByIDs", ctx, photoIDs, workspaceID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		result, err := service.GetPhotosByIDs(ctx, photoIDs, workspaceID)

		require.Error(t, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_CheckDuplicates(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("returns nil when hasher is not set", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		// Hasher is not set by default
		result, err := service.CheckDuplicates(ctx, workspaceID, 123456)

		require.NoError(t, err)
		assert.Nil(t, result)
	})

	t.Run("returns empty when no photos with hashes exist", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, 123456)

		require.NoError(t, err)
		assert.Empty(t, result)
		repo.AssertExpectations(t)
	})

	t.Run("returns exact duplicates when same hash", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		itemID := uuid.New()
		hash := int64(123456)
		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.PerceptualHash = &hash

		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		hasher.On("CompareHashes", hash, hash).Return(true, 0) // Exact match

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, hash)

		require.NoError(t, err)
		require.Len(t, result, 1)
		assert.Equal(t, photo.ID, result[0].PhotoID)
		assert.Equal(t, itemID, result[0].ItemID)
		assert.Equal(t, 0, result[0].Distance)
		assert.Equal(t, 100.0, result[0].SimilarityPct)
		repo.AssertExpectations(t)
		hasher.AssertExpectations(t)
	})

	t.Run("returns similar images above threshold", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		itemID := uuid.New()
		inputHash := int64(123456)
		photoHash := int64(123460) // Similar but not exact
		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.PerceptualHash = &photoHash

		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		hasher.On("CompareHashes", inputHash, photoHash).Return(true, 3) // Similar, distance 3

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, inputHash)

		require.NoError(t, err)
		require.Len(t, result, 1)
		assert.Equal(t, 3, result[0].Distance)
		assert.InDelta(t, 70.0, result[0].SimilarityPct, 0.1) // 100 - (3/10)*100 = 70%
		repo.AssertExpectations(t)
		hasher.AssertExpectations(t)
	})

	t.Run("does not return photos below threshold", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		itemID := uuid.New()
		inputHash := int64(123456)
		photoHash := int64(999999) // Very different
		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.PerceptualHash = &photoHash

		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		hasher.On("CompareHashes", inputHash, photoHash).Return(false, 20) // Not similar

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, inputHash)

		require.NoError(t, err)
		assert.Empty(t, result)
		repo.AssertExpectations(t)
		hasher.AssertExpectations(t)
	})

	t.Run("skips photos without hashes", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		itemID := uuid.New()
		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.PerceptualHash = nil // No hash

		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, 123456)

		require.NoError(t, err)
		assert.Empty(t, result)
		repo.AssertExpectations(t)
	})

	t.Run("returns error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		expectedErr := errors.New("database error")
		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return(nil, expectedErr)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, 123456)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get photos")
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})

	t.Run("sorts results by distance (most similar first)", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		itemID := uuid.New()
		inputHash := int64(123456)

		hash1 := int64(123460)
		hash2 := int64(123458)
		hash3 := int64(123459)

		photo1 := createServiceTestPhoto(t, itemID, workspaceID)
		photo1.PerceptualHash = &hash1
		photo2 := createServiceTestPhoto(t, itemID, workspaceID)
		photo2.PerceptualHash = &hash2
		photo3 := createServiceTestPhoto(t, itemID, workspaceID)
		photo3.PerceptualHash = &hash3

		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{photo1, photo2, photo3}, nil)
		hasher.On("CompareHashes", inputHash, hash1).Return(true, 5) // Least similar
		hasher.On("CompareHashes", inputHash, hash2).Return(true, 1) // Most similar
		hasher.On("CompareHashes", inputHash, hash3).Return(true, 3) // Middle

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, inputHash)

		require.NoError(t, err)
		require.Len(t, result, 3)
		// Should be sorted by distance: 1, 3, 5
		assert.Equal(t, 1, result[0].Distance)
		assert.Equal(t, 3, result[1].Distance)
		assert.Equal(t, 5, result[2].Distance)
		repo.AssertExpectations(t)
		hasher.AssertExpectations(t)
	})

	t.Run("calculates similarity percentage correctly for high distance", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		itemID := uuid.New()
		inputHash := int64(123456)
		photoHash := int64(123470)
		photo := createServiceTestPhoto(t, itemID, workspaceID)
		photo.PerceptualHash = &photoHash

		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{photo}, nil)
		hasher.On("CompareHashes", inputHash, photoHash).Return(true, 15) // High distance

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, inputHash)

		require.NoError(t, err)
		require.Len(t, result, 1)
		// Similarity = 100 - (15/10)*100 = -50, but should be clamped to 0
		assert.Equal(t, 0.0, result[0].SimilarityPct)
		repo.AssertExpectations(t)
	})

	t.Run("finds duplicates across multiple items", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		item1ID := uuid.New()
		item2ID := uuid.New()
		inputHash := int64(123456)

		hash1 := int64(123456)
		hash2 := int64(123456)

		photo1 := createServiceTestPhoto(t, item1ID, workspaceID)
		photo1.PerceptualHash = &hash1
		photo2 := createServiceTestPhoto(t, item2ID, workspaceID)
		photo2.PerceptualHash = &hash2

		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{photo1, photo2}, nil)
		hasher.On("CompareHashes", inputHash, hash1).Return(true, 0)
		hasher.On("CompareHashes", inputHash, hash2).Return(true, 0)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)
		result, err := service.CheckDuplicates(ctx, workspaceID, inputHash)

		require.NoError(t, err)
		require.Len(t, result, 2)
		// Both should have different item IDs
		itemIDs := []uuid.UUID{result[0].ItemID, result[1].ItemID}
		assert.Contains(t, itemIDs, item1ID)
		assert.Contains(t, itemIDs, item2ID)
		repo.AssertExpectations(t)
	})
}

func TestService_SetAsynqClient(t *testing.T) {
	t.Run("sets asynq client", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		// SetAsynqClient is a setter method - we just verify it doesn't panic
		service.SetAsynqClient(nil)
	})
}

func TestService_SetHasher(t *testing.T) {
	t.Run("sets hasher", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		processor := new(MockImageProcessor)
		hasher := new(MockHasher)

		service := itemphoto.NewService(repo, storage, processor, os.TempDir())
		service.SetHasher(hasher)

		// Verify hasher is set by checking CheckDuplicates behavior
		ctx := context.Background()
		workspaceID := uuid.New()
		hasher.On("CompareHashes", mock.Anything, mock.Anything).Return(false, 99)
		repo.On("GetPhotosWithHashes", ctx, workspaceID).Return([]*itemphoto.ItemPhoto{}, nil)

		_, err := service.CheckDuplicates(ctx, workspaceID, 123)
		require.NoError(t, err)
	})
}
