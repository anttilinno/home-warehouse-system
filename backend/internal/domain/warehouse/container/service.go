package container

import (
	"context"
	"crypto/rand"
	"encoding/base32"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// generateShortCode generates a random 8-character alphanumeric code
func generateShortCode() string {
	b := make([]byte, 5) // 5 bytes = 40 bits, base32 encodes to 8 chars
	rand.Read(b)
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
}

// ServiceInterface defines the container service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Container, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Container, error)
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*Container], error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Container, error)
	Archive(ctx context.Context, id, workspaceID uuid.UUID) error
	Restore(ctx context.Context, id, workspaceID uuid.UUID) error
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Container, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	WorkspaceID         uuid.UUID
	LocationID          uuid.UUID
	Name                string
	Description         *string
	Capacity            *string
	ShortCode           string // Optional - will be auto-generated if empty
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Container, error) {
	shortCode := input.ShortCode

	// If short code provided, check uniqueness
	if shortCode != "" {
		exists, err := s.repo.ShortCodeExists(ctx, input.WorkspaceID, shortCode)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrShortCodeTaken
		}
	} else {
		// Auto-generate short code if not provided
		const maxRetries = 5
		for i := 0; i < maxRetries; i++ {
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
			return nil, ErrShortCodeTaken
		}
	}

	container, err := NewContainer(input.WorkspaceID, input.LocationID, input.Name, input.Description, input.Capacity, shortCode)
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

// Search searches for containers by query string.
func (s *Service) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Container, error) {
	if limit <= 0 {
		limit = 50 // Default limit
	}
	return s.repo.Search(ctx, workspaceID, query, limit)
}
