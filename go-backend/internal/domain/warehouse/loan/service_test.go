package loan

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MockRepository is a mock implementation of the loan Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, loan *Loan) error {
	args := m.Called(ctx, loan)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Loan, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Loan), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Loan, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*Loan), args.Int(1), args.Error(2)
}

func (m *MockRepository) FindByBorrower(ctx context.Context, workspaceID, borrowerID uuid.UUID, pagination shared.Pagination) ([]*Loan, error) {
	args := m.Called(ctx, workspaceID, borrowerID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Loan), args.Error(1)
}

func (m *MockRepository) FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*Loan, error) {
	args := m.Called(ctx, workspaceID, inventoryID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Loan), args.Error(1)
}

func (m *MockRepository) FindActiveLoans(ctx context.Context, workspaceID uuid.UUID) ([]*Loan, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Loan), args.Error(1)
}

func (m *MockRepository) FindOverdueLoans(ctx context.Context, workspaceID uuid.UUID) ([]*Loan, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Loan), args.Error(1)
}

func (m *MockRepository) FindActiveLoanForInventory(ctx context.Context, inventoryID uuid.UUID) (*Loan, error) {
	args := m.Called(ctx, inventoryID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Loan), args.Error(1)
}

func (m *MockRepository) GetTotalLoanedQuantity(ctx context.Context, inventoryID uuid.UUID) (int, error) {
	args := m.Called(ctx, inventoryID)
	return args.Int(0), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// MockInventoryRepository is a mock implementation of the inventory Repository interface
type MockInventoryRepository struct {
	mock.Mock
}

func (m *MockInventoryRepository) Save(ctx context.Context, inv *inventory.Inventory) error {
	args := m.Called(ctx, inv)
	return args.Error(0)
}

func (m *MockInventoryRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, itemID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, locationID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) FindByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, containerID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) FindAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, itemID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Int(0), args.Error(1)
}

func (m *MockInventoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// Helper functions
func ptrString(s string) *string {
	return &s
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

// Helper to create test inventory
func createTestInventory(id, workspaceID, itemID, locationID uuid.UUID, quantity int, status inventory.Status) *inventory.Inventory {
	now := time.Now()
	return inventory.Reconstruct(
		id, workspaceID, itemID, locationID,
		nil, // containerID
		quantity,
		inventory.ConditionGood,
		status,
		nil, nil, nil, nil, nil, nil, // optional fields
		false, now, now,
	)
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewLoan(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now()
	dueDate := loanedAt.AddDate(0, 1, 0) // One month from now

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		inventoryID uuid.UUID
		borrowerID  uuid.UUID
		quantity    int
		loanedAt    time.Time
		dueDate     *time.Time
		notes       *string
		expectError bool
		errorType   error
		errorField  string
	}{
		{
			testName:    "valid loan with all fields",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    1,
			loanedAt:    loanedAt,
			dueDate:     &dueDate,
			notes:       ptrString("Loan notes"),
			expectError: false,
		},
		{
			testName:    "valid loan without due date",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    5,
			loanedAt:    loanedAt,
			dueDate:     nil,
			notes:       nil,
			expectError: false,
		},
		{
			testName:    "valid loan with large quantity",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    100,
			loanedAt:    loanedAt,
			dueDate:     nil,
			notes:       nil,
			expectError: false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    1,
			loanedAt:    loanedAt,
			dueDate:     nil,
			notes:       nil,
			expectError: true,
			errorField:  "workspace_id",
		},
		{
			testName:    "invalid inventory ID",
			workspaceID: workspaceID,
			inventoryID: uuid.Nil,
			borrowerID:  borrowerID,
			quantity:    1,
			loanedAt:    loanedAt,
			dueDate:     nil,
			notes:       nil,
			expectError: true,
			errorField:  "inventory_id",
		},
		{
			testName:    "invalid borrower ID",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  uuid.Nil,
			quantity:    1,
			loanedAt:    loanedAt,
			dueDate:     nil,
			notes:       nil,
			expectError: true,
			errorField:  "borrower_id",
		},
		{
			testName:    "zero quantity",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    0,
			loanedAt:    loanedAt,
			dueDate:     nil,
			notes:       nil,
			expectError: true,
			errorType:   ErrInvalidQuantity,
		},
		{
			testName:    "negative quantity",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    -5,
			loanedAt:    loanedAt,
			dueDate:     nil,
			notes:       nil,
			expectError: true,
			errorType:   ErrInvalidQuantity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			loan, err := NewLoan(
				tt.workspaceID,
				tt.inventoryID,
				tt.borrowerID,
				tt.quantity,
				tt.loanedAt,
				tt.dueDate,
				tt.notes,
			)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loan)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, loan)
				assert.NotEqual(t, uuid.Nil, loan.ID())
				assert.Equal(t, tt.workspaceID, loan.WorkspaceID())
				assert.Equal(t, tt.inventoryID, loan.InventoryID())
				assert.Equal(t, tt.borrowerID, loan.BorrowerID())
				assert.Equal(t, tt.quantity, loan.Quantity())
				assert.Equal(t, tt.loanedAt, loan.LoanedAt())
				assert.Equal(t, tt.dueDate, loan.DueDate())
				assert.Equal(t, tt.notes, loan.Notes())
				assert.Nil(t, loan.ReturnedAt())
				assert.True(t, loan.IsActive())
				assert.False(t, loan.CreatedAt().IsZero())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now().AddDate(0, -1, 0)
	dueDate := time.Now().AddDate(0, 0, 7)
	returnedAt := time.Now()
	now := time.Now()

	loan := Reconstruct(
		id,
		workspaceID,
		inventoryID,
		borrowerID,
		3,
		loanedAt,
		&dueDate,
		&returnedAt,
		ptrString("Test notes"),
		now,
		now,
	)

	assert.Equal(t, id, loan.ID())
	assert.Equal(t, workspaceID, loan.WorkspaceID())
	assert.Equal(t, inventoryID, loan.InventoryID())
	assert.Equal(t, borrowerID, loan.BorrowerID())
	assert.Equal(t, 3, loan.Quantity())
	assert.Equal(t, loanedAt, loan.LoanedAt())
	assert.Equal(t, dueDate, *loan.DueDate())
	assert.Equal(t, returnedAt, *loan.ReturnedAt())
	assert.Equal(t, "Test notes", *loan.Notes())
	assert.False(t, loan.IsActive()) // Has returnedAt, so not active
}

func TestReconstruct_ActiveLoan(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	loanedAt := time.Now().AddDate(0, -1, 0)
	now := time.Now()

	loan := Reconstruct(
		id,
		workspaceID,
		inventoryID,
		borrowerID,
		1,
		loanedAt,
		nil, // no due date
		nil, // not returned
		nil, // no notes
		now,
		now,
	)

	assert.True(t, loan.IsActive())
	assert.Nil(t, loan.DueDate())
	assert.Nil(t, loan.ReturnedAt())
	assert.Nil(t, loan.Notes())
}

func TestLoan_IsActive(t *testing.T) {
	now := time.Now()

	tests := []struct {
		testName   string
		returnedAt *time.Time
		expected   bool
	}{
		{"active loan", nil, true},
		{"returned loan", &now, false},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			loan := Reconstruct(
				uuid.New(), uuid.New(), uuid.New(), uuid.New(),
				1, now, nil, tt.returnedAt, nil, now, now,
			)
			assert.Equal(t, tt.expected, loan.IsActive())
		})
	}
}

func TestLoan_IsOverdue(t *testing.T) {
	now := time.Now()
	past := now.AddDate(0, 0, -7)  // 7 days ago
	future := now.AddDate(0, 0, 7) // 7 days from now

	tests := []struct {
		testName   string
		dueDate    *time.Time
		returnedAt *time.Time
		expected   bool
	}{
		{"no due date - not overdue", nil, nil, false},
		{"future due date - not overdue", &future, nil, false},
		{"past due date - overdue", &past, nil, true},
		{"past due date but returned - not overdue", &past, &now, false},
		{"future due date and returned - not overdue", &future, &now, false},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			loan := Reconstruct(
				uuid.New(), uuid.New(), uuid.New(), uuid.New(),
				1, now, tt.dueDate, tt.returnedAt, nil, now, now,
			)
			assert.Equal(t, tt.expected, loan.IsOverdue())
		})
	}
}

func TestLoan_Return(t *testing.T) {
	now := time.Now()

	t.Run("successful return", func(t *testing.T) {
		loan := Reconstruct(
			uuid.New(), uuid.New(), uuid.New(), uuid.New(),
			1, now, nil, nil, nil, now, now,
		)
		assert.True(t, loan.IsActive())

		err := loan.Return()

		assert.NoError(t, err)
		assert.False(t, loan.IsActive())
		assert.NotNil(t, loan.ReturnedAt())
	})

	t.Run("already returned", func(t *testing.T) {
		returnedAt := now.AddDate(0, 0, -1)
		loan := Reconstruct(
			uuid.New(), uuid.New(), uuid.New(), uuid.New(),
			1, now, nil, &returnedAt, nil, now, now,
		)
		assert.False(t, loan.IsActive())

		err := loan.Return()

		assert.Error(t, err)
		assert.Equal(t, ErrAlreadyReturned, err)
	})
}

func TestLoan_ExtendDueDate(t *testing.T) {
	now := time.Now()
	newDueDate := now.AddDate(0, 2, 0) // 2 months from now

	t.Run("successful extension", func(t *testing.T) {
		loan := Reconstruct(
			uuid.New(), uuid.New(), uuid.New(), uuid.New(),
			1, now, nil, nil, nil, now, now,
		)
		originalUpdatedAt := loan.UpdatedAt()
		time.Sleep(time.Millisecond)

		err := loan.ExtendDueDate(newDueDate)

		assert.NoError(t, err)
		assert.Equal(t, newDueDate, *loan.DueDate())
		assert.True(t, loan.UpdatedAt().After(originalUpdatedAt))
	})

	t.Run("cannot extend returned loan", func(t *testing.T) {
		returnedAt := now.AddDate(0, 0, -1)
		loan := Reconstruct(
			uuid.New(), uuid.New(), uuid.New(), uuid.New(),
			1, now, nil, &returnedAt, nil, now, now,
		)

		err := loan.ExtendDueDate(newDueDate)

		assert.Error(t, err)
		assert.Equal(t, ErrAlreadyReturned, err)
	})
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	loanedAt := time.Now()
	dueDate := loanedAt.AddDate(0, 1, 0)

	tests := []struct {
		testName    string
		input       CreateInput
		setupMock   func(*MockRepository, *MockInventoryRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful creation",
			input: CreateInput{
				WorkspaceID: workspaceID,
				InventoryID: inventoryID,
				BorrowerID:  borrowerID,
				Quantity:    1,
				LoanedAt:    loanedAt,
				DueDate:     &dueDate,
				Notes:       ptrString("Test loan"),
			},
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				inv := createTestInventory(inventoryID, workspaceID, itemID, locationID, 10, inventory.StatusAvailable)
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
				loanRepo.On("FindActiveLoanForInventory", ctx, inventoryID).Return(nil, nil)
				invRepo.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
				loanRepo.On("Save", ctx, mock.AnythingOfType("*loan.Loan")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "inventory not found",
			input: CreateInput{
				WorkspaceID: workspaceID,
				InventoryID: uuid.New(),
				BorrowerID:  borrowerID,
				Quantity:    1,
				LoanedAt:    loanedAt,
			},
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				invRepo.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
		},
		{
			testName: "inventory not available",
			input: CreateInput{
				WorkspaceID: workspaceID,
				InventoryID: inventoryID,
				BorrowerID:  borrowerID,
				Quantity:    1,
				LoanedAt:    loanedAt,
			},
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				inv := createTestInventory(inventoryID, workspaceID, itemID, locationID, 10, inventory.StatusOnLoan)
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
			},
			expectError: true,
			errorType:   ErrInventoryNotAvailable,
		},
		{
			testName: "quantity exceeds available",
			input: CreateInput{
				WorkspaceID: workspaceID,
				InventoryID: inventoryID,
				BorrowerID:  borrowerID,
				Quantity:    100, // More than available
				LoanedAt:    loanedAt,
			},
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				inv := createTestInventory(inventoryID, workspaceID, itemID, locationID, 10, inventory.StatusAvailable)
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
			},
			expectError: true,
			errorType:   ErrQuantityExceedsAvailable,
		},
		{
			testName: "inventory already on loan",
			input: CreateInput{
				WorkspaceID: workspaceID,
				InventoryID: inventoryID,
				BorrowerID:  borrowerID,
				Quantity:    1,
				LoanedAt:    loanedAt,
			},
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				inv := createTestInventory(inventoryID, workspaceID, itemID, locationID, 10, inventory.StatusAvailable)
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
				existingLoan := &Loan{id: uuid.New(), inventoryID: inventoryID}
				loanRepo.On("FindActiveLoanForInventory", ctx, inventoryID).Return(existingLoan, nil)
			},
			expectError: true,
			errorType:   ErrInventoryOnLoan,
		},
		{
			testName: "invalid quantity",
			input: CreateInput{
				WorkspaceID: workspaceID,
				InventoryID: inventoryID,
				BorrowerID:  borrowerID,
				Quantity:    0, // Invalid
				LoanedAt:    loanedAt,
			},
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				inv := createTestInventory(inventoryID, workspaceID, itemID, locationID, 10, inventory.StatusAvailable)
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
				loanRepo.On("FindActiveLoanForInventory", ctx, inventoryID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInvalidQuantity,
		},
		{
			testName: "inventory repo returns error",
			input: CreateInput{
				WorkspaceID: workspaceID,
				InventoryID: inventoryID,
				BorrowerID:  borrowerID,
				Quantity:    1,
				LoanedAt:    loanedAt,
			},
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
		{
			testName: "loan save returns error",
			input: CreateInput{
				WorkspaceID: workspaceID,
				InventoryID: inventoryID,
				BorrowerID:  borrowerID,
				Quantity:    1,
				LoanedAt:    loanedAt,
			},
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				inv := createTestInventory(inventoryID, workspaceID, itemID, locationID, 10, inventory.StatusAvailable)
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
				loanRepo.On("FindActiveLoanForInventory", ctx, inventoryID).Return(nil, nil)
				invRepo.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
				loanRepo.On("Save", ctx, mock.AnythingOfType("*loan.Loan")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo, mockInvRepo)

			loan, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loan)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, loan)
				assert.Equal(t, tt.input.WorkspaceID, loan.WorkspaceID())
				assert.Equal(t, tt.input.InventoryID, loan.InventoryID())
				assert.Equal(t, tt.input.BorrowerID, loan.BorrowerID())
				assert.Equal(t, tt.input.Quantity, loan.Quantity())
				assert.True(t, loan.IsActive())
			}

			mockLoanRepo.AssertExpectations(t)
			mockInvRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	loanID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		loanID      uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "loan found",
			loanID:      loanID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				loan := &Loan{id: loanID, workspaceID: workspaceID, quantity: 1}
				m.On("FindByID", ctx, loanID, workspaceID).Return(loan, nil)
			},
			expectError: false,
		},
		{
			testName:    "loan not found",
			loanID:      loanID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, loanID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrLoanNotFound,
		},
		{
			testName:    "repository returns error",
			loanID:      loanID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, loanID, workspaceID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo)

			loan, err := svc.GetByID(ctx, tt.loanID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loan)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, loan)
				assert.Equal(t, tt.loanID, loan.ID())
			}

			mockLoanRepo.AssertExpectations(t)
		})
	}
}

func TestService_Return(t *testing.T) {
	ctx := context.Background()
	loanID := uuid.New()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository, *MockInventoryRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful return",
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				loan := Reconstruct(
					loanID, workspaceID, inventoryID, uuid.New(),
					1, now, nil, nil, nil, now, now,
				)
				loanRepo.On("FindByID", ctx, loanID, workspaceID).Return(loan, nil)
				inv := createTestInventory(inventoryID, workspaceID, itemID, locationID, 10, inventory.StatusOnLoan)
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
				invRepo.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
				loanRepo.On("Save", ctx, mock.AnythingOfType("*loan.Loan")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "loan not found",
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				loanRepo.On("FindByID", ctx, loanID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrLoanNotFound,
		},
		{
			testName: "already returned",
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				returnedAt := now.AddDate(0, 0, -1)
				loan := Reconstruct(
					loanID, workspaceID, inventoryID, uuid.New(),
					1, now, nil, &returnedAt, nil, now, now,
				)
				loanRepo.On("FindByID", ctx, loanID, workspaceID).Return(loan, nil)
			},
			expectError: true,
			errorType:   ErrAlreadyReturned,
		},
		{
			testName: "loan save returns error",
			setupMock: func(loanRepo *MockRepository, invRepo *MockInventoryRepository) {
				loan := Reconstruct(
					loanID, workspaceID, inventoryID, uuid.New(),
					1, now, nil, nil, nil, now, now,
				)
				loanRepo.On("FindByID", ctx, loanID, workspaceID).Return(loan, nil)
				inv := createTestInventory(inventoryID, workspaceID, itemID, locationID, 10, inventory.StatusOnLoan)
				invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
				invRepo.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
				loanRepo.On("Save", ctx, mock.AnythingOfType("*loan.Loan")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo, mockInvRepo)

			loan, err := svc.Return(ctx, loanID, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loan)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, loan)
				assert.False(t, loan.IsActive())
				assert.NotNil(t, loan.ReturnedAt())
			}

			mockLoanRepo.AssertExpectations(t)
			mockInvRepo.AssertExpectations(t)
		})
	}
}

func TestService_ExtendDueDate(t *testing.T) {
	ctx := context.Background()
	loanID := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()
	newDueDate := now.AddDate(0, 2, 0)

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful extension",
			setupMock: func(m *MockRepository) {
				loan := Reconstruct(
					loanID, workspaceID, uuid.New(), uuid.New(),
					1, now, nil, nil, nil, now, now,
				)
				m.On("FindByID", ctx, loanID, workspaceID).Return(loan, nil)
				m.On("Save", ctx, mock.AnythingOfType("*loan.Loan")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "loan not found",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, loanID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrLoanNotFound,
		},
		{
			testName: "cannot extend returned loan",
			setupMock: func(m *MockRepository) {
				returnedAt := now.AddDate(0, 0, -1)
				loan := Reconstruct(
					loanID, workspaceID, uuid.New(), uuid.New(),
					1, now, nil, &returnedAt, nil, now, now,
				)
				m.On("FindByID", ctx, loanID, workspaceID).Return(loan, nil)
			},
			expectError: true,
			errorType:   ErrAlreadyReturned,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo)

			loan, err := svc.ExtendDueDate(ctx, loanID, workspaceID, newDueDate)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loan)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, loan)
				assert.Equal(t, newDueDate, *loan.DueDate())
			}

			mockLoanRepo.AssertExpectations(t)
		})
	}
}

func TestService_List(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectTotal int
		expectError bool
	}{
		{
			testName:   "list with results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				loans := []*Loan{
					{id: uuid.New(), workspaceID: workspaceID, quantity: 1},
					{id: uuid.New(), workspaceID: workspaceID, quantity: 2},
				}
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(loans, 2, nil)
			},
			expectLen:   2,
			expectTotal: 2,
			expectError: false,
		},
		{
			testName:   "empty results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return([]*Loan{}, 0, nil)
			},
			expectLen:   0,
			expectTotal: 0,
			expectError: false,
		},
		{
			testName:   "repository returns error",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, 0, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo)

			loans, total, err := svc.List(ctx, workspaceID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loans)
			} else {
				assert.NoError(t, err)
				assert.Len(t, loans, tt.expectLen)
				assert.Equal(t, tt.expectTotal, total)
			}

			mockLoanRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByBorrower(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	borrowerID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "list with results",
			setupMock: func(m *MockRepository) {
				loans := []*Loan{
					{id: uuid.New(), workspaceID: workspaceID, borrowerID: borrowerID, quantity: 1},
					{id: uuid.New(), workspaceID: workspaceID, borrowerID: borrowerID, quantity: 2},
				}
				m.On("FindByBorrower", ctx, workspaceID, borrowerID, shared.Pagination{Page: 1, PageSize: 10}).Return(loans, nil)
			},
			expectLen:   2,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindByBorrower", ctx, workspaceID, borrowerID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo)

			loans, err := svc.ListByBorrower(ctx, workspaceID, borrowerID, shared.Pagination{Page: 1, PageSize: 10})

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loans)
			} else {
				assert.NoError(t, err)
				assert.Len(t, loans, tt.expectLen)
			}

			mockLoanRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByInventory(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "list with results",
			setupMock: func(m *MockRepository) {
				loans := []*Loan{
					{id: uuid.New(), workspaceID: workspaceID, inventoryID: inventoryID, quantity: 1},
				}
				m.On("FindByInventory", ctx, workspaceID, inventoryID).Return(loans, nil)
			},
			expectLen:   1,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindByInventory", ctx, workspaceID, inventoryID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo)

			loans, err := svc.ListByInventory(ctx, workspaceID, inventoryID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loans)
			} else {
				assert.NoError(t, err)
				assert.Len(t, loans, tt.expectLen)
			}

			mockLoanRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetActiveLoans(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "active loans found",
			setupMock: func(m *MockRepository) {
				loans := []*Loan{
					{id: uuid.New(), workspaceID: workspaceID, quantity: 1},
					{id: uuid.New(), workspaceID: workspaceID, quantity: 2},
					{id: uuid.New(), workspaceID: workspaceID, quantity: 3},
				}
				m.On("FindActiveLoans", ctx, workspaceID).Return(loans, nil)
			},
			expectLen:   3,
			expectError: false,
		},
		{
			testName: "no active loans",
			setupMock: func(m *MockRepository) {
				m.On("FindActiveLoans", ctx, workspaceID).Return([]*Loan{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindActiveLoans", ctx, workspaceID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo)

			loans, err := svc.GetActiveLoans(ctx, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loans)
			} else {
				assert.NoError(t, err)
				assert.Len(t, loans, tt.expectLen)
			}

			mockLoanRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetOverdueLoans(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "overdue loans found",
			setupMock: func(m *MockRepository) {
				loans := []*Loan{
					{id: uuid.New(), workspaceID: workspaceID, quantity: 1},
				}
				m.On("FindOverdueLoans", ctx, workspaceID).Return(loans, nil)
			},
			expectLen:   1,
			expectError: false,
		},
		{
			testName: "no overdue loans",
			setupMock: func(m *MockRepository) {
				m.On("FindOverdueLoans", ctx, workspaceID).Return([]*Loan{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindOverdueLoans", ctx, workspaceID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockLoanRepo := new(MockRepository)
			mockInvRepo := new(MockInventoryRepository)
			svc := NewService(mockLoanRepo, mockInvRepo)

			tt.setupMock(mockLoanRepo)

			loans, err := svc.GetOverdueLoans(ctx, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, loans)
			} else {
				assert.NoError(t, err)
				assert.Len(t, loans, tt.expectLen)
			}

			mockLoanRepo.AssertExpectations(t)
		})
	}
}
