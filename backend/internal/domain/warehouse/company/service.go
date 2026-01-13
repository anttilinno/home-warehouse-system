package company

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the company service operations.
type ServiceInterface interface {
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*Company], error)
	Create(ctx context.Context, input CreateInput) (*Company, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Company, error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Company, error)
	Archive(ctx context.Context, id, workspaceID uuid.UUID) error
	Restore(ctx context.Context, id, workspaceID uuid.UUID) error
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*Company], error) {
	companies, total, err := s.repo.FindByWorkspace(ctx, workspaceID, pagination)
	if err != nil {
		return nil, err
	}

	result := shared.NewPagedResult(companies, total, pagination)
	return &result, nil
}

type CreateInput struct {
	WorkspaceID    uuid.UUID
	Name           string
	Website, Notes *string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Company, error) {
	exists, err := s.repo.NameExists(ctx, input.WorkspaceID, input.Name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrNameTaken
	}

	company, err := NewCompany(input.WorkspaceID, input.Name, input.Website, input.Notes)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, company); err != nil {
		return nil, err
	}

	return company, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Company, error) {
	company, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if company == nil {
		return nil, ErrCompanyNotFound
	}
	return company, nil
}

type UpdateInput struct {
	Name    string
	Website *string
	Notes   *string
}

func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Company, error) {
	company, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := company.Update(input.Name, input.Website, input.Notes); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, company); err != nil {
		return nil, err
	}

	return company, nil
}

func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	company, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	company.Archive()
	return s.repo.Save(ctx, company)
}

func (s *Service) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	company, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	company.Restore()
	return s.repo.Save(ctx, company)
}

func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	company, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	return s.repo.Delete(ctx, company.ID())
}
