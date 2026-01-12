package loan_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
)

func TestNewLoan(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now()
	dueDate := now.Add(7 * 24 * time.Hour)
	notes := "Test loan notes"

	tests := []struct {
		name        string
		workspaceID uuid.UUID
		inventoryID uuid.UUID
		borrowerID  uuid.UUID
		quantity    int
		loanedAt    time.Time
		dueDate     *time.Time
		notes       *string
		wantErr     bool
		errMsg      string
	}{
		{
			name:        "valid loan with all fields",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    5,
			loanedAt:    now,
			dueDate:     &dueDate,
			notes:       &notes,
			wantErr:     false,
		},
		{
			name:        "valid loan without due date",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    1,
			loanedAt:    now,
			dueDate:     nil,
			notes:       nil,
			wantErr:     false,
		},
		{
			name:        "valid loan without notes",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    3,
			loanedAt:    now,
			dueDate:     &dueDate,
			notes:       nil,
			wantErr:     false,
		},
		{
			name:        "nil workspace ID",
			workspaceID: uuid.Nil,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    5,
			loanedAt:    now,
			dueDate:     &dueDate,
			notes:       nil,
			wantErr:     true,
			errMsg:      "workspace_id",
		},
		{
			name:        "nil inventory ID",
			workspaceID: workspaceID,
			inventoryID: uuid.Nil,
			borrowerID:  borrowerID,
			quantity:    5,
			loanedAt:    now,
			dueDate:     &dueDate,
			notes:       nil,
			wantErr:     true,
			errMsg:      "inventory_id",
		},
		{
			name:        "nil borrower ID",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  uuid.Nil,
			quantity:    5,
			loanedAt:    now,
			dueDate:     &dueDate,
			notes:       nil,
			wantErr:     true,
			errMsg:      "borrower_id",
		},
		{
			name:        "zero quantity",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    0,
			loanedAt:    now,
			dueDate:     &dueDate,
			notes:       nil,
			wantErr:     true,
			errMsg:      "loan quantity must be greater than zero",
		},
		{
			name:        "negative quantity",
			workspaceID: workspaceID,
			inventoryID: inventoryID,
			borrowerID:  borrowerID,
			quantity:    -5,
			loanedAt:    now,
			dueDate:     &dueDate,
			notes:       nil,
			wantErr:     true,
			errMsg:      "loan quantity must be greater than zero",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loanItem, err := loan.NewLoan(
				tt.workspaceID,
				tt.inventoryID,
				tt.borrowerID,
				tt.quantity,
				tt.loanedAt,
				tt.dueDate,
				tt.notes,
			)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, loanItem)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, loanItem)
				assert.Equal(t, tt.workspaceID, loanItem.WorkspaceID())
				assert.Equal(t, tt.inventoryID, loanItem.InventoryID())
				assert.Equal(t, tt.borrowerID, loanItem.BorrowerID())
				assert.Equal(t, tt.quantity, loanItem.Quantity())
				assert.Equal(t, tt.loanedAt, loanItem.LoanedAt())
				assert.Equal(t, tt.dueDate, loanItem.DueDate())
				assert.Equal(t, tt.notes, loanItem.Notes())
				assert.NotEqual(t, uuid.Nil, loanItem.ID())
				assert.Nil(t, loanItem.ReturnedAt())
				assert.NotZero(t, loanItem.CreatedAt())
				assert.NotZero(t, loanItem.UpdatedAt())
			}
		})
	}
}

func TestLoan_IsActive(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now()

	loanItem, err := loan.NewLoan(
		workspaceID,
		inventoryID,
		borrowerID,
		5,
		now,
		nil,
		nil,
	)
	assert.NoError(t, err)

	// Initially active
	assert.True(t, loanItem.IsActive())

	// After return, not active
	err = loanItem.Return()
	assert.NoError(t, err)
	assert.False(t, loanItem.IsActive())
}

func TestLoan_IsOverdue(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now()

	tests := []struct {
		name       string
		dueDate    *time.Time
		returnedAt *time.Time
		wantResult bool
	}{
		{
			name:       "no due date - not overdue",
			dueDate:    nil,
			returnedAt: nil,
			wantResult: false,
		},
		{
			name: "future due date - not overdue",
			dueDate: func() *time.Time {
				t := now.Add(7 * 24 * time.Hour)
				return &t
			}(),
			returnedAt: nil,
			wantResult: false,
		},
		{
			name: "past due date - overdue",
			dueDate: func() *time.Time {
				t := now.Add(-7 * 24 * time.Hour)
				return &t
			}(),
			returnedAt: nil,
			wantResult: true,
		},
		{
			name: "past due date but returned - not overdue",
			dueDate: func() *time.Time {
				t := now.Add(-7 * 24 * time.Hour)
				return &t
			}(),
			returnedAt: &now,
			wantResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loanItem := loan.Reconstruct(
				uuid.New(),
				workspaceID,
				inventoryID,
				borrowerID,
				5,
				now,
				tt.dueDate,
				tt.returnedAt,
				nil,
				now,
				now,
			)

			assert.Equal(t, tt.wantResult, loanItem.IsOverdue())
		})
	}
}

func TestLoan_Return(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now()

	t.Run("return active loan", func(t *testing.T) {
		loanItem, err := loan.NewLoan(
			workspaceID,
			inventoryID,
			borrowerID,
			5,
			now,
			nil,
			nil,
		)
		assert.NoError(t, err)
		assert.True(t, loanItem.IsActive())
		assert.Nil(t, loanItem.ReturnedAt())

		originalUpdatedAt := loanItem.UpdatedAt()
		time.Sleep(time.Millisecond)

		err = loanItem.Return()
		assert.NoError(t, err)
		assert.False(t, loanItem.IsActive())
		assert.NotNil(t, loanItem.ReturnedAt())
		assert.True(t, loanItem.UpdatedAt().After(originalUpdatedAt))
	})

	t.Run("return already returned loan", func(t *testing.T) {
		loanItem, err := loan.NewLoan(
			workspaceID,
			inventoryID,
			borrowerID,
			5,
			now,
			nil,
			nil,
		)
		assert.NoError(t, err)

		// First return succeeds
		err = loanItem.Return()
		assert.NoError(t, err)

		// Second return fails
		err = loanItem.Return()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "loan has already been returned")
	})
}

func TestLoan_ExtendDueDate(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now()
	originalDueDate := now.Add(7 * 24 * time.Hour)

	t.Run("extend due date of active loan", func(t *testing.T) {
		loanItem, err := loan.NewLoan(
			workspaceID,
			inventoryID,
			borrowerID,
			5,
			now,
			&originalDueDate,
			nil,
		)
		assert.NoError(t, err)

		newDueDate := now.Add(14 * 24 * time.Hour)
		originalUpdatedAt := loanItem.UpdatedAt()
		time.Sleep(time.Millisecond)

		err = loanItem.ExtendDueDate(newDueDate)
		assert.NoError(t, err)
		assert.NotNil(t, loanItem.DueDate())
		assert.Equal(t, newDueDate, *loanItem.DueDate())
		assert.True(t, loanItem.UpdatedAt().After(originalUpdatedAt))
	})

	t.Run("extend due date of loan without original due date", func(t *testing.T) {
		loanItem, err := loan.NewLoan(
			workspaceID,
			inventoryID,
			borrowerID,
			5,
			now,
			nil,
			nil,
		)
		assert.NoError(t, err)
		assert.Nil(t, loanItem.DueDate())

		newDueDate := now.Add(7 * 24 * time.Hour)
		err = loanItem.ExtendDueDate(newDueDate)
		assert.NoError(t, err)
		assert.NotNil(t, loanItem.DueDate())
		assert.Equal(t, newDueDate, *loanItem.DueDate())
	})

	t.Run("extend due date of returned loan", func(t *testing.T) {
		loanItem, err := loan.NewLoan(
			workspaceID,
			inventoryID,
			borrowerID,
			5,
			now,
			&originalDueDate,
			nil,
		)
		assert.NoError(t, err)

		// Return the loan
		err = loanItem.Return()
		assert.NoError(t, err)

		// Try to extend - should fail
		newDueDate := now.Add(14 * 24 * time.Hour)
		err = loanItem.ExtendDueDate(newDueDate)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "loan has already been returned")
	})

	t.Run("extend to earlier date (allowed)", func(t *testing.T) {
		loanItem, err := loan.NewLoan(
			workspaceID,
			inventoryID,
			borrowerID,
			5,
			now,
			&originalDueDate,
			nil,
		)
		assert.NoError(t, err)

		// Move due date earlier (no validation prevents this)
		earlierDate := now.Add(3 * 24 * time.Hour)
		err = loanItem.ExtendDueDate(earlierDate)
		assert.NoError(t, err)
		assert.Equal(t, earlierDate, *loanItem.DueDate())
	})
}

func TestLoan_Getters(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now()
	dueDate := now.Add(7 * 24 * time.Hour)
	notes := "Test loan notes"

	loanItem, err := loan.NewLoan(
		workspaceID,
		inventoryID,
		borrowerID,
		5,
		now,
		&dueDate,
		&notes,
	)
	assert.NoError(t, err)

	// Test all getters
	assert.NotEqual(t, uuid.Nil, loanItem.ID())
	assert.Equal(t, workspaceID, loanItem.WorkspaceID())
	assert.Equal(t, inventoryID, loanItem.InventoryID())
	assert.Equal(t, borrowerID, loanItem.BorrowerID())
	assert.Equal(t, 5, loanItem.Quantity())
	assert.Equal(t, now, loanItem.LoanedAt())
	assert.Equal(t, &dueDate, loanItem.DueDate())
	assert.Equal(t, &notes, loanItem.Notes())
	assert.Nil(t, loanItem.ReturnedAt())
	assert.NotZero(t, loanItem.CreatedAt())
	assert.NotZero(t, loanItem.UpdatedAt())
}

func TestLoan_Reconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now()
	loanedAt := now.Add(-10 * 24 * time.Hour)
	dueDate := now.Add(-3 * 24 * time.Hour)
	returnedAt := now.Add(-1 * 24 * time.Hour)
	notes := "Reconstructed loan"

	reconstructed := loan.Reconstruct(
		id,
		workspaceID,
		inventoryID,
		borrowerID,
		10,
		loanedAt,
		&dueDate,
		&returnedAt,
		&notes,
		now,
		now,
	)

	assert.NotNil(t, reconstructed)
	assert.Equal(t, id, reconstructed.ID())
	assert.Equal(t, workspaceID, reconstructed.WorkspaceID())
	assert.Equal(t, inventoryID, reconstructed.InventoryID())
	assert.Equal(t, borrowerID, reconstructed.BorrowerID())
	assert.Equal(t, 10, reconstructed.Quantity())
	assert.Equal(t, loanedAt, reconstructed.LoanedAt())
	assert.Equal(t, &dueDate, reconstructed.DueDate())
	assert.Equal(t, &returnedAt, reconstructed.ReturnedAt())
	assert.Equal(t, &notes, reconstructed.Notes())
	assert.Equal(t, now, reconstructed.CreatedAt())
	assert.Equal(t, now, reconstructed.UpdatedAt())

	// Test state methods with reconstructed loan
	assert.False(t, reconstructed.IsActive())      // returned
	assert.False(t, reconstructed.IsOverdue())     // returned loans are not overdue
}
