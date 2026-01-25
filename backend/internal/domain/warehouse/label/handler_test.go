package label_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements label.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input label.CreateInput) (*label.Label, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*label.Label), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*label.Label, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*label.Label), args.Error(1)
}

func (m *MockService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*label.Label, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).([]*label.Label), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input label.UpdateInput) (*label.Label, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*label.Label), args.Error(1)
}

func (m *MockService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

// Tests

func TestLabelHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	label.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("creates label successfully", func(t *testing.T) {
		color := "#FF5733"
		testLabel, _ := label.NewLabel(setup.WorkspaceID, "Important", &color, nil)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input label.CreateInput) bool {
			return input.Name == "Important" && input.Color != nil && *input.Color == "#FF5733"
		})).Return(testLabel, nil).Once()

		body := `{"name":"Important","color":"#FF5733"}`
		rec := setup.Post("/labels", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("creates label without color", func(t *testing.T) {
		testLabel, _ := label.NewLabel(setup.WorkspaceID, "Plain", nil, nil)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input label.CreateInput) bool {
			return input.Name == "Plain" && input.Color == nil
		})).Return(testLabel, nil).Once()

		body := `{"name":"Plain"}`
		rec := setup.Post("/labels", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for duplicate name", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, label.ErrNameTaken).Once()

		body := `{"name":"Duplicate"}`
		rec := setup.Post("/labels", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid color format", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		body := `{"name":"Test","color":"invalid"}`
		rec := setup.Post("/labels", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestLabelHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	label.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists labels successfully", func(t *testing.T) {
		label1, _ := label.NewLabel(setup.WorkspaceID, "Label 1", nil, nil)
		label2, _ := label.NewLabel(setup.WorkspaceID, "Label 2", nil, nil)
		labels := []*label.Label{label1, label2}

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID).
			Return(labels, nil).Once()

		rec := setup.Get("/labels")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no labels", func(t *testing.T) {
		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID).
			Return([]*label.Label{}, nil).Once()

		rec := setup.Get("/labels")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestLabelHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	label.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets label by ID", func(t *testing.T) {
		testLabel, _ := label.NewLabel(setup.WorkspaceID, "Test Label", nil, nil)
		labelID := testLabel.ID()

		mockSvc.On("GetByID", mock.Anything, labelID, setup.WorkspaceID).
			Return(testLabel, nil).Once()

		rec := setup.Get(fmt.Sprintf("/labels/%s", labelID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when label not found", func(t *testing.T) {
		labelID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, labelID, setup.WorkspaceID).
			Return(nil, label.ErrLabelNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/labels/%s", labelID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestLabelHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	label.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("updates label successfully", func(t *testing.T) {
		color := "#00FF00"
		testLabel, _ := label.NewLabel(setup.WorkspaceID, "Updated", &color, nil)
		labelID := testLabel.ID()

		// Mock GetByID first (handler calls it to get current label)
		currentLabel, _ := label.NewLabel(setup.WorkspaceID, "Original", nil, nil)
		mockSvc.On("GetByID", mock.Anything, labelID, setup.WorkspaceID).
			Return(currentLabel, nil).Once()

		mockSvc.On("Update", mock.Anything, labelID, setup.WorkspaceID, mock.Anything).
			Return(testLabel, nil).Once()

		body := `{"name":"Updated","color":"#00FF00"}`
		rec := setup.Patch(fmt.Sprintf("/labels/%s", labelID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when label not found", func(t *testing.T) {
		labelID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, labelID, setup.WorkspaceID).
			Return(nil, label.ErrLabelNotFound).Once()

		body := `{"name":"Updated"}`
		rec := setup.Patch(fmt.Sprintf("/labels/%s", labelID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for duplicate name", func(t *testing.T) {
		labelID := uuid.New()

		currentLabel, _ := label.NewLabel(setup.WorkspaceID, "Original", nil, nil)
		mockSvc.On("GetByID", mock.Anything, labelID, setup.WorkspaceID).
			Return(currentLabel, nil).Once()

		mockSvc.On("Update", mock.Anything, labelID, setup.WorkspaceID, mock.Anything).
			Return(nil, label.ErrNameTaken).Once()

		body := `{"name":"Duplicate"}`
		rec := setup.Patch(fmt.Sprintf("/labels/%s", labelID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid color format", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		labelID := uuid.New()

		body := `{"color":"invalid"}`
		rec := setup.Patch(fmt.Sprintf("/labels/%s", labelID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestLabelHandler_Archive(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	label.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("archives label successfully", func(t *testing.T) {
		labelID := uuid.New()

		mockSvc.On("Archive", mock.Anything, labelID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/labels/%s/archive", labelID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when label not found", func(t *testing.T) {
		labelID := uuid.New()

		mockSvc.On("Archive", mock.Anything, labelID, setup.WorkspaceID).
			Return(label.ErrLabelNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/labels/%s/archive", labelID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLabelHandler_Restore(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	label.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("restores label successfully", func(t *testing.T) {
		labelID := uuid.New()

		mockSvc.On("Restore", mock.Anything, labelID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/labels/%s/restore", labelID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when label not found", func(t *testing.T) {
		labelID := uuid.New()

		mockSvc.On("Restore", mock.Anything, labelID, setup.WorkspaceID).
			Return(label.ErrLabelNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/labels/%s/restore", labelID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLabelHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	label.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("deletes label successfully", func(t *testing.T) {
		labelID := uuid.New()

		mockSvc.On("Delete", mock.Anything, labelID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/labels/%s", labelID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when label not found", func(t *testing.T) {
		labelID := uuid.New()

		mockSvc.On("Delete", mock.Anything, labelID, setup.WorkspaceID).
			Return(label.ErrLabelNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/labels/%s", labelID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestLabelHandler_Create_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	label.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	color := "#FF5733"
	testLabel, _ := label.NewLabel(setup.WorkspaceID, "Important", &color, nil)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input label.CreateInput) bool {
		return input.Name == "Important"
	})).Return(testLabel, nil).Once()

	body := `{"name":"Important","color":"#FF5733"}`
	rec := setup.Post("/labels", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "label.created", event.Type)
	assert.Equal(t, "label", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, testLabel.ID().String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, testLabel.ID(), event.Data["id"])
	assert.Equal(t, testLabel.Name(), event.Data["name"])
}

func TestLabelHandler_Update_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	label.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	color := "#00FF00"
	testLabel, _ := label.NewLabel(setup.WorkspaceID, "Updated", &color, nil)
	labelID := testLabel.ID()

	// Mock GetByID first (handler calls it to get current label)
	currentLabel, _ := label.NewLabel(setup.WorkspaceID, "Original", nil, nil)
	mockSvc.On("GetByID", mock.Anything, labelID, setup.WorkspaceID).
		Return(currentLabel, nil).Once()

	mockSvc.On("Update", mock.Anything, labelID, setup.WorkspaceID, mock.Anything).
		Return(testLabel, nil).Once()

	body := `{"name":"Updated","color":"#00FF00"}`
	rec := setup.Patch(fmt.Sprintf("/labels/%s", labelID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "label.updated", event.Type)
	assert.Equal(t, "label", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, labelID.String(), event.EntityID)
}

func TestLabelHandler_Archive_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	label.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	labelID := uuid.New()

	mockSvc.On("Archive", mock.Anything, labelID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/labels/%s/archive", labelID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event (archive emits deleted event)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "label.deleted", event.Type)
	assert.Equal(t, "label", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, labelID.String(), event.EntityID)
}

func TestLabelHandler_Restore_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	label.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	labelID := uuid.New()

	mockSvc.On("Restore", mock.Anything, labelID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/labels/%s/restore", labelID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event (restore emits created event)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "label.created", event.Type)
	assert.Equal(t, "label", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, labelID.String(), event.EntityID)
}

func TestLabelHandler_Create_NilBroadcaster_NoError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	// Register with nil broadcaster
	label.RegisterRoutes(setup.API, mockSvc, nil)

	color := "#FF5733"
	testLabel, _ := label.NewLabel(setup.WorkspaceID, "Important", &color, nil)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input label.CreateInput) bool {
		return input.Name == "Important"
	})).Return(testLabel, nil).Once()

	body := `{"name":"Important","color":"#FF5733"}`
	rec := setup.Post("/labels", body)

	// Should not panic and should succeed
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}
