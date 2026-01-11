package container

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	WorkspaceID                      uuid.UUID
	LocationID                       uuid.UUID
	Name                             string
	Description, Capacity, ShortCode *string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Container, error) {
	if input.ShortCode != nil && *input.ShortCode != "" {
		exists, err := s.repo.ShortCodeExists(ctx, input.WorkspaceID, *input.ShortCode)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrShortCodeTaken
		}
	}

	container, err := NewContainer(input.WorkspaceID, input.LocationID, input.Name, input.Description, input.Capacity, input.ShortCode)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, container); err != nil {
		return nil, err
	}

	return container, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Container, error) {
	container, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if container == nil {
		return nil, ErrContainerNotFound
	}
	return container, nil
}

func (s *Service) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*Container], error) {
	containers, total, err := s.repo.FindByWorkspace(ctx, workspaceID, pagination)
	if err != nil {
		return nil, err
	}

	result := shared.NewPagedResult(containers, total, pagination)
	return &result, nil
}

type UpdateInput struct {
	Name        string
	LocationID  uuid.UUID
	Description *string
	Capacity    *string
}

func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Container, error) {
	container, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := container.Update(input.Name, input.LocationID, input.Description, input.Capacity); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, container); err != nil {
		return nil, err
	}

	return container, nil
}

func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	container, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	container.Archive()
	return s.repo.Save(ctx, container)
}

func (s *Service) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	container, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	container.Restore()
	return s.repo.Save(ctx, container)
}

func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	container, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	return s.repo.Delete(ctx, container.ID())
}
