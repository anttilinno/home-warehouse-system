package loan_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
	"github.com/stretchr/testify/assert"
)

// MockService implements loan.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input loan.CreateInput) (*loan.Loan, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*loan.Loan), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*loan.Loan, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*loan.Loan), args.Error(1)
}

func (m *MockService) Return(ctx context.Context, id, workspaceID uuid.UUID) (*loan.Loan, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*loan.Loan), args.Error(1)
}

func (m *MockService) ExtendDueDate(ctx context.Context, id, workspaceID uuid.UUID, newDueDate time.Time) (*loan.Loan, error) {
	args := m.Called(ctx, id, workspaceID, newDueDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*loan.Loan), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, dueDate *time.Time, notes *string) (*loan.Loan, error) {
	args := m.Called(ctx, id, workspaceID, dueDate, notes)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*loan.Loan), args.Error(1)
}

func (m *MockService) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*loan.Loan, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*loan.Loan), args.Int(1), args.Error(2)
}

func (m *MockService) ListByBorrower(ctx context.Context, workspaceID, borrowerID uuid.UUID, pagination shared.Pagination) ([]*loan.Loan, error) {
	args := m.Called(ctx, workspaceID, borrowerID, pagination)
	return args.Get(0).([]*loan.Loan), args.Error(1)
}

func (m *MockService) ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*loan.Loan, error) {
	args := m.Called(ctx, workspaceID, inventoryID)
	return args.Get(0).([]*loan.Loan), args.Error(1)
}

func (m *MockService) GetActiveLoans(ctx context.Context, workspaceID uuid.UUID) ([]*loan.Loan, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).([]*loan.Loan), args.Error(1)
}

func (m *MockService) GetOverdueLoans(ctx context.Context, workspaceID uuid.UUID) ([]*loan.Loan, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).([]*loan.Loan), args.Error(1)
}

func (m *MockService) ListByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*loan.Loan, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Get(0).([]*loan.Loan), args.Error(1)
}

// Tests

func TestLoanHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("creates loan successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		borrowerID := uuid.New()
		loanedAt := time.Now()
		dueDate := loanedAt.Add(7 * 24 * time.Hour)

		testLoan, _ := loan.NewLoan(
			setup.WorkspaceID,
			inventoryID,
			borrowerID,
			1,
			loanedAt,
			&dueDate,
			nil,
		)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input loan.CreateInput) bool {
			return input.InventoryID == inventoryID && input.BorrowerID == borrowerID && input.Quantity == 1
		})).Return(testLoan, nil).Once()

		body := fmt.Sprintf(`{"inventory_id":"%s","borrower_id":"%s","quantity":1,"loaned_at":"%s","due_date":"%s"}`,
			inventoryID, borrowerID, loanedAt.Format(time.RFC3339), dueDate.Format(time.RFC3339))
		rec := setup.Post("/loans", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for inventory not available", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, loan.ErrInventoryNotAvailable).Once()

		body := `{"inventory_id":"00000000-0000-0000-0000-000000000000","borrower_id":"00000000-0000-0000-0000-000000000000","quantity":1,"loaned_at":"2024-01-01T00:00:00Z","due_date":"2024-01-08T00:00:00Z"}`
		rec := setup.Post("/loans", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for quantity exceeds available", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, loan.ErrQuantityExceedsAvailable).Once()

		body := `{"inventory_id":"00000000-0000-0000-0000-000000000000","borrower_id":"00000000-0000-0000-0000-000000000000","quantity":100,"loaned_at":"2024-01-01T00:00:00Z","due_date":"2024-01-08T00:00:00Z"}`
		rec := setup.Post("/loans", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for inventory already on loan", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, loan.ErrInventoryOnLoan).Once()

		body := `{"inventory_id":"00000000-0000-0000-0000-000000000000","borrower_id":"00000000-0000-0000-0000-000000000000","quantity":1,"loaned_at":"2024-01-01T00:00:00Z","due_date":"2024-01-08T00:00:00Z"}`
		rec := setup.Post("/loans", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLoanHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("lists loans successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		borrowerID := uuid.New()
		loanedAt := time.Now()
		dueDate := loanedAt.Add(7 * 24 * time.Hour)

		loan1, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
		loans := []*loan.Loan{loan1}

		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(loans, 1, nil).Once()

		rec := setup.Get("/loans")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return([]*loan.Loan{}, 50, nil).Once()

		rec := setup.Get("/loans?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no loans", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*loan.Loan{}, 0, nil).Once()

		rec := setup.Get("/loans")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestLoanHandler_GetActiveLoans(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("gets active loans successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		borrowerID := uuid.New()
		loanedAt := time.Now()
		dueDate := loanedAt.Add(7 * 24 * time.Hour)

		loan1, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
		loans := []*loan.Loan{loan1}

		mockSvc.On("GetActiveLoans", mock.Anything, setup.WorkspaceID).
			Return(loans, nil).Once()

		rec := setup.Get("/loans/active")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no active loans", func(t *testing.T) {
		mockSvc.On("GetActiveLoans", mock.Anything, setup.WorkspaceID).
			Return([]*loan.Loan{}, nil).Once()

		rec := setup.Get("/loans/active")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestLoanHandler_GetOverdueLoans(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("gets overdue loans successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		borrowerID := uuid.New()
		loanedAt := time.Now().Add(-14 * 24 * time.Hour)
		dueDate := time.Now().Add(-7 * 24 * time.Hour) // Overdue

		loan1, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
		loans := []*loan.Loan{loan1}

		mockSvc.On("GetOverdueLoans", mock.Anything, setup.WorkspaceID).
			Return(loans, nil).Once()

		rec := setup.Get("/loans/overdue")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no overdue loans", func(t *testing.T) {
		mockSvc.On("GetOverdueLoans", mock.Anything, setup.WorkspaceID).
			Return([]*loan.Loan{}, nil).Once()

		rec := setup.Get("/loans/overdue")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestLoanHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("gets loan by ID", func(t *testing.T) {
		inventoryID := uuid.New()
		borrowerID := uuid.New()
		loanedAt := time.Now()
		dueDate := loanedAt.Add(7 * 24 * time.Hour)

		testLoan, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
		loanID := testLoan.ID()

		mockSvc.On("GetByID", mock.Anything, loanID, setup.WorkspaceID).
			Return(testLoan, nil).Once()

		rec := setup.Get(fmt.Sprintf("/loans/%s", loanID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when loan not found", func(t *testing.T) {
		loanID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, loanID, setup.WorkspaceID).
			Return(nil, loan.ErrLoanNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/loans/%s", loanID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestLoanHandler_Return(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("returns loan successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		borrowerID := uuid.New()
		loanedAt := time.Now()
		dueDate := loanedAt.Add(7 * 24 * time.Hour)

		testLoan, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
		loanID := testLoan.ID()

		mockSvc.On("Return", mock.Anything, loanID, setup.WorkspaceID).
			Return(testLoan, nil).Once()

		rec := setup.Post(fmt.Sprintf("/loans/%s/return", loanID), "")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when loan not found", func(t *testing.T) {
		loanID := uuid.New()

		mockSvc.On("Return", mock.Anything, loanID, setup.WorkspaceID).
			Return(nil, loan.ErrLoanNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/loans/%s/return", loanID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when loan already returned", func(t *testing.T) {
		loanID := uuid.New()

		mockSvc.On("Return", mock.Anything, loanID, setup.WorkspaceID).
			Return(nil, loan.ErrAlreadyReturned).Once()

		rec := setup.Post(fmt.Sprintf("/loans/%s/return", loanID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLoanHandler_ExtendDueDate(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("extends due date successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		borrowerID := uuid.New()
		loanedAt := time.Now()
		newDueDate := loanedAt.Add(14 * 24 * time.Hour)

		testLoan, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &newDueDate, nil)
		loanID := testLoan.ID()

		mockSvc.On("ExtendDueDate", mock.Anything, loanID, setup.WorkspaceID, mock.MatchedBy(func(t time.Time) bool {
			return t.Sub(newDueDate).Abs() < time.Second
		})).Return(testLoan, nil).Once()

		body := fmt.Sprintf(`{"new_due_date":"%s"}`, newDueDate.Format(time.RFC3339))
		rec := setup.Patch(fmt.Sprintf("/loans/%s/extend", loanID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when loan not found", func(t *testing.T) {
		loanID := uuid.New()
		newDueDate := time.Now().Add(14 * 24 * time.Hour)

		mockSvc.On("ExtendDueDate", mock.Anything, loanID, setup.WorkspaceID, mock.Anything).
			Return(nil, loan.ErrLoanNotFound).Once()

		body := fmt.Sprintf(`{"new_due_date":"%s"}`, newDueDate.Format(time.RFC3339))
		rec := setup.Patch(fmt.Sprintf("/loans/%s/extend", loanID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid due date", func(t *testing.T) {
		loanID := uuid.New()
		invalidDueDate := time.Now().Add(-7 * 24 * time.Hour) // In the past

		mockSvc.On("ExtendDueDate", mock.Anything, loanID, setup.WorkspaceID, mock.Anything).
			Return(nil, loan.ErrInvalidDueDate).Once()

		body := fmt.Sprintf(`{"new_due_date":"%s"}`, invalidDueDate.Format(time.RFC3339))
		rec := setup.Patch(fmt.Sprintf("/loans/%s/extend", loanID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLoanHandler_ListByBorrower(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("lists loans by borrower successfully", func(t *testing.T) {
		borrowerID := uuid.New()
		inventoryID := uuid.New()
		loanedAt := time.Now()
		dueDate := loanedAt.Add(7 * 24 * time.Hour)

		loan1, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
		loans := []*loan.Loan{loan1}

		mockSvc.On("ListByBorrower", mock.Anything, setup.WorkspaceID, borrowerID, mock.Anything).
			Return(loans, nil).Once()

		rec := setup.Get(fmt.Sprintf("/borrowers/%s/loans", borrowerID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestLoanHandler_ListByInventory(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	t.Run("lists loans by inventory successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		borrowerID := uuid.New()
		loanedAt := time.Now()
		dueDate := loanedAt.Add(7 * 24 * time.Hour)

		loan1, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
		loans := []*loan.Loan{loan1}

		mockSvc.On("ListByInventory", mock.Anything, setup.WorkspaceID, inventoryID).
			Return(loans, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/loans", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestLoanHandler_Create_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	loan.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), nil)

	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	dueDate := loanedAt.Add(7 * 24 * time.Hour)

	testLoan, _ := loan.NewLoan(
		setup.WorkspaceID,
		inventoryID,
		borrowerID,
		1,
		loanedAt,
		&dueDate,
		nil,
	)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input loan.CreateInput) bool {
		return input.BorrowerID == borrowerID && input.InventoryID == inventoryID
	})).Return(testLoan, nil).Once()

	body := fmt.Sprintf(`{"inventory_id":"%s","borrower_id":"%s","quantity":1,"loaned_at":"%s","due_date":"%s"}`,
		inventoryID, borrowerID, loanedAt.Format(time.RFC3339), dueDate.Format(time.RFC3339))
	rec := setup.Post("/loans", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "loan.created", event.Type)
	assert.Equal(t, "loan", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, testLoan.ID().String(), event.EntityID)
}

func TestLoanHandler_ExtendDueDate_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	loan.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), nil)

	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	newDueDate := loanedAt.Add(14 * 24 * time.Hour)

	testLoan, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &newDueDate, nil)
	loanID := testLoan.ID()

	mockSvc.On("ExtendDueDate", mock.Anything, loanID, setup.WorkspaceID, mock.Anything).
		Return(testLoan, nil).Once()

	body := fmt.Sprintf(`{"new_due_date":"%s"}`, newDueDate.Format(time.RFC3339))
	rec := setup.Patch(fmt.Sprintf("/loans/%s/extend", loanID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "loan.updated", event.Type)
	assert.Equal(t, "loan", event.EntityType)
	assert.Equal(t, loanID.String(), event.EntityID)
}

func TestLoanHandler_Return_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	loan.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), nil)

	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	dueDate := loanedAt.Add(7 * 24 * time.Hour)

	testLoan, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
	loanID := testLoan.ID()

	mockSvc.On("Return", mock.Anything, loanID, setup.WorkspaceID).
		Return(testLoan, nil).Once()

	rec := setup.Post(fmt.Sprintf("/loans/%s/return", loanID), "")

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "loan.returned", event.Type) // Special returned event
	assert.Equal(t, "loan", event.EntityType)
	assert.Equal(t, loanID.String(), event.EntityID)
}

func TestLoanHandler_Create_NilBroadcaster_NoError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	dueDate := loanedAt.Add(7 * 24 * time.Hour)

	testLoan, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)

	mockSvc.On("Create", mock.Anything, mock.Anything).
		Return(testLoan, nil).Once()

	body := fmt.Sprintf(`{"inventory_id":"%s","borrower_id":"%s","quantity":1,"loaned_at":"%s","due_date":"%s"}`,
		inventoryID, borrowerID, loanedAt.Format(time.RFC3339), dueDate.Format(time.RFC3339))
	rec := setup.Post("/loans", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

// =============================================================================
// Update (PATCH /loans/{id}) handler tests — plan 62-01 Task 1
// =============================================================================

func TestHandler_UpdateLoan_Success(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	newDueDate := loanedAt.Add(14 * 24 * time.Hour)
	notes := "updated notes"

	updated, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &newDueDate, &notes)
	loanID := updated.ID()

	mockSvc.On("Update", mock.Anything, loanID, setup.WorkspaceID,
		mock.MatchedBy(func(d *time.Time) bool { return d != nil && d.Sub(newDueDate).Abs() < time.Second }),
		mock.MatchedBy(func(n *string) bool { return n != nil && *n == notes }),
	).Return(updated, nil).Once()

	body := fmt.Sprintf(`{"due_date":"%s","notes":"%s"}`, newDueDate.Format(time.RFC3339), notes)
	rec := setup.Patch(fmt.Sprintf("/loans/%s", loanID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

func TestHandler_UpdateLoan_AlreadyReturned(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	loanID := uuid.New()
	dueDate := time.Now().Add(14 * 24 * time.Hour)

	mockSvc.On("Update", mock.Anything, loanID, setup.WorkspaceID, mock.Anything, mock.Anything).
		Return(nil, loan.ErrAlreadyReturned).Once()

	body := fmt.Sprintf(`{"due_date":"%s"}`, dueDate.Format(time.RFC3339))
	rec := setup.Patch(fmt.Sprintf("/loans/%s", loanID), body)

	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	assert.Contains(t, rec.Body.String(), "cannot edit returned")
	mockSvc.AssertExpectations(t)
}

func TestHandler_UpdateLoan_InvalidDueDate(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	loanID := uuid.New()
	invalidDueDate := time.Now().Add(-7 * 24 * time.Hour)

	mockSvc.On("Update", mock.Anything, loanID, setup.WorkspaceID, mock.Anything, mock.Anything).
		Return(nil, loan.ErrInvalidDueDate).Once()

	body := fmt.Sprintf(`{"due_date":"%s"}`, invalidDueDate.Format(time.RFC3339))
	rec := setup.Patch(fmt.Sprintf("/loans/%s", loanID), body)

	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	assert.Contains(t, rec.Body.String(), "must be after")
	mockSvc.AssertExpectations(t)
}

func TestHandler_UpdateLoan_NotFound(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	loanID := uuid.New()
	dueDate := time.Now().Add(14 * 24 * time.Hour)

	mockSvc.On("Update", mock.Anything, loanID, setup.WorkspaceID, mock.Anything, mock.Anything).
		Return(nil, loan.ErrLoanNotFound).Once()

	body := fmt.Sprintf(`{"due_date":"%s"}`, dueDate.Format(time.RFC3339))
	rec := setup.Patch(fmt.Sprintf("/loans/%s", loanID), body)

	testutil.AssertStatus(t, rec, http.StatusNotFound)
	mockSvc.AssertExpectations(t)
}

func TestHandler_UpdateLoan_NotesOnly(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil, nil)

	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	dueDate := loanedAt.Add(7 * 24 * time.Hour)
	newNotes := "just changing notes"

	updated, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, &newNotes)
	loanID := updated.ID()

	// Mock MUST be called with nil dueDate and non-nil notes pointer.
	mockSvc.On("Update", mock.Anything, loanID, setup.WorkspaceID,
		mock.MatchedBy(func(d *time.Time) bool { return d == nil }),
		mock.MatchedBy(func(n *string) bool { return n != nil && *n == newNotes }),
	).Return(updated, nil).Once()

	body := fmt.Sprintf(`{"notes":"%s"}`, newNotes)
	rec := setup.Patch(fmt.Sprintf("/loans/%s", loanID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

// =============================================================================
// Decoration (item + borrower embeds) handler tests — plan 62-01 Task 2
// =============================================================================

// stubDecorationLookup is a minimal loan.DecorationLookup used in tests. It
// returns a single canned item/borrower for every ID, with an optional
// thumbnail URL.
type stubDecorationLookup struct {
	itemName     string
	itemIDFixed  uuid.UUID
	thumbnailURL string
	borrowerName string
}

func (s *stubDecorationLookup) ItemsByInventoryIDs(_ context.Context, _ uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]loan.ItemLookupRow, error) {
	out := map[uuid.UUID]loan.ItemLookupRow{}
	for _, id := range ids {
		out[id] = loan.ItemLookupRow{ItemID: s.itemIDFixed, ItemName: s.itemName}
	}
	return out, nil
}

func (s *stubDecorationLookup) PrimaryPhotoThumbnailURLsByItemIDs(_ context.Context, _ uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	out := map[uuid.UUID]string{}
	if s.thumbnailURL == "" {
		return out, nil
	}
	for _, id := range ids {
		out[id] = s.thumbnailURL
	}
	return out, nil
}

func (s *stubDecorationLookup) BorrowersByIDs(_ context.Context, _ uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	out := map[uuid.UUID]string{}
	for _, id := range ids {
		out[id] = s.borrowerName
	}
	return out, nil
}

func TestHandler_ListResponseIncludesEmbeds(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	itemID := uuid.New()
	lookup := &stubDecorationLookup{
		itemName:     "Widget Pro",
		itemIDFixed:  itemID,
		thumbnailURL: "https://example.com/thumb.webp",
		borrowerName: "Alice",
	}
	loan.RegisterRoutes(setup.API, mockSvc, nil, lookup)

	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	dueDate := loanedAt.Add(7 * 24 * time.Hour)

	testLoan, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
	loans := []*loan.Loan{testLoan}

	mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.Anything).
		Return(loans, 1, nil).Once()

	rec := setup.Get("/loans")

	testutil.AssertStatus(t, rec, http.StatusOK)
	body := rec.Body.String()
	assert.Contains(t, body, `"item":`)
	assert.Contains(t, body, fmt.Sprintf(`"id":"%s"`, itemID))
	assert.Contains(t, body, `"name":"Widget Pro"`)
	assert.Contains(t, body, `"primary_photo_thumbnail_url":"https://example.com/thumb.webp"`)
	assert.Contains(t, body, `"borrower":`)
	assert.Contains(t, body, `"name":"Alice"`)
	mockSvc.AssertExpectations(t)
}

func TestHandler_GetLoanByID_IncludesEmbeds(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	itemID := uuid.New()
	lookup := &stubDecorationLookup{
		itemName:     "Drill",
		itemIDFixed:  itemID,
		thumbnailURL: "",
		borrowerName: "Bob",
	}
	loan.RegisterRoutes(setup.API, mockSvc, nil, lookup)

	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	dueDate := loanedAt.Add(7 * 24 * time.Hour)

	testLoan, _ := loan.NewLoan(setup.WorkspaceID, inventoryID, borrowerID, 1, loanedAt, &dueDate, nil)
	loanID := testLoan.ID()

	mockSvc.On("GetByID", mock.Anything, loanID, setup.WorkspaceID).
		Return(testLoan, nil).Once()

	rec := setup.Get(fmt.Sprintf("/loans/%s", loanID))

	testutil.AssertStatus(t, rec, http.StatusOK)
	body := rec.Body.String()
	assert.Contains(t, body, `"item":`)
	assert.Contains(t, body, fmt.Sprintf(`"id":"%s"`, itemID))
	assert.Contains(t, body, `"name":"Drill"`)
	// Empty thumbnail URL → field omitted (json:"...,omitempty")
	assert.NotContains(t, body, `"primary_photo_thumbnail_url"`)
	assert.Contains(t, body, `"borrower":`)
	assert.Contains(t, body, `"name":"Bob"`)
	mockSvc.AssertExpectations(t)
}
