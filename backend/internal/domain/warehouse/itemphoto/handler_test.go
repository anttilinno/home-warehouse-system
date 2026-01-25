package itemphoto_test

import (
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements itemphoto.ServiceInterface for testing
type MockService struct {
	mock.Mock
}

func (m *MockService) UploadPhoto(ctx context.Context, itemID, workspaceID, userID uuid.UUID, file multipart.File, header *multipart.FileHeader, caption *string) (*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, itemID, workspaceID, userID, file, header, caption)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockService) ListPhotos(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, itemID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockService) GetPhoto(ctx context.Context, id uuid.UUID) (*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockService) SetPrimaryPhoto(ctx context.Context, photoID, workspaceID uuid.UUID) error {
	args := m.Called(ctx, photoID, workspaceID)
	return args.Error(0)
}

func (m *MockService) UpdateCaption(ctx context.Context, photoID, workspaceID uuid.UUID, caption *string) error {
	args := m.Called(ctx, photoID, workspaceID, caption)
	return args.Error(0)
}

func (m *MockService) ReorderPhotos(ctx context.Context, itemID, workspaceID uuid.UUID, photoIDs []uuid.UUID) error {
	args := m.Called(ctx, itemID, workspaceID, photoIDs)
	return args.Error(0)
}

func (m *MockService) DeletePhoto(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) BulkDeletePhotos(ctx context.Context, itemID, workspaceID uuid.UUID, photoIDs []uuid.UUID) error {
	args := m.Called(ctx, itemID, workspaceID, photoIDs)
	return args.Error(0)
}

func (m *MockService) BulkUpdateCaptions(ctx context.Context, workspaceID uuid.UUID, updates []itemphoto.CaptionUpdate) error {
	args := m.Called(ctx, workspaceID, updates)
	return args.Error(0)
}

func (m *MockService) GetPhotosForDownload(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, itemID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockService) GetPhotosByIDs(ctx context.Context, photoIDs []uuid.UUID, workspaceID uuid.UUID) ([]*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, photoIDs, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*itemphoto.ItemPhoto), args.Error(1)
}

func (m *MockService) CheckDuplicates(ctx context.Context, workspaceID uuid.UUID, hash int64) ([]itemphoto.DuplicateCandidate, error) {
	args := m.Called(ctx, workspaceID, hash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]itemphoto.DuplicateCandidate), args.Error(1)
}

// Helper to create test photo
func createTestPhoto(itemID uuid.UUID) *itemphoto.ItemPhoto {
	return &itemphoto.ItemPhoto{
		ID:            uuid.New(),
		ItemID:        itemID,
		WorkspaceID:   uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		Filename:      "test.jpg",
		StoragePath:   "test/path.jpg",
		ThumbnailPath: "test/thumb.jpg",
		FileSize:      1024,
		MimeType:      itemphoto.MimeTypeJPEG,
		Width:         800,
		Height:        600,
		DisplayOrder:  0,
		IsPrimary:     true,
		Caption:       nil,
		UploadedBy:    uuid.MustParse("00000000-0000-0000-0000-000000000002"),
	}
}

// Tests

func TestPhotoHandler_ListPhotos(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		if isThumbnail {
			return fmt.Sprintf("/workspaces/%s/items/%s/photos/%s/thumbnail", workspaceID, itemID, photoID)
		}
		return fmt.Sprintf("/workspaces/%s/items/%s/photos/%s", workspaceID, itemID, photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("lists photos for item successfully", func(t *testing.T) {
		itemID := uuid.New()
		photo1 := createTestPhoto(itemID)
		photo2 := createTestPhoto(itemID)
		photo2.DisplayOrder = 1
		photo2.IsPrimary = false

		photos := []*itemphoto.ItemPhoto{photo1, photo2}

		mockSvc.On("ListPhotos", mock.Anything, itemID, setup.WorkspaceID).
			Return(photos, nil).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s/photos/list", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when item has no photos", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("ListPhotos", mock.Anything, itemID, setup.WorkspaceID).
			Return([]*itemphoto.ItemPhoto{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s/photos/list", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestPhotoHandler_GetPhoto(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("gets photo by ID successfully", func(t *testing.T) {
		itemID := uuid.New()
		photo := createTestPhoto(itemID)

		mockSvc.On("GetPhoto", mock.Anything, photo.ID).
			Return(photo, nil).Once()

		rec := setup.Get(fmt.Sprintf("/photos/%s", photo.ID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(nil, itemphoto.ErrPhotoNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/photos/%s", photoID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo belongs to different workspace", func(t *testing.T) {
		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = uuid.New() // Different workspace

		mockSvc.On("GetPhoto", mock.Anything, photo.ID).
			Return(photo, nil).Once()

		rec := setup.Get(fmt.Sprintf("/photos/%s", photo.ID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestPhotoHandler_SetPrimary(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("sets photo as primary successfully", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("SetPrimaryPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/primary", photoID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("SetPrimaryPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(itemphoto.ErrPhotoNotFound).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/primary", photoID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 403 when photo not in workspace", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("SetPrimaryPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(itemphoto.ErrUnauthorized).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/primary", photoID), "")

		testutil.AssertStatus(t, rec, http.StatusForbidden)
		mockSvc.AssertExpectations(t)
	})
}

func TestPhotoHandler_UpdateCaption(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("updates caption successfully", func(t *testing.T) {
		photoID := uuid.New()
		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.ID = photoID
		newCaption := "Updated caption"
		photo.Caption = &newCaption

		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, &newCaption).
			Return(nil).Once()
		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(photo, nil).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/caption", photoID), `{"caption":"Updated caption"}`)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("removes caption when set to null", func(t *testing.T) {
		photoID := uuid.New()
		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.ID = photoID
		photo.Caption = nil

		var nilCaption *string = nil
		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, nilCaption).
			Return(nil).Once()
		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(photo, nil).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/caption", photoID), `{"caption":null}`)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestPhotoHandler_ReorderPhotos(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/items/%s/photos/%s", itemID, photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("reorders photos successfully", func(t *testing.T) {
		itemID := uuid.New()
		photo1ID := uuid.New()
		photo2ID := uuid.New()
		photo3ID := uuid.New()
		photoIDs := []uuid.UUID{photo2ID, photo1ID, photo3ID}

		mockSvc.On("ReorderPhotos", mock.Anything, itemID, setup.WorkspaceID, photoIDs).
			Return(nil).Once()

		rec := setup.Put(fmt.Sprintf("/items/%s/photos/order", itemID),
			fmt.Sprintf(`{"photo_ids":["%s","%s","%s"]}`, photo2ID, photo1ID, photo3ID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when photo order is invalid", func(t *testing.T) {
		itemID := uuid.New()
		photoIDs := []uuid.UUID{uuid.New()}

		mockSvc.On("ReorderPhotos", mock.Anything, itemID, setup.WorkspaceID, photoIDs).
			Return(itemphoto.ErrInvalidDisplayOrder).Once()

		rec := setup.Put(fmt.Sprintf("/items/%s/photos/order", itemID),
			fmt.Sprintf(`{"photo_ids":["%s"]}`, photoIDs[0]))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestPhotoHandler_DeletePhoto(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("deletes photo successfully", func(t *testing.T) {
		photoID := uuid.New()
		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.ID = photoID

		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(photo, nil).Once()
		mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/photos/%s", photoID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(nil, itemphoto.ErrPhotoNotFound).Once()
		mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(itemphoto.ErrPhotoNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/photos/%s", photoID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 403 when photo not in workspace", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(nil, itemphoto.ErrUnauthorized).Once()
		mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(itemphoto.ErrUnauthorized).Once()

		rec := setup.Delete(fmt.Sprintf("/photos/%s", photoID))

		testutil.AssertStatus(t, rec, http.StatusForbidden)
		mockSvc.AssertExpectations(t)
	})
}
