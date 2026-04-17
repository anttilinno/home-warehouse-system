package loan

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, loan *Loan) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Loan, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Loan, int, error)
	FindByBorrower(ctx context.Context, workspaceID, borrowerID uuid.UUID, pagination shared.Pagination) ([]*Loan, error)
	FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*Loan, error)
	FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*Loan, error)
	FindActiveLoans(ctx context.Context, workspaceID uuid.UUID) ([]*Loan, error)
	FindOverdueLoans(ctx context.Context, workspaceID uuid.UUID) ([]*Loan, error)
	FindActiveLoanForInventory(ctx context.Context, inventoryID uuid.UUID) (*Loan, error)
	GetTotalLoanedQuantity(ctx context.Context, inventoryID uuid.UUID) (int, error)
	Delete(ctx context.Context, id uuid.UUID) error
	// Update applies a partial update to a loan scoped by (id, workspaceID).
	// setDueDate/setNotes flags distinguish "unchanged" (false) from "explicitly set"
	// (true, with the value in dueDate/notes; pass nil to clear).
	Update(ctx context.Context, loanID, workspaceID uuid.UUID, setDueDate bool, dueDate *time.Time, setNotes bool, notes *string) (*Loan, error)
}
