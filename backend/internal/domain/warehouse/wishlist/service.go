package wishlist

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the wishlist service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Item, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error)
	// Update applies a partial update. A status change in the input is
	// validated as a lifecycle transition (wanted ⇄ ordered, * → acquired);
	// setting status to acquired together with AcquiredItemID is the
	// "mark acquired / close the row" path used by the acquire flow.
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Item, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	List(ctx context.Context, workspaceID uuid.UUID, status *Status, pagination shared.Pagination) ([]*Item, int, error)
}

// Service implements wishlist business logic.
type Service struct {
	repo         Repository
	categoryRepo category.Repository
	itemRepo     item.Repository
}

// NewService creates a wishlist service. categoryRepo validates
// desired_category_id references; itemRepo validates acquired_item_id links.
func NewService(repo Repository, categoryRepo category.Repository, itemRepo item.Repository) *Service {
	return &Service{
		repo:         repo,
		categoryRepo: categoryRepo,
		itemRepo:     itemRepo,
	}
}

// CreateInput contains the data needed to create a wishlist item.
type CreateInput struct {
	WorkspaceID       uuid.UUID
	Name              string
	Notes             *string
	URL               *string
	PriceEstimate     *int // cents
	CurrencyCode      *string
	Priority          int
	DesiredCategoryID *uuid.UUID
	CreatedBy         *uuid.UUID
}

// UpdateInput contains the data for a partial wishlist update. Nil pointers
// mean "unchanged".
type UpdateInput struct {
	Name              *string
	Notes             *string
	URL               *string
	PriceEstimate     *int
	CurrencyCode      *string
	Priority          *int
	DesiredCategoryID *uuid.UUID
	Status            *Status
	AcquiredItemID    *uuid.UUID
}

// Create creates a new wishlist item after validating the desired category
// (if any) exists in the workspace.
func (s *Service) Create(ctx context.Context, input CreateInput) (*Item, error) {
	if input.DesiredCategoryID != nil {
		if _, err := s.categoryRepo.FindByID(ctx, *input.DesiredCategoryID, input.WorkspaceID); err != nil {
			return nil, err
		}
	}

	if input.Priority == 0 {
		input.Priority = PriorityDefault
	}

	wish, err := NewItem(
		input.WorkspaceID,
		input.Name,
		input.Notes,
		input.URL,
		input.PriceEstimate,
		input.CurrencyCode,
		input.Priority,
		input.DesiredCategoryID,
		input.CreatedBy,
	)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, wish); err != nil {
		return nil, err
	}
	return wish, nil
}

// GetByID retrieves a wishlist item by ID.
func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error) {
	return s.repo.FindByID(ctx, id, workspaceID)
}

// Update applies a partial update to a wishlist item. Detail fields are
// applied first, then the status transition (so an invalid transition rejects
// the whole update before anything is persisted).
func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Item, error) {
	wish, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	name := wish.Name()
	if input.Name != nil {
		name = *input.Name
	}
	notes := wish.Notes()
	if input.Notes != nil {
		notes = input.Notes
	}
	url := wish.URL()
	if input.URL != nil {
		url = input.URL
	}
	priceEstimate := wish.PriceEstimate()
	if input.PriceEstimate != nil {
		priceEstimate = input.PriceEstimate
	}
	currencyCode := wish.CurrencyCode()
	if input.CurrencyCode != nil {
		currencyCode = input.CurrencyCode
	}
	priority := wish.Priority()
	if input.Priority != nil {
		priority = *input.Priority
	}
	desiredCategoryID := wish.DesiredCategoryID()
	if input.DesiredCategoryID != nil {
		if _, err := s.categoryRepo.FindByID(ctx, *input.DesiredCategoryID, workspaceID); err != nil {
			return nil, err
		}
		desiredCategoryID = input.DesiredCategoryID
	}

	if err := wish.UpdateDetails(name, notes, url, priceEstimate, currencyCode, priority, desiredCategoryID); err != nil {
		return nil, err
	}

	if input.Status != nil {
		if *input.Status == StatusAcquired {
			// Closing the row: validate and link the created item (if given).
			if input.AcquiredItemID != nil {
				if _, err := s.itemRepo.FindByID(ctx, *input.AcquiredItemID, workspaceID); err != nil {
					return nil, err
				}
			}
			if err := wish.MarkAcquired(input.AcquiredItemID); err != nil {
				return nil, err
			}
		} else {
			if err := wish.TransitionStatus(*input.Status); err != nil {
				return nil, err
			}
		}
	} else if input.AcquiredItemID != nil {
		// Linking after the fact (item created first, then PATCHed back).
		// Only meaningful together with — or after — the acquired transition.
		if _, err := s.itemRepo.FindByID(ctx, *input.AcquiredItemID, workspaceID); err != nil {
			return nil, err
		}
		if err := wish.MarkAcquired(input.AcquiredItemID); err != nil {
			return nil, err
		}
	}

	if err := s.repo.Save(ctx, wish); err != nil {
		return nil, err
	}
	return wish, nil
}

// Delete removes a wishlist item.
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	if _, err := s.repo.FindByID(ctx, id, workspaceID); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id, workspaceID)
}

// List returns wishlist items for a workspace with pagination, optionally
// filtered by status. Sorted by priority (1 = highest first).
func (s *Service) List(ctx context.Context, workspaceID uuid.UUID, status *Status, pagination shared.Pagination) ([]*Item, int, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID, status, pagination)
}
