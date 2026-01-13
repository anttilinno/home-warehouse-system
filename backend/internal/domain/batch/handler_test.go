package batch_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/batch"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements batch.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) ProcessBatch(ctx context.Context, workspaceID uuid.UUID, req batch.BatchRequest) (*batch.BatchResponse, error) {
	args := m.Called(ctx, workspaceID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*batch.BatchResponse), args.Error(1)
}

// Tests

func TestBatchHandler_ProcessBatch(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	batch.RegisterRoutes(setup.API, mockSvc)

	t.Run("processes batch successfully", func(t *testing.T) {
		itemID := uuid.New()
		updateData := map[string]interface{}{
			"name": "Updated Item",
		}
		dataBytes, _ := json.Marshal(updateData)

		response := &batch.BatchResponse{
			Results: []batch.OperationResult{
				{
					Index:    0,
					Status:   batch.StatusSuccess,
					EntityID: &itemID,
				},
			},
			Succeeded: 1,
			Failed:    0,
			Conflicts: 0,
		}

		mockSvc.On("ProcessBatch", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(req batch.BatchRequest) bool {
			return len(req.Operations) == 1
		})).Return(response, nil).Once()

		body := `{
			"operations": [
				{
					"operation": "update",
					"entity_type": "item",
					"entity_id": "` + itemID.String() + `",
					"data": ` + string(dataBytes) + `
				}
			]
		}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles multiple operations", func(t *testing.T) {
		itemID1 := uuid.New()
		itemID2 := uuid.New()

		response := &batch.BatchResponse{
			Results: []batch.OperationResult{
				{
					Index:    0,
					Status:   batch.StatusSuccess,
					EntityID: &itemID1,
				},
				{
					Index:    1,
					Status:   batch.StatusSuccess,
					EntityID: &itemID2,
				},
			},
			Succeeded: 2,
			Failed:    0,
			Conflicts: 0,
		}

		mockSvc.On("ProcessBatch", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(req batch.BatchRequest) bool {
			return len(req.Operations) == 2
		})).Return(response, nil).Once()

		body := `{
			"operations": [
				{
					"operation": "update",
					"entity_type": "item",
					"entity_id": "` + itemID1.String() + `",
					"data": {"name": "Item 1"}
				},
				{
					"operation": "update",
					"entity_type": "item",
					"entity_id": "` + itemID2.String() + `",
					"data": {"name": "Item 2"}
				}
			]
		}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles conflicts", func(t *testing.T) {
		itemID := uuid.New()
		serverData := json.RawMessage(`{"name":"Server Version","updated_at":"2024-01-15T10:00:00Z"}`)

		response := &batch.BatchResponse{
			Results: []batch.OperationResult{
				{
					Index:       0,
					Status:      batch.StatusConflict,
					EntityID:    &itemID,
					HasConflict: true,
					ServerData:  &serverData,
				},
			},
			Succeeded: 0,
			Failed:    0,
			Conflicts: 1,
		}

		mockSvc.On("ProcessBatch", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(req batch.BatchRequest) bool {
			return len(req.Operations) == 1
		})).Return(response, nil).Once()

		updatedAt := time.Now().Add(-1 * time.Hour).Format(time.RFC3339)
		body := `{
			"operations": [
				{
					"operation": "update",
					"entity_type": "item",
					"entity_id": "` + itemID.String() + `",
					"data": {"name": "Client Version"},
					"updated_at": "` + updatedAt + `"
				}
			]
		}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles errors", func(t *testing.T) {
		itemID := uuid.New()
		errorMsg := "item not found"
		errorCode := "NOT_FOUND"

		response := &batch.BatchResponse{
			Results: []batch.OperationResult{
				{
					Index:     0,
					Status:    batch.StatusError,
					Error:     &errorMsg,
					ErrorCode: &errorCode,
				},
			},
			Succeeded: 0,
			Failed:    1,
			Conflicts: 0,
		}

		mockSvc.On("ProcessBatch", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(req batch.BatchRequest) bool {
			return len(req.Operations) == 1
		})).Return(response, nil).Once()

		body := `{
			"operations": [
				{
					"operation": "update",
					"entity_type": "item",
					"entity_id": "` + itemID.String() + `",
					"data": {"name": "Test"}
				}
			]
		}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for empty operations", func(t *testing.T) {
		body := `{"operations": []}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns 400 for too many operations", func(t *testing.T) {
		// Create a batch with 101 operations (exceeds max of 100)
		operations := make([]string, 101)
		for i := range operations {
			operations[i] = `{"operation":"update","entity_type":"item","entity_id":"` + uuid.New().String() + `","data":{}}`
		}

		body := `{"operations":[` + string(operations[0])
		for i := 1; i < len(operations); i++ {
			body += `,` + operations[i]
		}
		body += `]}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("handles delete operations", func(t *testing.T) {
		itemID := uuid.New()

		response := &batch.BatchResponse{
			Results: []batch.OperationResult{
				{
					Index:    0,
					Status:   batch.StatusSuccess,
					EntityID: &itemID,
				},
			},
			Succeeded: 1,
			Failed:    0,
			Conflicts: 0,
		}

		mockSvc.On("ProcessBatch", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(req batch.BatchRequest) bool {
			return len(req.Operations) == 1 && req.Operations[0].Operation == batch.OperationDelete
		})).Return(response, nil).Once()

		body := `{
			"operations": [
				{
					"operation": "delete",
					"entity_type": "item",
					"entity_id": "` + itemID.String() + `"
				}
			]
		}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles mixed success and failure", func(t *testing.T) {
		itemID1 := uuid.New()
		itemID2 := uuid.New()
		errorMsg := "validation error"
		errorCode := "VALIDATION_ERROR"

		response := &batch.BatchResponse{
			Results: []batch.OperationResult{
				{
					Index:    0,
					Status:   batch.StatusSuccess,
					EntityID: &itemID1,
				},
				{
					Index:     1,
					Status:    batch.StatusError,
					Error:     &errorMsg,
					ErrorCode: &errorCode,
				},
			},
			Succeeded: 1,
			Failed:    1,
			Conflicts: 0,
		}

		mockSvc.On("ProcessBatch", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(req batch.BatchRequest) bool {
			return len(req.Operations) == 2
		})).Return(response, nil).Once()

		body := `{
			"operations": [
				{
					"operation": "update",
					"entity_type": "item",
					"entity_id": "` + itemID1.String() + `",
					"data": {"name": "Valid Item"}
				},
				{
					"operation": "update",
					"entity_type": "item",
					"entity_id": "` + itemID2.String() + `",
					"data": {"name": ""}
				}
			]
		}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("ProcessBatch", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return(nil, fmt.Errorf("test error")).Once()

		body := `{
			"operations": [
				{
					"operation": "update",
					"entity_type": "item",
					"entity_id": "` + uuid.New().String() + `",
					"data": {"name": "Test"}
				}
			]
		}`

		rec := setup.Post("/sync/batch", body)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}
