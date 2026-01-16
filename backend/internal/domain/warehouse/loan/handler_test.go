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

// Tests

func TestLoanHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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

	loan.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

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

	loan.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

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

	loan.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

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
	loan.RegisterRoutes(setup.API, mockSvc, nil)

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
