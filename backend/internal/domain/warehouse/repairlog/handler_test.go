package repairlog_test

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

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairlog"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements repairlog.ServiceInterface for testing
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input repairlog.CreateInput) (*repairlog.RepairLog, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*repairlog.RepairLog, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input repairlog.UpdateInput) (*repairlog.RepairLog, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) StartRepair(ctx context.Context, id, workspaceID uuid.UUID) (*repairlog.RepairLog, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) Complete(ctx context.Context, id, workspaceID uuid.UUID, newCondition *string) (*repairlog.RepairLog, error) {
	args := m.Called(ctx, id, workspaceID, newCondition)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*repairlog.RepairLog, error) {
	args := m.Called(ctx, workspaceID, inventoryID)
	return args.Get(0).([]*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*repairlog.RepairLog, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*repairlog.RepairLog), args.Int(1), args.Error(2)
}

func (m *MockService) ListByStatus(ctx context.Context, workspaceID uuid.UUID, status repairlog.RepairStatus, pagination shared.Pagination) ([]*repairlog.RepairLog, error) {
	args := m.Called(ctx, workspaceID, status, pagination)
	return args.Get(0).([]*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) SetWarrantyClaim(ctx context.Context, id, workspaceID uuid.UUID, isWarrantyClaim bool) (*repairlog.RepairLog, error) {
	args := m.Called(ctx, id, workspaceID, isWarrantyClaim)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) SetReminderDate(ctx context.Context, id, workspaceID uuid.UUID, reminderDate *time.Time) (*repairlog.RepairLog, error) {
	args := m.Called(ctx, id, workspaceID, reminderDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repairlog.RepairLog), args.Error(1)
}

func (m *MockService) GetTotalRepairCost(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]repairlog.RepairCostSummary, error) {
	args := m.Called(ctx, workspaceID, inventoryID)
	return args.Get(0).([]repairlog.RepairCostSummary), args.Error(1)
}

// Helper function to create a test repair log
func newTestRepairLog(workspaceID, inventoryID uuid.UUID, status repairlog.RepairStatus) *repairlog.RepairLog {
	now := time.Now()
	var completedAt *time.Time
	if status == repairlog.StatusCompleted {
		completedAt = &now
	}
	return repairlog.Reconstruct(
		uuid.New(),
		workspaceID,
		inventoryID,
		status,
		"Test repair description",
		nil, nil, nil, nil,
		completedAt,
		nil, nil,
		false, nil, false,
		now, now,
	)
}

// Tests for List endpoint

func TestHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists repairs successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		repair1 := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)
		repair2 := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusInProgress)
		repairs := []*repairlog.RepairLog{repair1, repair2}

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(repairs, 2, nil).Once()

		rec := setup.Get("/repairs")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return([]*repairlog.RepairLog{}, 50, nil).Once()

		rec := setup.Get("/repairs?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no repairs", func(t *testing.T) {
		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*repairlog.RepairLog{}, 0, nil).Once()

		rec := setup.Get("/repairs")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("filters by status", func(t *testing.T) {
		inventoryID := uuid.New()
		repairs := []*repairlog.RepairLog{newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)}

		mockSvc.On("ListByStatus", mock.Anything, setup.WorkspaceID, repairlog.StatusPending, mock.Anything).
			Return(repairs, nil).Once()

		rec := setup.Get("/repairs?status=PENDING")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*repairlog.RepairLog{}, 0, errors.New("database error")).Once()

		rec := setup.Get("/repairs")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for Get endpoint

func TestHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets repair by ID", func(t *testing.T) {
		inventoryID := uuid.New()
		repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)
		repairID := repair.ID()

		mockSvc.On("GetByID", mock.Anything, repairID, setup.WorkspaceID).
			Return(repair, nil).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s", repairID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when repair not found", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, repairID, setup.WorkspaceID).
			Return(nil, repairlog.ErrRepairLogNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s", repairID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 for shared.ErrNotFound", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, repairID, setup.WorkspaceID).
			Return(nil, shared.ErrNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s", repairID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on unexpected error", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, repairID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/repairs/%s", repairID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for Create endpoint

func TestHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("creates repair successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input repairlog.CreateInput) bool {
			return input.InventoryID == inventoryID && input.Description == "Screen replacement"
		})).Return(repair, nil).Once()

		body := fmt.Sprintf(`{"inventory_id":"%s","description":"Screen replacement"}`, inventoryID)
		rec := setup.Post("/repairs", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("creates repair with all fields", func(t *testing.T) {
		inventoryID := uuid.New()
		repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)
		repairDate := time.Now().Format(time.RFC3339)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input repairlog.CreateInput) bool {
			return input.InventoryID == inventoryID &&
				input.Description == "Battery replacement" &&
				input.IsWarrantyClaim == true
		})).Return(repair, nil).Once()

		body := fmt.Sprintf(`{
			"inventory_id":"%s",
			"description":"Battery replacement",
			"repair_date":"%s",
			"cost":5000,
			"currency_code":"EUR",
			"service_provider":"Local Shop",
			"notes":"Under warranty",
			"is_warranty_claim":true
		}`, inventoryID, repairDate)
		rec := setup.Post("/repairs", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 for inventory not found", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, shared.ErrNotFound).Once()

		body := fmt.Sprintf(`{"inventory_id":"%s","description":"Test repair"}`, inventoryID)
		rec := setup.Post("/repairs", body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty description (Huma validation)", func(t *testing.T) {
		inventoryID := uuid.New()

		// Huma validates minLength before hitting the service
		body := fmt.Sprintf(`{"inventory_id":"%s","description":""}`, inventoryID)
		rec := setup.Post("/repairs", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 400 for service-level description error", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input repairlog.CreateInput) bool {
			return input.Description == "   " // whitespace passes Huma but fails service
		})).Return(nil, repairlog.ErrInvalidDescription).Once()

		body := fmt.Sprintf(`{"inventory_id":"%s","description":"   "}`, inventoryID)
		rec := setup.Post("/repairs", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for other service errors", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input repairlog.CreateInput) bool {
			return input.Description == "Test"
		})).Return(nil, errors.New("validation error")).Once()

		body := fmt.Sprintf(`{"inventory_id":"%s","description":"Test"}`, inventoryID)
		rec := setup.Post("/repairs", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for Update endpoint

func TestHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("updates repair successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)
		repairID := repair.ID()

		mockSvc.On("Update", mock.Anything, repairID, setup.WorkspaceID, mock.MatchedBy(func(input repairlog.UpdateInput) bool {
			return *input.Description == "Updated description"
		})).Return(repair, nil).Once()

		body := `{"description":"Updated description"}`
		rec := setup.Patch(fmt.Sprintf("/repairs/%s", repairID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("updates repair with cost", func(t *testing.T) {
		inventoryID := uuid.New()
		repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)
		repairID := repair.ID()

		mockSvc.On("Update", mock.Anything, repairID, setup.WorkspaceID, mock.MatchedBy(func(input repairlog.UpdateInput) bool {
			return input.Cost != nil && *input.Cost == 10000
		})).Return(repair, nil).Once()

		body := `{"cost":10000,"currency_code":"USD"}`
		rec := setup.Patch(fmt.Sprintf("/repairs/%s", repairID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when repair not found", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Update", mock.Anything, repairID, setup.WorkspaceID, mock.Anything).
			Return(nil, repairlog.ErrRepairLogNotFound).Once()

		body := `{"description":"Updated"}`
		rec := setup.Patch(fmt.Sprintf("/repairs/%s", repairID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for completed repair", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Update", mock.Anything, repairID, setup.WorkspaceID, mock.Anything).
			Return(nil, repairlog.ErrRepairAlreadyCompleted).Once()

		body := `{"description":"Cannot update"}`
		rec := setup.Patch(fmt.Sprintf("/repairs/%s", repairID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for empty description", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Update", mock.Anything, repairID, setup.WorkspaceID, mock.Anything).
			Return(nil, repairlog.ErrInvalidDescription).Once()

		body := `{"description":""}`
		rec := setup.Patch(fmt.Sprintf("/repairs/%s", repairID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for Delete endpoint

func TestHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("deletes repair successfully", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Delete", mock.Anything, repairID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s", repairID))

		// Delete returns nil body, huma returns 204 or 200 depending on config
		assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when repair not found", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Delete", mock.Anything, repairID, setup.WorkspaceID).
			Return(repairlog.ErrRepairLogNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s", repairID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Delete", mock.Anything, repairID, setup.WorkspaceID).
			Return(errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/repairs/%s", repairID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for StartRepair endpoint

func TestHandler_StartRepair(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("starts repair successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusInProgress)
		repairID := repair.ID()

		mockSvc.On("StartRepair", mock.Anything, repairID, setup.WorkspaceID).
			Return(repair, nil).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/start", repairID), "")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when repair not found", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("StartRepair", mock.Anything, repairID, setup.WorkspaceID).
			Return(nil, repairlog.ErrRepairLogNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/start", repairID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid status transition", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("StartRepair", mock.Anything, repairID, setup.WorkspaceID).
			Return(nil, repairlog.ErrInvalidStatusTransition).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/start", repairID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for other errors", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("StartRepair", mock.Anything, repairID, setup.WorkspaceID).
			Return(nil, errors.New("unexpected error")).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/start", repairID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for Complete endpoint

func TestHandler_Complete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("completes repair successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusCompleted)
		repairID := repair.ID()

		mockSvc.On("Complete", mock.Anything, repairID, setup.WorkspaceID, (*string)(nil)).
			Return(repair, nil).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/complete", repairID), "{}")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("completes repair with new condition", func(t *testing.T) {
		inventoryID := uuid.New()
		repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusCompleted)
		repairID := repair.ID()

		mockSvc.On("Complete", mock.Anything, repairID, setup.WorkspaceID, mock.MatchedBy(func(c *string) bool {
			return c != nil && *c == "EXCELLENT"
		})).Return(repair, nil).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/complete", repairID), `{"new_condition":"EXCELLENT"}`)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when repair not found", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Complete", mock.Anything, repairID, setup.WorkspaceID, mock.Anything).
			Return(nil, repairlog.ErrRepairLogNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/complete", repairID), "{}")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid status transition", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Complete", mock.Anything, repairID, setup.WorkspaceID, mock.Anything).
			Return(nil, repairlog.ErrInvalidStatusTransition).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/complete", repairID), "{}")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for already completed repair", func(t *testing.T) {
		repairID := uuid.New()

		mockSvc.On("Complete", mock.Anything, repairID, setup.WorkspaceID, mock.Anything).
			Return(nil, repairlog.ErrRepairAlreadyCompleted).Once()

		rec := setup.Post(fmt.Sprintf("/repairs/%s/complete", repairID), "{}")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for ListByInventory endpoint

func TestHandler_ListByInventory(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists repairs for inventory successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		repair1 := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)
		repair2 := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusCompleted)
		repairs := []*repairlog.RepairLog{repair1, repair2}

		mockSvc.On("ListByInventory", mock.Anything, setup.WorkspaceID, inventoryID).
			Return(repairs, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/repairs", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no repairs", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("ListByInventory", mock.Anything, setup.WorkspaceID, inventoryID).
			Return([]*repairlog.RepairLog{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/repairs", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("ListByInventory", mock.Anything, setup.WorkspaceID, inventoryID).
			Return([]*repairlog.RepairLog{}, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/repairs", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for GetTotalRepairCost endpoint

func TestHandler_GetTotalRepairCost(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets total repair cost successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		currencyCode := "EUR"
		summaries := []repairlog.RepairCostSummary{
			{CurrencyCode: &currencyCode, TotalCostCents: 15000, RepairCount: 3},
		}

		mockSvc.On("GetTotalRepairCost", mock.Anything, setup.WorkspaceID, inventoryID).
			Return(summaries, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/repair-cost", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns multiple currency summaries", func(t *testing.T) {
		inventoryID := uuid.New()
		eur := "EUR"
		usd := "USD"
		summaries := []repairlog.RepairCostSummary{
			{CurrencyCode: &eur, TotalCostCents: 15000, RepairCount: 3},
			{CurrencyCode: &usd, TotalCostCents: 5000, RepairCount: 1},
		}

		mockSvc.On("GetTotalRepairCost", mock.Anything, setup.WorkspaceID, inventoryID).
			Return(summaries, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/repair-cost", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no repairs", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("GetTotalRepairCost", mock.Anything, setup.WorkspaceID, inventoryID).
			Return([]repairlog.RepairCostSummary{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/repair-cost", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("GetTotalRepairCost", mock.Anything, setup.WorkspaceID, inventoryID).
			Return([]repairlog.RepairCostSummary{}, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/repair-cost", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestHandler_Create_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairlog.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	inventoryID := uuid.New()
	repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)

	mockSvc.On("Create", mock.Anything, mock.Anything).Return(repair, nil).Once()

	body := fmt.Sprintf(`{"inventory_id":"%s","description":"Test repair"}`, inventoryID)
	rec := setup.Post("/repairs", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repairlog.created", event.Type)
	assert.Equal(t, "repairlog", event.EntityType)
	assert.Equal(t, repair.ID().String(), event.EntityID)
}

func TestHandler_Update_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairlog.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	inventoryID := uuid.New()
	repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)
	repairID := repair.ID()

	mockSvc.On("Update", mock.Anything, repairID, setup.WorkspaceID, mock.Anything).
		Return(repair, nil).Once()

	body := `{"description":"Updated"}`
	rec := setup.Patch(fmt.Sprintf("/repairs/%s", repairID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repairlog.updated", event.Type)
	assert.Equal(t, "repairlog", event.EntityType)
	assert.Equal(t, repairID.String(), event.EntityID)
}

func TestHandler_StartRepair_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairlog.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	inventoryID := uuid.New()
	repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusInProgress)
	repairID := repair.ID()

	mockSvc.On("StartRepair", mock.Anything, repairID, setup.WorkspaceID).
		Return(repair, nil).Once()

	rec := setup.Post(fmt.Sprintf("/repairs/%s/start", repairID), "")

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repairlog.started", event.Type)
	assert.Equal(t, "repairlog", event.EntityType)
	assert.Equal(t, repairID.String(), event.EntityID)
}

func TestHandler_Complete_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairlog.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	inventoryID := uuid.New()
	repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusCompleted)
	repairID := repair.ID()

	mockSvc.On("Complete", mock.Anything, repairID, setup.WorkspaceID, mock.Anything).
		Return(repair, nil).Once()

	rec := setup.Post(fmt.Sprintf("/repairs/%s/complete", repairID), "{}")

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repairlog.completed", event.Type)
	assert.Equal(t, "repairlog", event.EntityType)
	assert.Equal(t, repairID.String(), event.EntityID)
}

func TestHandler_Delete_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	repairlog.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	repairID := uuid.New()

	mockSvc.On("Delete", mock.Anything, repairID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Delete(fmt.Sprintf("/repairs/%s", repairID))

	assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "repairlog.deleted", event.Type)
	assert.Equal(t, "repairlog", event.EntityType)
	assert.Equal(t, repairID.String(), event.EntityID)
}

func TestHandler_NilBroadcaster_NoError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	repairlog.RegisterRoutes(setup.API, mockSvc, nil) // nil broadcaster

	inventoryID := uuid.New()
	repair := newTestRepairLog(setup.WorkspaceID, inventoryID, repairlog.StatusPending)

	mockSvc.On("Create", mock.Anything, mock.Anything).Return(repair, nil).Once()

	body := fmt.Sprintf(`{"inventory_id":"%s","description":"Test repair"}`, inventoryID)
	rec := setup.Post("/repairs", body)

	// Should work without error even with nil broadcaster
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}
