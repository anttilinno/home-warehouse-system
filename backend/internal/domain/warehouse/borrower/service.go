package borrower

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the borrower service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Borrower, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Borrower, error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Borrower, error)
	Archive(ctx context.Context, id, workspaceID uuid.UUID) error
	Restore(ctx context.Context, id, workspaceID uuid.UUID) error
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Borrower, int, error)
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Borrower, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	WorkspaceID uuid.UUID
	Name        string
	Email       *string
	Phone       *string
	Notes       *string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Borrower, error) {
	borrower, err := NewBorrower(input.WorkspaceID, input.Name, input.Email, input.Phone, input.Notes)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, borrower); err != nil {
		return nil, err
	}

	return borrower, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Borrower, error) {
	borrower, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if borrower == nil {
		return nil, ErrBorrowerNotFound
	}
	return borrower, nil
}

func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Borrower, error) {
	borrower, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := borrower.Update(input); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, borrower); err != nil {
		return nil, err
	}

	return borrower, nil
}

func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	borrower, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	borrower.Archive()
	return s.repo.Save(ctx, borrower)
}

func (s *Service) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	borrower, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	borrower.Restore()
	return s.repo.Save(ctx, borrower)
}

func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	// Check if borrower exists
	_, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	// Check for active loans
	hasLoans, err := s.repo.HasActiveLoans(ctx, id)
	if err != nil {
		return err
	}
	if hasLoans {
		return ErrHasActiveLoans
	}

	return s.repo.Delete(ctx, id)
}

func (s *Service) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Borrower, int, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID, pagination)
}

// Search searches for borrowers by query string.
func (s *Service) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Borrower, error) {
	if limit <= 0 {
		limit = 50 // Default limit
	}
	return s.repo.Search(ctx, workspaceID, query, limit)
}
