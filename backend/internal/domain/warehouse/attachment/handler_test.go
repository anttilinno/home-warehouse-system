package attachment_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements attachment.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) UploadFile(ctx context.Context, input attachment.UploadFileInput) (*attachment.File, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*attachment.File), args.Error(1)
}

func (m *MockService) CreateAttachment(ctx context.Context, input attachment.CreateAttachmentInput) (*attachment.Attachment, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*attachment.Attachment), args.Error(1)
}

func (m *MockService) GetAttachment(ctx context.Context, id uuid.UUID) (*attachment.Attachment, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*attachment.Attachment), args.Error(1)
}

func (m *MockService) ListByItem(ctx context.Context, itemID uuid.UUID) ([]*attachment.Attachment, error) {
	args := m.Called(ctx, itemID)
	return args.Get(0).([]*attachment.Attachment), args.Error(1)
}

func (m *MockService) DeleteAttachment(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockService) SetPrimary(ctx context.Context, itemID, attachmentID uuid.UUID) error {
	args := m.Called(ctx, itemID, attachmentID)
	return args.Error(0)
}

// Tests

func TestAttachmentHandler_ListByItem(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	attachment.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists attachments for item successfully", func(t *testing.T) {
		itemID := uuid.New()
		fileID := uuid.New()
		att1, _ := attachment.NewAttachment(itemID, &fileID, attachment.TypePhoto, nil, false, nil)
		att2, _ := attachment.NewAttachment(itemID, nil, attachment.TypeManual, nil, false, nil)
		attachments := []*attachment.Attachment{att1, att2}

		mockSvc.On("ListByItem", mock.Anything, itemID).
			Return(attachments, nil).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s/attachments", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when item has no attachments", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("ListByItem", mock.Anything, itemID).
			Return([]*attachment.Attachment{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s/attachments", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestAttachmentHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	attachment.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets attachment by ID", func(t *testing.T) {
		itemID := uuid.New()
		fileID := uuid.New()
		testAtt, _ := attachment.NewAttachment(itemID, &fileID, attachment.TypePhoto, nil, false, nil)
		attID := testAtt.ID()

		mockSvc.On("GetAttachment", mock.Anything, attID).
			Return(testAtt, nil).Once()

		rec := setup.Get(fmt.Sprintf("/attachments/%s", attID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when attachment not found", func(t *testing.T) {
		attID := uuid.New()

		mockSvc.On("GetAttachment", mock.Anything, attID).
			Return(nil, attachment.ErrAttachmentNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/attachments/%s", attID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestAttachmentHandler_UploadAttachment(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	attachment.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("uploads attachment successfully", func(t *testing.T) {
		itemID := uuid.New()
		fileID := uuid.New()

		testFile, _ := attachment.NewFile(
			setup.WorkspaceID,
			"test.jpg",
			".jpg",
			"image/jpeg",
			"abc123",
			"storage/key",
			1024,
			&setup.UserID,
		)

		testAtt, _ := attachment.NewAttachment(itemID, &fileID, attachment.TypePhoto, nil, false, nil)

		mockSvc.On("UploadFile", mock.Anything, mock.MatchedBy(func(input attachment.UploadFileInput) bool {
			return input.OriginalName == "test.jpg" && input.MimeType == "image/jpeg"
		})).Return(testFile, nil).Once()

		mockSvc.On("CreateAttachment", mock.Anything, mock.MatchedBy(func(input attachment.CreateAttachmentInput) bool {
			return input.ItemID == itemID && input.AttachmentType == attachment.TypePhoto
		})).Return(testAtt, nil).Once()

		body := `{"file_name":"test.jpg","mime_type":"image/jpeg","size_bytes":1024,"checksum":"abc123","attachment_type":"PHOTO","is_primary":false}`
		rec := setup.Post(fmt.Sprintf("/items/%s/attachments/upload", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid attachment type", func(t *testing.T) {
		itemID := uuid.New()

		body := `{"file_name":"test.jpg","mime_type":"image/jpeg","size_bytes":1024,"checksum":"abc123","attachment_type":"INVALID","is_primary":false}`
		rec := setup.Post(fmt.Sprintf("/items/%s/attachments/upload", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 422 for missing required fields", func(t *testing.T) {
		itemID := uuid.New()

		body := `{"mime_type":"image/jpeg","size_bytes":1024}`
		rec := setup.Post(fmt.Sprintf("/items/%s/attachments/upload", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestAttachmentHandler_CreateAttachment(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	attachment.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("creates attachment without file successfully", func(t *testing.T) {
		itemID := uuid.New()
		testAtt, _ := attachment.NewAttachment(itemID, nil, attachment.TypeManual, nil, false, nil)

		mockSvc.On("CreateAttachment", mock.Anything, mock.MatchedBy(func(input attachment.CreateAttachmentInput) bool {
			return input.ItemID == itemID && input.AttachmentType == attachment.TypeManual && input.FileID == nil
		})).Return(testAtt, nil).Once()

		body := `{"attachment_type":"MANUAL","is_primary":false}`
		rec := setup.Post(fmt.Sprintf("/items/%s/attachments", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("creates attachment with file_id successfully", func(t *testing.T) {
		itemID := uuid.New()
		fileID := uuid.New()
		title := "Receipt"
		testAtt, _ := attachment.NewAttachment(itemID, &fileID, attachment.TypeReceipt, &title, false, nil)

		mockSvc.On("CreateAttachment", mock.Anything, mock.MatchedBy(func(input attachment.CreateAttachmentInput) bool {
			return input.ItemID == itemID && input.FileID != nil && *input.FileID == fileID
		})).Return(testAtt, nil).Once()

		body := fmt.Sprintf(`{"file_id":"%s","attachment_type":"RECEIPT","title":"Receipt","is_primary":false}`, fileID)
		rec := setup.Post(fmt.Sprintf("/items/%s/attachments", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid attachment type", func(t *testing.T) {
		itemID := uuid.New()

		body := `{"attachment_type":"INVALID","is_primary":false}`
		rec := setup.Post(fmt.Sprintf("/items/%s/attachments", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestAttachmentHandler_SetPrimary(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	attachment.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("sets attachment as primary successfully", func(t *testing.T) {
		itemID := uuid.New()
		attID := uuid.New()

		mockSvc.On("SetPrimary", mock.Anything, itemID, attID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/items/%s/attachments/%s/set-primary", itemID, attID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when attachment not found", func(t *testing.T) {
		itemID := uuid.New()
		attID := uuid.New()

		mockSvc.On("SetPrimary", mock.Anything, itemID, attID).
			Return(attachment.ErrAttachmentNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/items/%s/attachments/%s/set-primary", itemID, attID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestAttachmentHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	attachment.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("deletes attachment successfully", func(t *testing.T) {
		attID := uuid.New()

		mockSvc.On("DeleteAttachment", mock.Anything, attID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/attachments/%s", attID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when attachment not found", func(t *testing.T) {
		attID := uuid.New()

		mockSvc.On("DeleteAttachment", mock.Anything, attID).
			Return(attachment.ErrAttachmentNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/attachments/%s", attID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestAttachmentHandler_Create_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	attachment.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	itemID := uuid.New()
	testAtt, _ := attachment.NewAttachment(itemID, nil, attachment.TypeManual, nil, false, nil)

	mockSvc.On("CreateAttachment", mock.Anything, mock.MatchedBy(func(input attachment.CreateAttachmentInput) bool {
		return input.ItemID == itemID && input.AttachmentType == attachment.TypeManual
	})).Return(testAtt, nil).Once()

	body := `{"attachment_type":"MANUAL","is_primary":false}`
	rec := setup.Post(fmt.Sprintf("/items/%s/attachments", itemID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "attachment.created", event.Type)
	assert.Equal(t, "attachment", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, testAtt.ID().String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, testAtt.ID(), event.Data["id"])
	assert.Equal(t, testAtt.ItemID(), event.Data["item_id"])
	assert.Equal(t, "MANUAL", event.Data["attachment_type"])
}

func TestAttachmentHandler_Upload_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	attachment.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	itemID := uuid.New()
	fileID := uuid.New()

	testFile, _ := attachment.NewFile(
		setup.WorkspaceID,
		"test.jpg",
		".jpg",
		"image/jpeg",
		"abc123",
		"storage/key",
		1024,
		&setup.UserID,
	)

	testAtt, _ := attachment.NewAttachment(itemID, &fileID, attachment.TypePhoto, nil, false, nil)

	mockSvc.On("UploadFile", mock.Anything, mock.MatchedBy(func(input attachment.UploadFileInput) bool {
		return input.OriginalName == "test.jpg" && input.MimeType == "image/jpeg"
	})).Return(testFile, nil).Once()

	mockSvc.On("CreateAttachment", mock.Anything, mock.MatchedBy(func(input attachment.CreateAttachmentInput) bool {
		return input.ItemID == itemID && input.AttachmentType == attachment.TypePhoto
	})).Return(testAtt, nil).Once()

	body := `{"file_name":"test.jpg","mime_type":"image/jpeg","size_bytes":1024,"checksum":"abc123","attachment_type":"PHOTO","is_primary":false}`
	rec := setup.Post(fmt.Sprintf("/items/%s/attachments/upload", itemID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "attachment.created", event.Type)
	assert.Equal(t, "attachment", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, testAtt.ID().String(), event.EntityID)
}

func TestAttachmentHandler_SetPrimary_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	attachment.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	itemID := uuid.New()
	attID := uuid.New()

	mockSvc.On("SetPrimary", mock.Anything, itemID, attID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/items/%s/attachments/%s/set-primary", itemID, attID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "attachment.updated", event.Type)
	assert.Equal(t, "attachment", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, attID.String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, attID, event.Data["id"])
	assert.Equal(t, itemID, event.Data["item_id"])
	assert.Equal(t, true, event.Data["is_primary"])
}

func TestAttachmentHandler_Delete_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	attachment.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	attID := uuid.New()

	mockSvc.On("DeleteAttachment", mock.Anything, attID).
		Return(nil).Once()

	rec := setup.Delete(fmt.Sprintf("/attachments/%s", attID))

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "attachment.deleted", event.Type)
	assert.Equal(t, "attachment", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, attID.String(), event.EntityID)
}

func TestAttachmentHandler_Create_NilBroadcaster_NoError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	// Register with nil broadcaster
	attachment.RegisterRoutes(setup.API, mockSvc, nil)

	itemID := uuid.New()
	testAtt, _ := attachment.NewAttachment(itemID, nil, attachment.TypeManual, nil, false, nil)

	mockSvc.On("CreateAttachment", mock.Anything, mock.MatchedBy(func(input attachment.CreateAttachmentInput) bool {
		return input.ItemID == itemID
	})).Return(testAtt, nil).Once()

	body := `{"attachment_type":"MANUAL","is_primary":false}`
	rec := setup.Post(fmt.Sprintf("/items/%s/attachments", itemID), body)

	// Should not panic and should succeed
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}
