package borrower_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements borrower.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input borrower.CreateInput) (*borrower.Borrower, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*borrower.Borrower), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*borrower.Borrower, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*borrower.Borrower), args.Error(1)
}

func (m *MockService) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*borrower.Borrower, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*borrower.Borrower), args.Int(1), args.Error(2)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input borrower.UpdateInput) (*borrower.Borrower, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*borrower.Borrower), args.Error(1)
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

func TestBorrowerHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	borrower.RegisterRoutes(setup.API, mockSvc)

	t.Run("creates borrower successfully", func(t *testing.T) {
		email := "john@example.com"
		phone := "+1234567890"
		testBorrower, _ := borrower.NewBorrower(setup.WorkspaceID, "John Doe", &email, &phone, nil)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input borrower.CreateInput) bool {
			return input.Name == "John Doe" && input.Email != nil && *input.Email == "john@example.com"
		})).Return(testBorrower, nil).Once()

		body := `{"name":"John Doe","email":"john@example.com","phone":"+1234567890"}`
		rec := setup.Post("/borrowers", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("creates borrower without optional fields", func(t *testing.T) {
		testBorrower, _ := borrower.NewBorrower(setup.WorkspaceID, "Jane Doe", nil, nil, nil)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input borrower.CreateInput) bool {
			return input.Name == "Jane Doe" && input.Email == nil && input.Phone == nil
		})).Return(testBorrower, nil).Once()

		body := `{"name":"Jane Doe"}`
		rec := setup.Post("/borrowers", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty name", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		body := `{"name":""}`
		rec := setup.Post("/borrowers", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 422 for invalid email format", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		body := `{"name":"John","email":"invalid"}`
		rec := setup.Post("/borrowers", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestBorrowerHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	borrower.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists borrowers successfully", func(t *testing.T) {
		bor1, _ := borrower.NewBorrower(setup.WorkspaceID, "Borrower 1", nil, nil, nil)
		bor2, _ := borrower.NewBorrower(setup.WorkspaceID, "Borrower 2", nil, nil, nil)
		borrowers := []*borrower.Borrower{bor1, bor2}

		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(borrowers, 2, nil).Once()

		rec := setup.Get("/borrowers")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return([]*borrower.Borrower{}, 50, nil).Once()

		rec := setup.Get("/borrowers?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no borrowers", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*borrower.Borrower{}, 0, nil).Once()

		rec := setup.Get("/borrowers")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestBorrowerHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	borrower.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets borrower by ID", func(t *testing.T) {
		testBorrower, _ := borrower.NewBorrower(setup.WorkspaceID, "Test Borrower", nil, nil, nil)
		borrowerID := testBorrower.ID()

		mockSvc.On("GetByID", mock.Anything, borrowerID, setup.WorkspaceID).
			Return(testBorrower, nil).Once()

		rec := setup.Get(fmt.Sprintf("/borrowers/%s", borrowerID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when borrower not found", func(t *testing.T) {
		borrowerID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, borrowerID, setup.WorkspaceID).
			Return(nil, borrower.ErrBorrowerNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/borrowers/%s", borrowerID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestBorrowerHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	borrower.RegisterRoutes(setup.API, mockSvc)

	t.Run("updates borrower successfully", func(t *testing.T) {
		email := "updated@example.com"
		testBorrower, _ := borrower.NewBorrower(setup.WorkspaceID, "Updated Name", &email, nil, nil)
		borrowerID := testBorrower.ID()

		mockSvc.On("Update", mock.Anything, borrowerID, setup.WorkspaceID, mock.Anything).
			Return(testBorrower, nil).Once()

		body := `{"name":"Updated Name","email":"updated@example.com"}`
		rec := setup.Patch(fmt.Sprintf("/borrowers/%s", borrowerID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when borrower not found", func(t *testing.T) {
		borrowerID := uuid.New()

		mockSvc.On("Update", mock.Anything, borrowerID, setup.WorkspaceID, mock.Anything).
			Return(nil, borrower.ErrBorrowerNotFound).Once()

		body := `{"name":"Updated"}`
		rec := setup.Patch(fmt.Sprintf("/borrowers/%s", borrowerID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty name", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		borrowerID := uuid.New()

		body := `{"name":""}`
		rec := setup.Patch(fmt.Sprintf("/borrowers/%s", borrowerID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 422 for invalid email format", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		borrowerID := uuid.New()

		body := `{"email":"invalid"}`
		rec := setup.Patch(fmt.Sprintf("/borrowers/%s", borrowerID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestBorrowerHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	borrower.RegisterRoutes(setup.API, mockSvc)

	t.Run("deletes borrower successfully", func(t *testing.T) {
		borrowerID := uuid.New()

		mockSvc.On("Archive", mock.Anything, borrowerID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/borrowers/%s", borrowerID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when borrower has active loans", func(t *testing.T) {
		borrowerID := uuid.New()

		mockSvc.On("Archive", mock.Anything, borrowerID, setup.WorkspaceID).
			Return(borrower.ErrHasActiveLoans).Once()

		rec := setup.Delete(fmt.Sprintf("/borrowers/%s", borrowerID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when borrower not found", func(t *testing.T) {
		borrowerID := uuid.New()

		mockSvc.On("Archive", mock.Anything, borrowerID, setup.WorkspaceID).
			Return(borrower.ErrBorrowerNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/borrowers/%s", borrowerID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}
