package loan

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Loan struct {
	id          uuid.UUID
	workspaceID uuid.UUID
	inventoryID uuid.UUID
	borrowerID  uuid.UUID
	quantity    int
	loanedAt    time.Time
	dueDate     *time.Time
	returnedAt  *time.Time
	notes       *string
	createdAt   time.Time
	updatedAt   time.Time
}

func NewLoan(
	workspaceID, inventoryID, borrowerID uuid.UUID,
	quantity int,
	loanedAt time.Time,
	dueDate *time.Time,
	notes *string,
) (*Loan, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(inventoryID, "inventory_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(borrowerID, "borrower_id"); err != nil {
		return nil, err
	}
	if quantity <= 0 {
		return nil, ErrInvalidQuantity
	}

	now := time.Now()
	return &Loan{
		id:          shared.NewUUID(),
		workspaceID: workspaceID,
		inventoryID: inventoryID,
		borrowerID:  borrowerID,
		quantity:    quantity,
		loanedAt:    loanedAt,
		dueDate:     dueDate,
		returnedAt:  nil,
		notes:       notes,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

func Reconstruct(
	id, workspaceID, inventoryID, borrowerID uuid.UUID,
	quantity int,
	loanedAt time.Time,
	dueDate, returnedAt *time.Time,
	notes *string,
	createdAt, updatedAt time.Time,
) *Loan {
	return &Loan{
		id:          id,
		workspaceID: workspaceID,
		inventoryID: inventoryID,
		borrowerID:  borrowerID,
		quantity:    quantity,
		loanedAt:    loanedAt,
		dueDate:     dueDate,
		returnedAt:  returnedAt,
		notes:       notes,
		createdAt:   createdAt,
		updatedAt:   updatedAt,
	}
}

// Getters
func (l *Loan) ID() uuid.UUID          { return l.id }
func (l *Loan) WorkspaceID() uuid.UUID { return l.workspaceID }
func (l *Loan) InventoryID() uuid.UUID { return l.inventoryID }
func (l *Loan) BorrowerID() uuid.UUID  { return l.borrowerID }
func (l *Loan) Quantity() int          { return l.quantity }
func (l *Loan) LoanedAt() time.Time    { return l.loanedAt }
func (l *Loan) DueDate() *time.Time    { return l.dueDate }
func (l *Loan) ReturnedAt() *time.Time { return l.returnedAt }
func (l *Loan) Notes() *string         { return l.notes }
func (l *Loan) CreatedAt() time.Time   { return l.createdAt }
func (l *Loan) UpdatedAt() time.Time   { return l.updatedAt }

func (l *Loan) IsActive() bool {
	return l.returnedAt == nil
}

func (l *Loan) IsOverdue() bool {
	if l.returnedAt != nil || l.dueDate == nil {
		return false
	}
	return time.Now().After(*l.dueDate)
}

func (l *Loan) Return() error {
	if l.returnedAt != nil {
		return ErrAlreadyReturned
	}
	now := time.Now()
	l.returnedAt = &now
	l.updatedAt = now
	return nil
}

func (l *Loan) ExtendDueDate(newDueDate time.Time) error {
	if l.returnedAt != nil {
		return ErrAlreadyReturned
	}
	l.dueDate = &newDueDate
	l.updatedAt = time.Now()
	return nil
}
