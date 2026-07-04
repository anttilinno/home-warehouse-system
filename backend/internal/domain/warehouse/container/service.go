package container

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/idempotency"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// generateShortCode generates a random 8-character lowercase hex code.
func generateShortCode() string {
	b := make([]byte, 4) // 4 bytes = 32 bits, hex encodes to 8 chars
	rand.Read(b)
	return hex.EncodeToString(b)
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
	repo         Repository
	locationRepo location.Repository
	idemStore    idempotency.Store
}

func NewService(repo Repository, locationRepo location.Repository) *Service {
	return &Service{repo: repo, locationRepo: locationRepo}
}

// SetIdempotencyStore wires the shared idempotency dedup store used by
// Create. Optional — if not set (e.g. in unit tests), Create simply skips
// the idempotency check.
func (s *Service) SetIdempotencyStore(store idempotency.Store) {
	s.idemStore = store
}

type CreateInput struct {
	WorkspaceID    uuid.UUID
	LocationID     uuid.UUID
	Name           string
	Description    *string
	Capacity       *string
	ShortCode      string // Optional - will be auto-generated if empty
	IdempotencyKey string // Optional - offline-queued creates dedupe on this (see idempotency package)
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Container, error) {
	if existing, ok, err := s.findByIdempotencyKey(ctx, input.WorkspaceID, input.IdempotencyKey); err != nil {
		return nil, err
	} else if ok {
		return existing, nil
	}

	shortCode := input.ShortCode

	// If short code provided, check uniqueness
	if shortCode != "" {
		exists, err := s.repo.ShortCodeExists(ctx, shortCode)
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
			exists, err := s.repo.ShortCodeExists(ctx, code)
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

	// Validate location belongs to the same workspace
	if _, err := s.locationRepo.FindByID(ctx, input.LocationID, input.WorkspaceID); err != nil {
		if shared.IsNotFound(err) {
			return nil, shared.NewFieldError(shared.ErrNotFound, "location_id", fmt.Sprintf("location %s not found in this workspace", input.LocationID))
		}
		return nil, err
	}

	container, err := NewContainer(input.WorkspaceID, input.LocationID, input.Name, input.Description, input.Capacity, shortCode)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, container); err != nil {
		return nil, err
	}

	if err := s.saveIdempotencyKey(ctx, input.WorkspaceID, input.IdempotencyKey, container.ID()); err != nil {
		return nil, err
	}

	return container, nil
}

// findByIdempotencyKey is the replay check at the top of Create: an empty
// key or no store configured means "proceed with a normal create" (ok=false).
// A stored key whose entity has since disappeared falls through to a normal
// create too (ok=false, err=nil) rather than erroring.
func (s *Service) findByIdempotencyKey(ctx context.Context, workspaceID uuid.UUID, key string) (*Container, bool, error) {
	if key == "" || s.idemStore == nil {
		return nil, false, nil
	}
	entityID, found, err := s.idemStore.FindByIdempotencyKey(ctx, workspaceID, key)
	if err != nil {
		return nil, false, err
	}
	if !found {
		return nil, false, nil
	}
	existing, err := s.repo.FindByID(ctx, entityID, workspaceID)
	if err != nil {
		if shared.IsNotFound(err) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return existing, true, nil
}

// saveIdempotencyKey records the (workspace, key) -> entity mapping right
// after a successful create so a replay of the same key returns this entity.
// No-op when idempotency isn't in play for this request.
func (s *Service) saveIdempotencyKey(ctx context.Context, workspaceID uuid.UUID, key string, entityID uuid.UUID) error {
	if key == "" || s.idemStore == nil {
		return nil
	}
	return s.idemStore.SaveIdempotencyKey(ctx, workspaceID, key, idempotency.TypeContainer, entityID)
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

	// Validate location belongs to the same workspace
	if _, err := s.locationRepo.FindByID(ctx, input.LocationID, workspaceID); err != nil {
		if shared.IsNotFound(err) {
			return nil, shared.NewFieldError(shared.ErrNotFound, "location_id", fmt.Sprintf("location %s not found in this workspace", input.LocationID))
		}
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

	return s.repo.Delete(ctx, container.ID(), workspaceID)
}

// Search searches for containers by query string.
func (s *Service) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Container, error) {
	if limit <= 0 {
		limit = 50 // Default limit
	}
	return s.repo.Search(ctx, workspaceID, query, limit)
}
