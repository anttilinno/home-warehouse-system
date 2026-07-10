package repairattachment_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairattachment"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockRepository implements repairattachment.Repository for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Create(ctx context.Context, ra *repairattachment.RepairAttachment) error {
	args := m.Called(ctx, ra)
	return args.Error(0)
}

func (m *MockRepository) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*repairattachment.RepairAttachment, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairattachment.RepairAttachment), args.Error(1)
}

func (m *MockRepository) ListByRepairLog(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*repairattachment.RepairAttachmentWithFile, error) {
	args := m.Called(ctx, repairLogID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*repairattachment.RepairAttachmentWithFile), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

// MockFileVerifier implements repairattachment.FileVerifier for testing
type MockFileVerifier struct {
	mock.Mock
}

func (m *MockFileVerifier) GetFileByID(ctx context.Context, fileID, workspaceID uuid.UUID) (*attachment.File, error) {
	args := m.Called(ctx, fileID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*attachment.File), args.Error(1)
}

// Helper function to create a test repair attachment
func newTestRepairAttachment(workspaceID, repairLogID, fileID uuid.UUID) *repairattachment.RepairAttachment {
	now := time.Now()
	return repairattachment.Reconstruct(
		uuid.New(),
		repairLogID,
		workspaceID,
		fileID,
		attachment.TypePhoto,
		nil,
		now,
		now,
	)
}

func newTestRepairAttachmentWithFile(workspaceID, repairLogID, fileID uuid.UUID) *repairattachment.RepairAttachmentWithFile {
	now := time.Now()
	return repairattachment.ReconstructWithFile(
		uuid.New(),
		repairLogID,
		workspaceID,
		fileID,
		attachment.TypePhoto,
		nil,
		now,
		now,
		"test-file.jpg",
		nil,
		nil,
		nil,
	)
}

func newTestFile(workspaceID uuid.UUID) *attachment.File {
	return attachment.ReconstructFile(
		uuid.New(),
		workspaceID,
		"test-file.jpg",
		"jpg",
		"image/jpeg",
		"checksum",
		"storage/key",
		1024,
		nil,
		time.Now(),
		time.Now(),
	)
}

// Tests for ListAttachments endpoint

func TestHandler_ListAttachments(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	svc := repairattachment.NewService(mockRepo, nil)
	repairattachment.RegisterRoutes(setup.API, svc, nil)

	t.Run("lists attachments successfully", func(t *testing.T) {
		repairLogID := uuid.New()
		a1 := newTestRepairAttachmentWithFile(setup.WorkspaceID, repairLogID, uuid.New())
		a2 := newTestRepairAttachmentWithFile(setup.WorkspaceID, repairLogID, uuid.New())
		attachments := []*repairattachment.RepairAttachmentWithFile{a1, a2}

		mockRepo.On("ListByRepairLog", mock.Anything, repairLogID, setup.WorkspaceID).
			Return(attachments, nil).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/attachments", repairLogID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns empty list when no attachments", func(t *testing.T) {
		repairLogID := uuid.New()

		mockRepo.On("ListByRepairLog", mock.Anything, repairLogID, setup.WorkspaceID).
			Return([]*repairattachment.RepairAttachmentWithFile{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/attachments", repairLogID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on repository error", func(t *testing.T) {
		repairLogID := uuid.New()

		mockRepo.On("ListByRepairLog", mock.Anything, repairLogID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s/attachments", repairLogID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})
}

// Tests for CreateAttachment endpoint

func TestHandler_CreateAttachment(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	mockVerifier := new(MockFileVerifier)
	svc := repairattachment.NewService(mockRepo, mockVerifier)
	repairattachment.RegisterRoutes(setup.API, svc, nil)

	t.Run("creates attachment successfully", func(t *testing.T) {
		repairLogID := uuid.New()
		fileID := uuid.New()
		file := newTestFile(setup.WorkspaceID)

		mockVerifier.On("GetFileByID", mock.Anything, fileID, setup.WorkspaceID).
			Return(file, nil).Once()
		mockRepo.On("Create", mock.Anything, mock.MatchedBy(func(ra *repairattachment.RepairAttachment) bool {
			return ra.RepairLogID() == repairLogID && ra.FileID() == fileID
		})).Return(nil).Once()

		body := fmt.Sprintf(`{"file_id":"%s","attachment_type":"PHOTO"}`, fileID)
		rec := setup.Post(fmt.Sprintf("/repairs/%s/attachments", repairLogID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockVerifier.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 400 on invalid attachment type", func(t *testing.T) {
		repairLogID := uuid.New()
		fileID := uuid.New()

		body := fmt.Sprintf(`{"file_id":"%s","attachment_type":"BOGUS"}`, fileID)
		rec := setup.Post(fmt.Sprintf("/repairs/%s/attachments", repairLogID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns 404 when file not found", func(t *testing.T) {
		repairLogID := uuid.New()
		fileID := uuid.New()

		mockVerifier.On("GetFileByID", mock.Anything, fileID, setup.WorkspaceID).
			Return(nil, repairattachment.ErrFileNotFound).Once()

		body := fmt.Sprintf(`{"file_id":"%s","attachment_type":"PHOTO"}`, fileID)
		rec := setup.Post(fmt.Sprintf("/repairs/%s/attachments", repairLogID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockVerifier.AssertExpectations(t)
	})

	t.Run("returns 400 when file belongs to different workspace", func(t *testing.T) {
		repairLogID := uuid.New()
		fileID := uuid.New()
		file := newTestFile(uuid.New()) // different workspace

		mockVerifier.On("GetFileByID", mock.Anything, fileID, setup.WorkspaceID).
			Return(file, nil).Once()

		body := fmt.Sprintf(`{"file_id":"%s","attachment_type":"PHOTO"}`, fileID)
		rec := setup.Post(fmt.Sprintf("/repairs/%s/attachments", repairLogID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockVerifier.AssertExpectations(t)
	})

	t.Run("returns 500 on repository create error", func(t *testing.T) {
		repairLogID := uuid.New()
		fileID := uuid.New()
		file := newTestFile(setup.WorkspaceID)

		mockVerifier.On("GetFileByID", mock.Anything, fileID, setup.WorkspaceID).
			Return(file, nil).Once()
		mockRepo.On("Create", mock.Anything, mock.Anything).
			Return(errors.New("database error")).Once()

		body := fmt.Sprintf(`{"file_id":"%s","attachment_type":"PHOTO"}`, fileID)
		rec := setup.Post(fmt.Sprintf("/repairs/%s/attachments", repairLogID), body)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockVerifier.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})
}

// Tests for DeleteAttachment endpoint

func TestHandler_DeleteAttachment(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	svc := repairattachment.NewService(mockRepo, nil)
	repairattachment.RegisterRoutes(setup.API, svc, nil)

	t.Run("deletes attachment successfully", func(t *testing.T) {
		repairLogID := uuid.New()
		ra := newTestRepairAttachment(setup.WorkspaceID, repairLogID, uuid.New())

		mockRepo.On("GetByID", mock.Anything, ra.ID(), setup.WorkspaceID).
			Return(ra, nil).Once()
		mockRepo.On("Delete", mock.Anything, ra.ID(), setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/attachments/%s", repairLogID, ra.ID()))

		assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusNoContent)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 404 when attachment not found on get", func(t *testing.T) {
		repairLogID := uuid.New()
		attachmentID := uuid.New()

		mockRepo.On("GetByID", mock.Anything, attachmentID, setup.WorkspaceID).
			Return(nil, shared.ErrNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/attachments/%s", repairLogID, attachmentID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 when get fails unexpectedly", func(t *testing.T) {
		repairLogID := uuid.New()
		attachmentID := uuid.New()

		mockRepo.On("GetByID", mock.Anything, attachmentID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/attachments/%s", repairLogID, attachmentID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 404 when attachment not found on delete", func(t *testing.T) {
		repairLogID := uuid.New()
		ra := newTestRepairAttachment(setup.WorkspaceID, repairLogID, uuid.New())

		mockRepo.On("GetByID", mock.Anything, ra.ID(), setup.WorkspaceID).
			Return(ra, nil).Once()
		mockRepo.On("Delete", mock.Anything, ra.ID(), setup.WorkspaceID).
			Return(repairattachment.ErrRepairAttachmentNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/attachments/%s", repairLogID, ra.ID()))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on repository error during delete", func(t *testing.T) {
		repairLogID := uuid.New()
		ra := newTestRepairAttachment(setup.WorkspaceID, repairLogID, uuid.New())

		mockRepo.On("GetByID", mock.Anything, ra.ID(), setup.WorkspaceID).
			Return(ra, nil).Once()
		mockRepo.On("Delete", mock.Anything, ra.ID(), setup.WorkspaceID).
			Return(errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/attachments/%s", repairLogID, ra.ID()))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestHandler_CreateAttachment_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	mockVerifier := new(MockFileVerifier)
	svc := repairattachment.NewService(mockRepo, mockVerifier)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairattachment.RegisterRoutes(setup.API, svc, capture.GetBroadcaster())

	repairLogID := uuid.New()
	fileID := uuid.New()
	file := newTestFile(setup.WorkspaceID)

	mockVerifier.On("GetFileByID", mock.Anything, fileID, setup.WorkspaceID).
		Return(file, nil).Once()
	mockRepo.On("Create", mock.Anything, mock.Anything).
		Return(nil).Once()

	body := fmt.Sprintf(`{"file_id":"%s","attachment_type":"PHOTO"}`, fileID)
	rec := setup.Post(fmt.Sprintf("/repairs/%s/attachments", repairLogID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockVerifier.AssertExpectations(t)
	mockRepo.AssertExpectations(t)

	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repairattachment.created", event.Type)
	assert.Equal(t, "repairattachment", event.EntityType)
}

func TestHandler_DeleteAttachment_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	svc := repairattachment.NewService(mockRepo, nil)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairattachment.RegisterRoutes(setup.API, svc, capture.GetBroadcaster())

	repairLogID := uuid.New()
	ra := newTestRepairAttachment(setup.WorkspaceID, repairLogID, uuid.New())

	mockRepo.On("GetByID", mock.Anything, ra.ID(), setup.WorkspaceID).
		Return(ra, nil).Once()
	mockRepo.On("Delete", mock.Anything, ra.ID(), setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Delete(fmt.Sprintf("/repairs/%s/attachments/%s", repairLogID, ra.ID()))

	assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusNoContent)
	mockRepo.AssertExpectations(t)

	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repairattachment.deleted", event.Type)
	assert.Equal(t, "repairattachment", event.EntityType)
	assert.Equal(t, ra.ID().String(), event.EntityID)
}

func TestHandler_NilBroadcaster_NoPanic(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	mockVerifier := new(MockFileVerifier)
	svc := repairattachment.NewService(mockRepo, mockVerifier)
	repairattachment.RegisterRoutes(setup.API, svc, nil) // nil broadcaster

	t.Run("CreateAttachment with nil broadcaster does not panic", func(t *testing.T) {
		repairLogID := uuid.New()
		fileID := uuid.New()
		file := newTestFile(setup.WorkspaceID)

		mockVerifier.On("GetFileByID", mock.Anything, fileID, setup.WorkspaceID).
			Return(file, nil).Once()
		mockRepo.On("Create", mock.Anything, mock.Anything).
			Return(nil).Once()

		body := fmt.Sprintf(`{"file_id":"%s","attachment_type":"PHOTO"}`, fileID)
		rec := setup.Post(fmt.Sprintf("/repairs/%s/attachments", repairLogID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockVerifier.AssertExpectations(t)
		mockRepo.AssertExpectations(t)
	})

	t.Run("DeleteAttachment with nil broadcaster does not panic", func(t *testing.T) {
		repairLogID := uuid.New()
		ra := newTestRepairAttachment(setup.WorkspaceID, repairLogID, uuid.New())

		mockRepo.On("GetByID", mock.Anything, ra.ID(), setup.WorkspaceID).
			Return(ra, nil).Once()
		mockRepo.On("Delete", mock.Anything, ra.ID(), setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s/attachments/%s", repairLogID, ra.ID()))

		assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusNoContent)
		mockRepo.AssertExpectations(t)
	})
}
