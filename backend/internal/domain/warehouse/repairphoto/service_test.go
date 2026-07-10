package repairphoto

import (
	"context"
	"errors"
	"io"
	"mime/multipart"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockRepository implements Repository for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Create(ctx context.Context, photo *RepairPhoto) (*RepairPhoto, error) {
	args := m.Called(ctx, photo)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*RepairPhoto), args.Error(1)
}

func (m *MockRepository) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairPhoto, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*RepairPhoto), args.Error(1)
}

func (m *MockRepository) ListByRepairLog(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*RepairPhoto, error) {
	args := m.Called(ctx, repairLogID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*RepairPhoto), args.Error(1)
}

func (m *MockRepository) UpdateCaption(ctx context.Context, id, workspaceID uuid.UUID, caption *string) (*RepairPhoto, error) {
	args := m.Called(ctx, id, workspaceID, caption)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*RepairPhoto), args.Error(1)
}

func (m *MockRepository) UpdateDisplayOrder(ctx context.Context, id, workspaceID uuid.UUID, order int32) error {
	args := m.Called(ctx, id, workspaceID, order)
	return args.Error(0)
}

func (m *MockRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockRepository) GetMaxDisplayOrder(ctx context.Context, repairLogID, workspaceID uuid.UUID) (int32, error) {
	args := m.Called(ctx, repairLogID, workspaceID)
	return int32(args.Int(0)), args.Error(1)
}

// MockStorage implements Storage for testing
type MockStorage struct {
	mock.Mock
}

func (m *MockStorage) Save(ctx context.Context, workspaceID, entityID, filename string, reader io.Reader) (string, error) {
	args := m.Called(ctx, workspaceID, entityID, filename, reader)
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

// MockImageProcessor implements ImageProcessor for testing
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

func newTestPhoto(repairLogID, workspaceID uuid.UUID) *RepairPhoto {
	now := time.Now()
	return Reconstruct(
		uuid.New(),
		repairLogID,
		workspaceID,
		PhotoTypeBefore,
		"test.jpg",
		"storage/path/test.jpg",
		"storage/path/thumb_test.jpg",
		"image/jpeg",
		1024,
		800,
		600,
		0,
		nil,
		uuid.New(),
		now,
		now,
	)
}

func TestService_ListPhotos(t *testing.T) {
	ctx := context.Background()
	repairLogID := uuid.New()
	workspaceID := uuid.New()

	t.Run("returns photos for repair log", func(t *testing.T) {
		repo := new(MockRepository)
		photos := []*RepairPhoto{newTestPhoto(repairLogID, workspaceID), newTestPhoto(repairLogID, workspaceID)}
		repo.On("ListByRepairLog", ctx, repairLogID, workspaceID).Return(photos, nil)

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.ListPhotos(ctx, repairLogID, workspaceID)

		require.NoError(t, err)
		assert.Len(t, result, 2)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when repository fails", func(t *testing.T) {
		repo := new(MockRepository)
		repo.On("ListByRepairLog", ctx, repairLogID, workspaceID).Return(nil, errors.New("database error"))

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.ListPhotos(ctx, repairLogID, workspaceID)

		require.Error(t, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_GetPhoto(t *testing.T) {
	ctx := context.Background()
	repairLogID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("returns photo by ID", func(t *testing.T) {
		repo := new(MockRepository)
		photo := newTestPhoto(repairLogID, workspaceID)
		photo.ID = photoID
		repo.On("GetByID", ctx, photoID, workspaceID).Return(photo, nil)

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.GetPhoto(ctx, photoID, workspaceID)

		require.NoError(t, err)
		assert.Equal(t, photoID, result.ID)
		repo.AssertExpectations(t)
	})

	t.Run("returns ErrPhotoNotFound when repo returns nil", func(t *testing.T) {
		repo := new(MockRepository)
		repo.On("GetByID", ctx, photoID, workspaceID).Return(nil, nil)

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.GetPhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, ErrPhotoNotFound, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})

	t.Run("returns repository error", func(t *testing.T) {
		repo := new(MockRepository)
		expectedErr := errors.New("database error")
		repo.On("GetByID", ctx, photoID, workspaceID).Return(nil, expectedErr)

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.GetPhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_UpdateCaption(t *testing.T) {
	ctx := context.Background()
	repairLogID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("updates caption successfully", func(t *testing.T) {
		repo := new(MockRepository)
		photo := newTestPhoto(repairLogID, workspaceID)
		photo.ID = photoID
		caption := "new caption"
		updated := newTestPhoto(repairLogID, workspaceID)
		updated.ID = photoID
		updated.Caption = &caption

		repo.On("GetByID", ctx, photoID, workspaceID).Return(photo, nil)
		repo.On("UpdateCaption", ctx, photoID, workspaceID, &caption).Return(updated, nil)

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.UpdateCaption(ctx, photoID, workspaceID, &caption)

		require.NoError(t, err)
		assert.Equal(t, &caption, result.Caption)
		repo.AssertExpectations(t)
	})

	t.Run("returns ErrPhotoNotFound when photo does not exist", func(t *testing.T) {
		repo := new(MockRepository)
		repo.On("GetByID", ctx, photoID, workspaceID).Return(nil, nil)

		caption := "new caption"
		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.UpdateCaption(ctx, photoID, workspaceID, &caption)

		require.Error(t, err)
		assert.Equal(t, ErrPhotoNotFound, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when GetByID fails", func(t *testing.T) {
		repo := new(MockRepository)
		expectedErr := errors.New("database error")
		repo.On("GetByID", ctx, photoID, workspaceID).Return(nil, expectedErr)

		caption := "new caption"
		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.UpdateCaption(ctx, photoID, workspaceID, &caption)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when UpdateCaption repo call fails", func(t *testing.T) {
		repo := new(MockRepository)
		photo := newTestPhoto(repairLogID, workspaceID)
		photo.ID = photoID
		expectedErr := errors.New("update failed")

		repo.On("GetByID", ctx, photoID, workspaceID).Return(photo, nil)
		repo.On("UpdateCaption", ctx, photoID, workspaceID, mock.Anything).Return(nil, expectedErr)

		caption := "new caption"
		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.UpdateCaption(ctx, photoID, workspaceID, &caption)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to update caption")
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_DeletePhoto(t *testing.T) {
	ctx := context.Background()
	repairLogID := uuid.New()
	workspaceID := uuid.New()
	photoID := uuid.New()

	t.Run("deletes photo and its files successfully", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		photo := newTestPhoto(repairLogID, workspaceID)
		photo.ID = photoID

		repo.On("GetByID", ctx, photoID, workspaceID).Return(photo, nil)
		repo.On("Delete", ctx, photoID, workspaceID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(nil)
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(nil)

		svc := NewService(repo, storage, nil, os.TempDir())
		err := svc.DeletePhoto(ctx, photoID, workspaceID)

		require.NoError(t, err)
		repo.AssertExpectations(t)
		storage.AssertExpectations(t)
	})

	t.Run("returns ErrPhotoNotFound when photo does not exist", func(t *testing.T) {
		repo := new(MockRepository)
		repo.On("GetByID", ctx, photoID, workspaceID).Return(nil, nil)

		svc := NewService(repo, nil, nil, os.TempDir())
		err := svc.DeletePhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, ErrPhotoNotFound, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when GetByID fails", func(t *testing.T) {
		repo := new(MockRepository)
		expectedErr := errors.New("database error")
		repo.On("GetByID", ctx, photoID, workspaceID).Return(nil, expectedErr)

		svc := NewService(repo, nil, nil, os.TempDir())
		err := svc.DeletePhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when repo Delete fails", func(t *testing.T) {
		repo := new(MockRepository)
		photo := newTestPhoto(repairLogID, workspaceID)
		photo.ID = photoID
		expectedErr := errors.New("delete failed")

		repo.On("GetByID", ctx, photoID, workspaceID).Return(photo, nil)
		repo.On("Delete", ctx, photoID, workspaceID).Return(expectedErr)

		svc := NewService(repo, nil, nil, os.TempDir())
		err := svc.DeletePhoto(ctx, photoID, workspaceID)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to delete photo from database")
		repo.AssertExpectations(t)
	})

	t.Run("succeeds even when storage deletion fails (best effort)", func(t *testing.T) {
		repo := new(MockRepository)
		storage := new(MockStorage)
		photo := newTestPhoto(repairLogID, workspaceID)
		photo.ID = photoID

		repo.On("GetByID", ctx, photoID, workspaceID).Return(photo, nil)
		repo.On("Delete", ctx, photoID, workspaceID).Return(nil)
		storage.On("Delete", ctx, photo.StoragePath).Return(errors.New("storage error"))
		storage.On("Delete", ctx, photo.ThumbnailPath).Return(errors.New("storage error"))

		svc := NewService(repo, storage, nil, os.TempDir())
		err := svc.DeletePhoto(ctx, photoID, workspaceID)

		require.NoError(t, err)
		repo.AssertExpectations(t)
		storage.AssertExpectations(t)
	})
}

func TestService_UploadPhoto_Validation(t *testing.T) {
	ctx := context.Background()
	repairLogID := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()

	t.Run("rejects invalid photo type", func(t *testing.T) {
		repo := new(MockRepository)
		header := &multipart.FileHeader{Filename: "photo.jpg", Size: 1024, Header: make(map[string][]string)}

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.UploadPhoto(ctx, repairLogID, workspaceID, userID, PhotoType("INVALID"), nil, header, nil)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid photo type")
		assert.Nil(t, result)
	})

	t.Run("rejects file that exceeds max size", func(t *testing.T) {
		repo := new(MockRepository)
		header := &multipart.FileHeader{Filename: "large.jpg", Size: MaxFileSize + 1, Header: make(map[string][]string)}

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.UploadPhoto(ctx, repairLogID, workspaceID, userID, PhotoTypeBefore, nil, header, nil)

		require.Error(t, err)
		assert.Equal(t, ErrFileTooLarge, err)
		assert.Nil(t, result)
	})

	t.Run("rejects invalid MIME type", func(t *testing.T) {
		repo := new(MockRepository)
		header := &multipart.FileHeader{Filename: "doc.pdf", Size: 1024, Header: make(map[string][]string)}
		header.Header.Set("Content-Type", "application/pdf")

		svc := NewService(repo, nil, nil, os.TempDir())
		result, err := svc.UploadPhoto(ctx, repairLogID, workspaceID, userID, PhotoTypeBefore, nil, header, nil)

		require.Error(t, err)
		assert.Equal(t, ErrInvalidFileType, err)
		assert.Nil(t, result)
	})
}

func TestIsValidMimeType(t *testing.T) {
	assert.True(t, isValidMimeType(MimeTypeJPEG))
	assert.True(t, isValidMimeType(MimeTypePNG))
	assert.True(t, isValidMimeType(MimeTypeWEBP))
	assert.False(t, isValidMimeType("application/pdf"))
	assert.False(t, isValidMimeType(""))
}
