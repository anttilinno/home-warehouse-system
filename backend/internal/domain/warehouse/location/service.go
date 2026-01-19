package location

import (
	"context"
	"crypto/rand"
	"encoding/base32"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// generateShortCode generates a random 8-character alphanumeric short code.
func generateShortCode() string {
	b := make([]byte, 5) // 5 bytes = 40 bits, base32 encodes to 8 chars
	rand.Read(b)
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
}

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
	WorkspaceID    uuid.UUID
	Name           string
	ParentLocation *uuid.UUID
	Description    *string
	ShortCode      string // Optional - will be auto-generated if empty
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Location, error) {
	shortCode := input.ShortCode

	if shortCode != "" {
		// User provided a short code - check uniqueness
		exists, err := s.repo.ShortCodeExists(ctx, input.WorkspaceID, shortCode)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrShortCodeTaken
		}
	} else {
		// Auto-generate a unique short code
		const maxAttempts = 10
		for i := 0; i < maxAttempts; i++ {
			code := generateShortCode()
			exists, err := s.repo.ShortCodeExists(ctx, input.WorkspaceID, code)
			if err != nil {
				return nil, err
			}
			if !exists {
				shortCode = code
				break
			}
		}
		if shortCode == "" {
			return nil, shared.NewDomainError(shared.ErrInternal, "failed to generate unique short code")
		}
	}

	location, err := NewLocation(input.WorkspaceID, input.Name, input.ParentLocation, input.Description, shortCode)
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
	Description    *string
}

func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Location, error) {
	location, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := location.Update(input.Name, input.ParentLocation, input.Description); err != nil {
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
	ShortCode string
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
