package label

import (
	"context"

	"github.com/google/uuid"
)

// ServiceInterface defines the label service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Label, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Label, error)
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Label, error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Label, error)
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

type CreateInput struct {
	WorkspaceID uuid.UUID
	Name        string
	Color       *string
	Description *string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Label, error) {
	exists, err := s.repo.NameExists(ctx, input.WorkspaceID, input.Name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrNameTaken
	}

	label, err := NewLabel(input.WorkspaceID, input.Name, input.Color, input.Description)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, label); err != nil {
		return nil, err
	}

	return label, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Label, error) {
	label, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if label == nil {
		return nil, ErrLabelNotFound
	}
	return label, nil
}

func (s *Service) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Label, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID)
}

type UpdateInput struct {
	Name        string
	Color       *string
	Description *string
}

func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Label, error) {
	label, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	// Check if name is being changed and if the new name is already taken
	if label.Name() != input.Name {
		exists, err := s.repo.NameExists(ctx, workspaceID, input.Name)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrNameTaken
		}
	}

	if err := label.Update(input.Name, input.Color, input.Description); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, label); err != nil {
		return nil, err
	}

	return label, nil
}

func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	label, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	label.Archive()
	return s.repo.Save(ctx, label)
}

func (s *Service) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	label, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	label.Restore()
	return s.repo.Save(ctx, label)
}

func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	label, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	return s.repo.Delete(ctx, label.ID())
}
