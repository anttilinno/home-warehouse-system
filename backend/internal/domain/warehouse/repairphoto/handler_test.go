package repairphoto_test

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairphoto"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements repairphoto.ServiceInterface for testing
type MockService struct {
	mock.Mock
}

func (m *MockService) UploadPhoto(ctx context.Context, repairLogID, workspaceID, userID uuid.UUID, photoType repairphoto.PhotoType, file multipart.File, header *multipart.FileHeader, caption *string) (*repairphoto.RepairPhoto, error) {
	args := m.Called(ctx, repairLogID, workspaceID, userID, photoType, file, header, caption)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairphoto.RepairPhoto), args.Error(1)
}

func (m *MockService) ListPhotos(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*repairphoto.RepairPhoto, error) {
	args := m.Called(ctx, repairLogID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*repairphoto.RepairPhoto), args.Error(1)
}

func (m *MockService) GetPhoto(ctx context.Context, id, workspaceID uuid.UUID) (*repairphoto.RepairPhoto, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairphoto.RepairPhoto), args.Error(1)
}

func (m *MockService) UpdateCaption(ctx context.Context, photoID, workspaceID uuid.UUID, caption *string) (*repairphoto.RepairPhoto, error) {
	args := m.Called(ctx, photoID, workspaceID, caption)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairphoto.RepairPhoto), args.Error(1)
}

func (m *MockService) DeletePhoto(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

// Helper function to create a test repair photo
func newTestRepairPhoto(workspaceID, repairLogID uuid.UUID, photoType repairphoto.PhotoType) *repairphoto.RepairPhoto {
	now := time.Now()
	return repairphoto.Reconstruct(
		uuid.New(),
		repairLogID,
		workspaceID,
		photoType,
		"test-photo.jpg",
		"storage/path/test-photo.jpg",
		"storage/path/thumb_test-photo.jpg",
		"image/jpeg",
		1024*100, // 100KB
		800,
		600,
		1,
		nil,
		uuid.New(), // uploadedBy
		now,
		now,
	)
}

// testURLGenerator is a simple URL generator for testing
func testURLGenerator(workspaceID, repairLogID, photoID uuid.UUID, isThumbnail bool) string {
	if isThumbnail {
		return fmt.Sprintf("http://test/repairs/%s/photos/%s/thumbnail", repairLogID, photoID)
	}
	return fmt.Sprintf("http://test/repairs/%s/photos/%s/file", repairLogID, photoID)
}

// Tests for ListPhotos endpoint

func TestHandler_ListPhotos(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairphoto.RegisterRoutes(setup.API, mockSvc, nil, testURLGenerator)

	t.Run("lists photos successfully", func(t *testing.T) {
		repairLogID := uuid.New()
		photo1 := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photo2 := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeDuring)
		photos := []*repairphoto.RepairPhoto{photo1, photo2}

		mockSvc.On("ListPhotos", mock.Anything, repairLogID, setup.WorkspaceID).
			Return(photos, nil).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/photos/list", repairLogID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no photos", func(t *testing.T) {
		repairLogID := uuid.New()

		mockSvc.On("ListPhotos", mock.Anything, repairLogID, setup.WorkspaceID).
			Return([]*repairphoto.RepairPhoto{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/photos/list", repairLogID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		repairLogID := uuid.New()

		mockSvc.On("ListPhotos", mock.Anything, repairLogID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/photos/list", repairLogID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for GetPhoto endpoint

func TestHandler_GetPhoto(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairphoto.RegisterRoutes(setup.API, mockSvc, nil, testURLGenerator)

	t.Run("gets photo by ID", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found", func(t *testing.T) {
		repairLogID := uuid.New()
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil, repairphoto.ErrPhotoNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo belongs to different repair log", func(t *testing.T) {
		repairLogID := uuid.New()
		differentRepairLogID := uuid.New()
		// Photo exists but belongs to a different repair log
		photo := newTestRepairPhoto(setup.WorkspaceID, differentRepairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on unexpected error", func(t *testing.T) {
		repairLogID := uuid.New()
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for UpdateCaption endpoint

func TestHandler_UpdateCaption(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairphoto.RegisterRoutes(setup.API, mockSvc, nil, testURLGenerator)

	t.Run("updates caption successfully", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID
		caption := "New caption"
		updatedPhoto := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		updatedPhoto.Caption = &caption

		// First call to verify photo exists
		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		// Second call for update
		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, mock.MatchedBy(func(c *string) bool {
			return c != nil && *c == "New caption"
		})).Return(updatedPhoto, nil).Once()

		body := `{"caption":"New caption"}`
		rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("clears caption with null", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, (*string)(nil)).
			Return(photo, nil).Once()

		body := `{"caption":null}`
		rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found on get", func(t *testing.T) {
		repairLogID := uuid.New()
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil, repairphoto.ErrPhotoNotFound).Once()

		body := `{"caption":"Test"}`
		rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo belongs to different repair log", func(t *testing.T) {
		repairLogID := uuid.New()
		differentRepairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, differentRepairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()

		body := `{"caption":"Test"}`
		rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found on update", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, mock.Anything).
			Return(nil, repairphoto.ErrPhotoNotFound).Once()

		body := `{"caption":"Test"}`
		rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error during get", func(t *testing.T) {
		repairLogID := uuid.New()
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		body := `{"caption":"Test"}`
		rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error during update", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, mock.Anything).
			Return(nil, errors.New("database error")).Once()

		body := `{"caption":"Test"}`
		rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for DeletePhoto endpoint

func TestHandler_DeletePhoto(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairphoto.RegisterRoutes(setup.API, mockSvc, nil, testURLGenerator)

	t.Run("deletes photo successfully", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		// Delete returns nil body, huma returns 204 or 200 depending on config
		assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found on get", func(t *testing.T) {
		repairLogID := uuid.New()
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil, repairphoto.ErrPhotoNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo belongs to different repair log", func(t *testing.T) {
		repairLogID := uuid.New()
		differentRepairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, differentRepairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when photo not found on delete", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(repairphoto.ErrPhotoNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error during get", func(t *testing.T) {
		repairLogID := uuid.New()
		photoID := uuid.New()

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error during delete", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestHandler_UpdateCaption_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairphoto.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), testURLGenerator)

	repairLogID := uuid.New()
	photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
	photoID := photo.ID
	caption := "Updated caption"
	updatedPhoto := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
	updatedPhoto.Caption = &caption

	mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
		Return(photo, nil).Once()
	mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, mock.Anything).
		Return(updatedPhoto, nil).Once()

	body := `{"caption":"Updated caption"}`
	rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repair_photo.updated", event.Type)
	assert.Equal(t, "repair_photo", event.EntityType)
	assert.Equal(t, photoID.String(), event.EntityID)
}

func TestHandler_DeletePhoto_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairphoto.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), testURLGenerator)

	repairLogID := uuid.New()
	photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
	photoID := photo.ID

	mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
		Return(photo, nil).Once()
	mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Delete(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

	assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repair_photo.deleted", event.Type)
	assert.Equal(t, "repair_photo", event.EntityType)
	assert.Equal(t, photoID.String(), event.EntityID)
}

func TestHandler_NilBroadcaster_NoPanic(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairphoto.RegisterRoutes(setup.API, mockSvc, nil, testURLGenerator) // nil broadcaster

	t.Run("UpdateCaption with nil broadcaster does not panic", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		mockSvc.On("UpdateCaption", mock.Anything, photoID, setup.WorkspaceID, mock.Anything).
			Return(photo, nil).Once()

		body := `{"caption":"Test"}`
		rec := setup.Put(fmt.Sprintf("/repairs/%s/photos/%s/caption", repairLogID, photoID), body)

		// Should work without error even with nil broadcaster
		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("DeletePhoto with nil broadcaster does not panic", func(t *testing.T) {
		repairLogID := uuid.New()
		photo := newTestRepairPhoto(setup.WorkspaceID, repairLogID, repairphoto.PhotoTypeBefore)
		photoID := photo.ID

		mockSvc.On("GetPhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(photo, nil).Once()
		mockSvc.On("DeletePhoto", mock.Anything, photoID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/photos/%s", repairLogID, photoID))

		// Should work without error even with nil broadcaster
		assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})
}
