package itemphoto_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
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

// MockStorageGetter implements itemphoto.StorageGetter for testing
type MockStorageGetter struct {
	storage *HandlerMockStorage
}

func (m *MockStorageGetter) GetStorage() itemphoto.Storage {
	return m.storage
}

// HandlerMockStorage implements itemphoto.Storage for testing (separate from service_test.go)
type HandlerMockStorage struct {
	mock.Mock
}

func (m *HandlerMockStorage) Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (string, error) {
	args := m.Called(ctx, workspaceID, itemID, filename, reader)
	return args.String(0), args.Error(1)
}

func (m *HandlerMockStorage) Get(ctx context.Context, path string) (io.ReadCloser, error) {
	args := m.Called(ctx, path)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(io.ReadCloser), args.Error(1)
}

func (m *HandlerMockStorage) Delete(ctx context.Context, path string) error {
	args := m.Called(ctx, path)
	return args.Error(0)
}

func (m *HandlerMockStorage) GetURL(ctx context.Context, path string) (string, error) {
	args := m.Called(ctx, path)
	return args.String(0), args.Error(1)
}

func (m *HandlerMockStorage) Exists(ctx context.Context, path string) (bool, error) {
	args := m.Called(ctx, path)
	return args.Bool(0), args.Error(1)
}

// HandlerMockHasher implements itemphoto.Hasher for testing (separate from service_test.go)
type HandlerMockHasher struct {
	mock.Mock
}

func (m *HandlerMockHasher) GenerateHash(ctx context.Context, imagePath string) (int64, error) {
	args := m.Called(ctx, imagePath)
	return args.Get(0).(int64), args.Error(1)
}

func (m *HandlerMockHasher) CompareHashes(hash1, hash2 int64) (bool, int) {
	args := m.Called(hash1, hash2)
	return args.Bool(0), args.Int(1)
}

func (m *HandlerMockHasher) IsSimilar(hash1, hash2 int64) bool {
	args := m.Called(hash1, hash2)
	return args.Bool(0)
}

func (m *HandlerMockHasher) GetDistance(hash1, hash2 int64) int {
	args := m.Called(hash1, hash2)
	return args.Int(0)
}

// createChiRequest creates a request with Chi context and workspace middleware
func createChiRequest(method, path string, body io.Reader, workspaceID, userID uuid.UUID) *http.Request {
	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Content-Type", "application/json")

	// Add workspace and user context using the middleware context keys
	ctx := req.Context()
	ctx = context.WithValue(ctx, appMiddleware.WorkspaceContextKey, workspaceID)
	ctx = context.WithValue(ctx, appMiddleware.UserContextKey, &appMiddleware.AuthUser{ID: userID, FullName: "Test User"})
	ctx = context.WithValue(ctx, appMiddleware.RoleContextKey, "admin")

	return req.WithContext(ctx)
}


func TestBulkPhotoHandler_HandleBulkDelete(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("deletes photos successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photo1ID := uuid.New()
		photo2ID := uuid.New()

		body := fmt.Sprintf(`{"photo_ids":["%s","%s"]}`, photo1ID, photo2ID)
		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/bulk-delete",
			strings.NewReader(body), workspaceID, userID)

		mockSvc.On("BulkDeletePhotos", mock.Anything, itemID, workspaceID, []uuid.UUID{photo1ID, photo2ID}).
			Return(nil).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for empty photo_ids", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		body := `{"photo_ids":[]}`
		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/bulk-delete",
			strings.NewReader(body), workspaceID, userID)

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photoID := uuid.New()
		body := fmt.Sprintf(`{"photo_ids":["%s"]}`, photoID)
		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/bulk-delete",
			strings.NewReader(body), workspaceID, userID)

		mockSvc.On("BulkDeletePhotos", mock.Anything, itemID, workspaceID, []uuid.UUID{photoID}).
			Return(errors.New("database error")).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestBulkPhotoHandler_HandleBulkCaption(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("updates captions successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photoID := uuid.New()
		body := fmt.Sprintf(`{"updates":[{"photo_id":"%s","caption":"New caption"}]}`, photoID)
		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/bulk-caption",
			strings.NewReader(body), workspaceID, userID)

		mockSvc.On("BulkUpdateCaptions", mock.Anything, workspaceID, mock.AnythingOfType("[]itemphoto.CaptionUpdate")).
			Return(nil).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for empty updates", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		body := `{"updates":[]}`
		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/bulk-caption",
			strings.NewReader(body), workspaceID, userID)

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

func TestBulkPhotoHandler_HandleDownload(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("downloads all photos as zip", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = workspaceID

		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/download",
			nil, workspaceID, userID)

		mockSvc.On("GetPhotosForDownload", mock.Anything, itemID, workspaceID).
			Return([]*itemphoto.ItemPhoto{photo}, nil).Once()
		mockStorage.On("Get", mock.Anything, photo.StoragePath).
			Return(io.NopCloser(strings.NewReader("fake image data")), nil).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "application/zip", rr.Header().Get("Content-Type"))
		mockSvc.AssertExpectations(t)
		mockStorage.AssertExpectations(t)
	})

	t.Run("returns 404 when no photos found", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/download",
			nil, workspaceID, userID)

		mockSvc.On("GetPhotosForDownload", mock.Anything, itemID, workspaceID).
			Return([]*itemphoto.ItemPhoto{}, nil).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("downloads selected photos by IDs", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = workspaceID

		req := createChiRequest("GET",
			"/items/"+itemID.String()+"/photos/download?ids="+photo.ID.String(),
			nil, workspaceID, userID)

		mockSvc.On("GetPhotosByIDs", mock.Anything, []uuid.UUID{photo.ID}, workspaceID).
			Return([]*itemphoto.ItemPhoto{photo}, nil).Once()
		mockStorage.On("Get", mock.Anything, photo.StoragePath).
			Return(io.NopCloser(strings.NewReader("fake image data")), nil).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestBulkPhotoHandler_HandleCheckDuplicate(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s/thumbnail", photoID)
	}

	t.Run("returns empty when hasher is nil", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()

		// Create multipart form
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("photo", "test.jpg")
		part.Write([]byte("fake jpeg"))
		writer.Close()

		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/check-duplicate",
			body, workspaceID, userID)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req) // nil hasher

		assert.Equal(t, http.StatusOK, rr.Code)
		var result map[string]interface{}
		json.Unmarshal(rr.Body.Bytes(), &result)
		assert.Equal(t, false, result["has_duplicates"])
	})
}

func TestServePhotoHandler_HandleServe(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	t.Run("serves photo successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = workspaceID

		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/"+photo.ID.String(),
			nil, workspaceID, userID)

		mockSvc.On("GetPhoto", mock.Anything, photo.ID).Return(photo, nil).Once()
		mockStorage.On("Get", mock.Anything, photo.StoragePath).
			Return(io.NopCloser(strings.NewReader("fake image data")), nil).Once()

		rr := executeServeHandlerRequest(t, mockSvc, storageGetter, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "image/jpeg", rr.Header().Get("Content-Type"))
		mockSvc.AssertExpectations(t)
		mockStorage.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photoID := uuid.New()

		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/"+photoID.String(),
			nil, workspaceID, userID)

		mockSvc.On("GetPhoto", mock.Anything, photoID).Return(nil, itemphoto.ErrPhotoNotFound).Once()

		rr := executeServeHandlerRequest(t, mockSvc, storageGetter, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo belongs to different workspace", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = uuid.New() // Different workspace

		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/"+photo.ID.String(),
			nil, workspaceID, userID)

		mockSvc.On("GetPhoto", mock.Anything, photo.ID).Return(photo, nil).Once()

		rr := executeServeHandlerRequest(t, mockSvc, storageGetter, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestServePhotoHandler_HandleServeThumbnail(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	t.Run("serves thumbnail successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = workspaceID

		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/"+photo.ID.String()+"/thumbnail",
			nil, workspaceID, userID)

		mockSvc.On("GetPhoto", mock.Anything, photo.ID).Return(photo, nil).Once()
		mockStorage.On("Get", mock.Anything, photo.ThumbnailPath).
			Return(io.NopCloser(strings.NewReader("fake thumbnail data")), nil).Once()

		rr := executeServeHandlerRequest(t, mockSvc, storageGetter, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		mockSvc.AssertExpectations(t)
		mockStorage.AssertExpectations(t)
	})
}

func TestUploadHandler_HandleUpload(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("uploads photo successfully", func(t *testing.T) {
		mockSvc := new(MockService)

		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = workspaceID

		// Create multipart form
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("photo", "test.jpg")
		part.Write([]byte("fake jpeg content"))
		writer.Close()

		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos",
			body, workspaceID, userID)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		mockSvc.On("UploadPhoto", mock.Anything, itemID, workspaceID, userID, mock.Anything, mock.Anything, mock.Anything).
			Return(photo, nil).Once()

		rr := executeUploadHandlerRequest(t, mockSvc, urlGen, req)

		assert.Equal(t, http.StatusCreated, rr.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for missing photo file", func(t *testing.T) {
		mockSvc := new(MockService)

		itemID := uuid.New()

		// Create multipart form without photo
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		writer.WriteField("caption", "test")
		writer.Close()

		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos",
			body, workspaceID, userID)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		rr := executeUploadHandlerRequest(t, mockSvc, urlGen, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("returns 413 for file too large", func(t *testing.T) {
		mockSvc := new(MockService)

		itemID := uuid.New()

		// Create multipart form
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("photo", "test.jpg")
		part.Write([]byte("fake jpeg"))
		writer.Close()

		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos",
			body, workspaceID, userID)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		mockSvc.On("UploadPhoto", mock.Anything, itemID, workspaceID, userID, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, itemphoto.ErrFileTooLarge).Once()

		rr := executeUploadHandlerRequest(t, mockSvc, urlGen, req)

		assert.Equal(t, http.StatusRequestEntityTooLarge, rr.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid file type", func(t *testing.T) {
		mockSvc := new(MockService)

		itemID := uuid.New()

		// Create multipart form
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("photo", "test.gif")
		part.Write([]byte("fake gif"))
		writer.Close()

		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos",
			body, workspaceID, userID)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		mockSvc.On("UploadPhoto", mock.Anything, itemID, workspaceID, userID, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, itemphoto.ErrInvalidFileType).Once()

		rr := executeUploadHandlerRequest(t, mockSvc, urlGen, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
		mockSvc.AssertExpectations(t)
	})
}

// Helper to create router with bulk handlers and execute request
func executeBulkHandlerRequest(t *testing.T, svc itemphoto.ServiceInterface, storageGetter itemphoto.StorageGetter, hasher itemphoto.Hasher, urlGen itemphoto.PhotoURLGenerator, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	r := chi.NewRouter()
	itemphoto.RegisterBulkHandler(r, svc, storageGetter, hasher, nil, urlGen)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

// Helper to create router with serve handlers and execute request
func executeServeHandlerRequest(t *testing.T, svc itemphoto.ServiceInterface, storageGetter itemphoto.StorageGetter, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	r := chi.NewRouter()
	itemphoto.RegisterServeHandler(r, svc, storageGetter)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

// Helper to create router with upload handler and execute request
func executeUploadHandlerRequest(t *testing.T, svc itemphoto.ServiceInterface, urlGen itemphoto.PhotoURLGenerator, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	r := chi.NewRouter()
	itemphoto.RegisterUploadHandler(r, svc, nil, urlGen)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func TestHandler_ListPhotos_ServerError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("returns 500 on service error", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("ListPhotos", mock.Anything, itemID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s/photos/list", itemID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_GetPhoto_ServerError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("returns 500 on service error", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/photos/%s", photoID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_SetPrimary_ServerError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("returns 500 on service error", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("SetPrimaryPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(errors.New("database error")).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/primary", photoID), "")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_UpdateCaption_Errors(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("returns 404 when photo not found", func(t *testing.T) {
		photoID := uuid.New()
		caption := "Test"

		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, &caption).
			Return(itemphoto.ErrPhotoNotFound).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/caption", photoID), `{"caption":"Test"}`)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 403 when unauthorized", func(t *testing.T) {
		photoID := uuid.New()
		caption := "Test"

		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, &caption).
			Return(itemphoto.ErrUnauthorized).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/caption", photoID), `{"caption":"Test"}`)

		testutil.AssertStatus(t, rec, http.StatusForbidden)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		photoID := uuid.New()
		caption := "Test"

		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, &caption).
			Return(errors.New("database error")).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/caption", photoID), `{"caption":"Test"}`)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_ReorderPhotos_ServerError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("returns 500 on service error", func(t *testing.T) {
		itemID := uuid.New()
		photoID := uuid.New()

		mockSvc.On("ReorderPhotos", mock.Anything, itemID, setup.WorkspaceID, []uuid.UUID{photoID}).
			Return(errors.New("database error")).Once()

		rec := setup.Put(fmt.Sprintf("/items/%s/photos/order", itemID),
			fmt.Sprintf(`{"photo_ids":["%s"]}`, photoID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_DeletePhoto_ServerError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("returns 500 on service error", func(t *testing.T) {
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(nil, nil).Once()
		mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/photos/%s", photoID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_GetUpdatedPhoto_Error(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)

	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	itemphoto.RegisterRoutes(setup.API, mockSvc, nil, urlGen)

	t.Run("returns 500 when GetPhoto fails after UpdateCaption", func(t *testing.T) {
		photoID := uuid.New()
		caption := "Test"

		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, &caption).
			Return(nil).Once()
		mockSvc.On("GetPhoto", mock.Anything, photoID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Put(fmt.Sprintf("/photos/%s/caption", photoID), `{"caption":"Test"}`)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestEntity_GetMediumThumbnail_WithValue(t *testing.T) {
	t.Run("returns medium path when set", func(t *testing.T) {
		mediumPath := "path/to/medium.jpg"
		photo := &itemphoto.ItemPhoto{
			ThumbnailMediumPath: &mediumPath,
		}
		require.Equal(t, mediumPath, photo.GetMediumThumbnail())
	})
}

func TestEntity_GetLargeThumbnail_WithValue(t *testing.T) {
	t.Run("returns large path when set", func(t *testing.T) {
		largePath := "path/to/large.jpg"
		photo := &itemphoto.ItemPhoto{
			ThumbnailLargePath: &largePath,
		}
		require.Equal(t, largePath, photo.GetLargeThumbnail())
	})
}

func TestUploadHandler_HandleUpload_GenericError(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("returns 500 for generic error", func(t *testing.T) {
		mockSvc := new(MockService)

		itemID := uuid.New()

		// Create multipart form
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, _ := writer.CreateFormFile("photo", "test.jpg")
		part.Write([]byte("fake jpeg"))
		writer.Close()

		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos",
			body, workspaceID, userID)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		mockSvc.On("UploadPhoto", mock.Anything, itemID, workspaceID, userID, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, errors.New("database error")).Once()

		rr := executeUploadHandlerRequest(t, mockSvc, urlGen, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestServePhoto_StorageError(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	t.Run("returns 404 when storage file not found", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = workspaceID

		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/"+photo.ID.String(),
			nil, workspaceID, userID)

		mockSvc.On("GetPhoto", mock.Anything, photo.ID).Return(photo, nil).Once()
		mockStorage.On("Get", mock.Anything, photo.StoragePath).
			Return(nil, errors.New("file not found")).Once()

		rr := executeServeHandlerRequest(t, mockSvc, storageGetter, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		mockSvc.AssertExpectations(t)
		mockStorage.AssertExpectations(t)
	})
}

func TestServePhoto_ServiceError(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	t.Run("returns 500 when service fails", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photoID := uuid.New()

		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/"+photoID.String(),
			nil, workspaceID, userID)

		mockSvc.On("GetPhoto", mock.Anything, photoID).Return(nil, errors.New("database error")).Once()

		rr := executeServeHandlerRequest(t, mockSvc, storageGetter, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestServePhoto_EmptyMimeType(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	t.Run("detects mime type from extension when not set", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photo := createTestPhoto(itemID)
		photo.WorkspaceID = workspaceID
		photo.MimeType = "" // Empty mime type
		photo.Filename = "test.jpg"

		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/"+photo.ID.String(),
			nil, workspaceID, userID)

		mockSvc.On("GetPhoto", mock.Anything, photo.ID).Return(photo, nil).Once()
		mockStorage.On("Get", mock.Anything, photo.StoragePath).
			Return(io.NopCloser(strings.NewReader("fake image data")), nil).Once()

		rr := executeServeHandlerRequest(t, mockSvc, storageGetter, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		// Should have detected the mime type from extension
		mockSvc.AssertExpectations(t)
		mockStorage.AssertExpectations(t)
	})
}

func TestBulkHandler_InvalidItemID(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("bulk delete returns 400 for invalid item_id", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		req := createChiRequest("POST", "/items/invalid-uuid/photos/bulk-delete",
			strings.NewReader(`{"photo_ids":["123"]}`), workspaceID, userID)

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		// Chi parses the route param, then the handler returns 400 for invalid UUID
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

func TestBulkHandler_ServiceErrors(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("bulk caption returns 500 on service error", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photoID := uuid.New()
		body := fmt.Sprintf(`{"updates":[{"photo_id":"%s","caption":"Test"}]}`, photoID)
		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/bulk-caption",
			strings.NewReader(body), workspaceID, userID)

		mockSvc.On("BulkUpdateCaptions", mock.Anything, workspaceID, mock.AnythingOfType("[]itemphoto.CaptionUpdate")).
			Return(errors.New("database error")).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("download returns 500 on service error", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/download",
			nil, workspaceID, userID)

		mockSvc.On("GetPhotosForDownload", mock.Anything, itemID, workspaceID).
			Return(nil, errors.New("database error")).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestBulkHandler_InvalidBody(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("bulk delete returns 400 for invalid JSON", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/bulk-delete",
			strings.NewReader(`{invalid json`), workspaceID, userID)

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("bulk caption returns 400 for invalid JSON", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		req := createChiRequest("POST", "/items/"+itemID.String()+"/photos/bulk-caption",
			strings.NewReader(`{invalid json`), workspaceID, userID)

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

func TestBulkDownload_InvalidPhotoID(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("returns 400 for invalid photo ID in ids param", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/download?ids=invalid-uuid",
			nil, workspaceID, userID)

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

func TestBulkDownload_GetPhotosByIDsError(t *testing.T) {
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	urlGen := func(wsID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("/photos/%s", photoID)
	}

	t.Run("returns 500 when GetPhotosByIDs fails", func(t *testing.T) {
		mockSvc := new(MockService)
		mockStorage := new(HandlerMockStorage)
		storageGetter := &MockStorageGetter{storage: mockStorage}

		itemID := uuid.New()
		photoID := uuid.New()
		req := createChiRequest("GET", "/items/"+itemID.String()+"/photos/download?ids="+photoID.String(),
			nil, workspaceID, userID)

		mockSvc.On("GetPhotosByIDs", mock.Anything, []uuid.UUID{photoID}, workspaceID).
			Return(nil, errors.New("database error")).Once()

		rr := executeBulkHandlerRequest(t, mockSvc, storageGetter, nil, urlGen, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		mockSvc.AssertExpectations(t)
	})
}
