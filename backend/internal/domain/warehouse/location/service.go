package location

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the location service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Location, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Location, error)
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*Location], error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Location, error)
	Archive(ctx context.Context, id, workspaceID uuid.UUID) error
	Restore(ctx context.Context, id, workspaceID uuid.UUID) error
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	GetBreadcrumb(ctx context.Context, locationID, workspaceID uuid.UUID) ([]BreadcrumbItem, error)
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Location, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	WorkspaceID                              uuid.UUID
	Name                                     string
	ParentLocation                           *uuid.UUID
	Zone, Shelf, Bin, Description, ShortCode *string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Location, error) {
	if input.ShortCode != nil && *input.ShortCode != "" {
		exists, err := s.repo.ShortCodeExists(ctx, input.WorkspaceID, *input.ShortCode)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrShortCodeTaken
		}
	}

	location, err := NewLocation(input.WorkspaceID, input.Name, input.ParentLocation, input.Zone, input.Shelf, input.Bin, input.Description, input.ShortCode)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, location); err != nil {
		return nil, err
	}

	return location, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Location, error) {
	location, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if location == nil {
		return nil, ErrLocationNotFound
	}
	return location, nil
}

func (s *Service) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*Location], error) {
	locations, total, err := s.repo.FindByWorkspace(ctx, workspaceID, pagination)
	if err != nil {
		return nil, err
	}

	result := shared.NewPagedResult(locations, total, pagination)
	return &result, nil
}

type UpdateInput struct {
	Name           string
	ParentLocation *uuid.UUID
	Zone           *string
	Shelf          *string
	Bin            *string
	Description    *string
}

func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Location, error) {
	location, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := location.Update(input.Name, input.ParentLocation, input.Zone, input.Shelf, input.Bin, input.Description); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, location); err != nil {
		return nil, err
	}

	return location, nil
}

func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	location, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	location.Archive()
	return s.repo.Save(ctx, location)
}

func (s *Service) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	location, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	location.Restore()
	return s.repo.Save(ctx, location)
}

func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	location, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	return s.repo.Delete(ctx, location.ID())
}

// BreadcrumbItem represents a single item in a breadcrumb trail.
type BreadcrumbItem struct {
	ID        uuid.UUID
	Name      string
	ShortCode *string
}

// GetBreadcrumb returns the breadcrumb trail from root to the specified location.
// The first item is the root, the last item is the specified location.
func (s *Service) GetBreadcrumb(ctx context.Context, locationID, workspaceID uuid.UUID) ([]BreadcrumbItem, error) {
	breadcrumb := make([]BreadcrumbItem, 0)
	visited := make(map[uuid.UUID]bool) // Prevent infinite loops from bad data
	currentID := &locationID

	for currentID != nil && !visited[*currentID] {
		visited[*currentID] = true

		location, err := s.repo.FindByID(ctx, *currentID, workspaceID)
		if err != nil {
			return nil, err
		}
		if location == nil {
			break
		}

		// Prepend to build root-to-current path
		breadcrumb = append([]BreadcrumbItem{{
			ID:        location.ID(),
			Name:      location.Name(),
			ShortCode: location.ShortCode(),
		}}, breadcrumb...)

		currentID = location.ParentLocation()
	}

	return breadcrumb, nil
}

// Search searches for locations by query string.
func (s *Service) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Location, error) {
	if limit <= 0 {
		limit = 50 // Default limit
	}
	return s.repo.Search(ctx, workspaceID, query, limit)
}
