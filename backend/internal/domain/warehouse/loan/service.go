package loan

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the loan service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Loan, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Loan, error)
	Return(ctx context.Context, id, workspaceID uuid.UUID) (*Loan, error)
	ExtendDueDate(ctx context.Context, id, workspaceID uuid.UUID, newDueDate time.Time) (*Loan, error)
	// Update applies a partial update (due_date and/or notes) to a non-returned
	// loan. Nil pointers mean "unchanged"; non-nil pointers overwrite. Returns
	// ErrLoanNotFound / ErrAlreadyReturned / ErrInvalidDueDate as appropriate.
	Update(ctx context.Context, id, workspaceID uuid.UUID, dueDate *time.Time, notes *string) (*Loan, error)
	List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Loan, int, error)
	ListByBorrower(ctx context.Context, workspaceID, borrowerID uuid.UUID, pagination shared.Pagination) ([]*Loan, error)
	ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*Loan, error)
	GetActiveLoans(ctx context.Context, workspaceID uuid.UUID) ([]*Loan, error)
	GetOverdueLoans(ctx context.Context, workspaceID uuid.UUID) ([]*Loan, error)
}

type Service struct {
	repo          Repository
	inventoryRepo inventory.Repository
}

func NewService(repo Repository, inventoryRepo inventory.Repository) *Service {
	return &Service{
		repo:          repo,
		inventoryRepo: inventoryRepo,
	}
}

type CreateInput struct {
	WorkspaceID uuid.UUID
	InventoryID uuid.UUID
	BorrowerID  uuid.UUID
	Quantity    int
	LoanedAt    time.Time
	DueDate     *time.Time
	Notes       *string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Loan, error) {
	// Validate inventory exists and is available
	inv, err := s.inventoryRepo.FindByID(ctx, input.InventoryID, input.WorkspaceID)
	if err != nil {
		// Repository now returns shared.ErrNotFound instead of nil, nil
		return nil, err
	}

	// Check if inventory is available
	if inv.Status() != inventory.StatusAvailable {
		return nil, ErrInventoryNotAvailable
	}

	// Check if requested quantity is available
	if input.Quantity > inv.Quantity() {
		return nil, ErrQuantityExceedsAvailable
	}

	// Check if there's already an active loan for this inventory
	activeLoan, err := s.repo.FindActiveLoanForInventory(ctx, input.InventoryID)
	if err != nil {
		return nil, err
	}
	if activeLoan != nil {
		return nil, ErrInventoryOnLoan
	}

	// Create the loan
	loan, err := NewLoan(
		input.WorkspaceID,
		input.InventoryID,
		input.BorrowerID,
		input.Quantity,
		input.LoanedAt,
		input.DueDate,
		input.Notes,
	)
	if err != nil {
		return nil, err
	}

	// Update inventory status to ON_LOAN
	if err := inv.UpdateStatus(inventory.StatusOnLoan); err != nil {
		return nil, err
	}
	if err := s.inventoryRepo.Save(ctx, inv); err != nil {
		return nil, err
	}

	// Save the loan
	if err := s.repo.Save(ctx, loan); err != nil {
		return nil, err
	}

	return loan, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Loan, error) {
	loan, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		// Repository now returns shared.ErrNotFound instead of nil, nil
		return nil, err
	}
	return loan, nil
}

func (s *Service) Return(ctx context.Context, id, workspaceID uuid.UUID) (*Loan, error) {
	loan, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := loan.Return(); err != nil {
		return nil, err
	}

	// Update inventory status back to AVAILABLE
	inv, err := s.inventoryRepo.FindByID(ctx, loan.InventoryID(), workspaceID)
	if err != nil {
		return nil, err
	}
	if inv != nil {
		if err := inv.UpdateStatus(inventory.StatusAvailable); err != nil {
			return nil, err
		}
		if err := s.inventoryRepo.Save(ctx, inv); err != nil {
			return nil, err
		}
	}

	if err := s.repo.Save(ctx, loan); err != nil {
		return nil, err
	}

	return loan, nil
}

func (s *Service) ExtendDueDate(ctx context.Context, id, workspaceID uuid.UUID, newDueDate time.Time) (*Loan, error) {
	loan, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := loan.ExtendDueDate(newDueDate); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, loan); err != nil {
		return nil, err
	}

	return loan, nil
}

// Update applies an optional new due date and/or new notes to a non-returned
// loan, workspace-scoped. Nil pointers mean "unchanged"; non-nil pointers
// overwrite (pass pointer-to-empty-string to clear notes).
func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, dueDate *time.Time, notes *string) (*Loan, error) {
	// Defence in depth: GetByID enforces workspace scoping and translates
	// shared.ErrNotFound → not-found semantics for the handler.
	loan, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		if errors.Is(err, shared.ErrNotFound) {
			return nil, ErrLoanNotFound
		}
		return nil, err
	}

	// Domain invariants (returned, due-date-vs-loaned-at) enforced by entity.
	if err := loan.Update(dueDate, notes); err != nil {
		return nil, err
	}

	// Persist via workspace-scoped SQL (belt + suspenders).
	setDueDate := dueDate != nil
	setNotes := notes != nil
	updated, err := s.repo.Update(ctx, id, workspaceID, setDueDate, dueDate, setNotes, notes)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Service) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Loan, int, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID, pagination)
}

func (s *Service) ListByBorrower(ctx context.Context, workspaceID, borrowerID uuid.UUID, pagination shared.Pagination) ([]*Loan, error) {
	return s.repo.FindByBorrower(ctx, workspaceID, borrowerID, pagination)
}

func (s *Service) ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*Loan, error) {
	return s.repo.FindByInventory(ctx, workspaceID, inventoryID)
}

func (s *Service) GetActiveLoans(ctx context.Context, workspaceID uuid.UUID) ([]*Loan, error) {
	return s.repo.FindActiveLoans(ctx, workspaceID)
}

func (s *Service) GetOverdueLoans(ctx context.Context, workspaceID uuid.UUID) ([]*Loan, error) {
	return s.repo.FindOverdueLoans(ctx, workspaceID)
}
