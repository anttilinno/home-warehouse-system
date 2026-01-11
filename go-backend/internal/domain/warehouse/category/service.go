package category

import (
	"context"

	"github.com/google/uuid"
)

// ServiceInterface defines the category service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Category, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Category, error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Category, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	Archive(ctx context.Context, id, workspaceID uuid.UUID) error
	Restore(ctx context.Context, id, workspaceID uuid.UUID) error
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error)
	ListByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*Category, error)
	ListRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error)
	GetBreadcrumb(ctx context.Context, categoryID, workspaceID uuid.UUID) ([]BreadcrumbItem, error)
}

// Service handles category business logic.
type Service struct {
	repo Repository
}

// NewService creates a new category service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CreateInput holds the input for creating a category.
type CreateInput struct {
	WorkspaceID      uuid.UUID
	Name             string
	ParentCategoryID *uuid.UUID
	Description      *string
}

// Create creates a new category.
func (s *Service) Create(ctx context.Context, input CreateInput) (*Category, error) {
	// Validate parent exists if specified
	if input.ParentCategoryID != nil {
		parent, err := s.repo.FindByID(ctx, *input.ParentCategoryID, input.WorkspaceID)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, ErrCategoryNotFound
		}
	}

	category, err := NewCategory(input.WorkspaceID, input.Name, input.ParentCategoryID, input.Description)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, category); err != nil {
		return nil, err
	}

	return category, nil
}

// GetByID retrieves a category by ID.
func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Category, error) {
	category, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if category == nil {
		return nil, ErrCategoryNotFound
	}
	return category, nil
}

// ListByWorkspace retrieves all categories in a workspace.
func (s *Service) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID)
}

// ListByParent retrieves all categories with a specific parent.
func (s *Service) ListByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*Category, error) {
	return s.repo.FindByParent(ctx, workspaceID, parentID)
}

// ListRootCategories retrieves all root categories.
func (s *Service) ListRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error) {
	return s.repo.FindRootCategories(ctx, workspaceID)
}

// UpdateInput holds the input for updating a category.
type UpdateInput struct {
	Name             string
	ParentCategoryID *uuid.UUID
	Description      *string
}

// Update updates a category.
func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Category, error) {
	category, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	// Check for cyclic parent reference
	if input.ParentCategoryID != nil {
		if err := s.validateNoCyclicParent(ctx, id, *input.ParentCategoryID, workspaceID); err != nil {
			return nil, err
		}
	}

	if err := category.Update(input.Name, input.ParentCategoryID, input.Description); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, category); err != nil {
		return nil, err
	}

	return category, nil
}

// validateNoCyclicParent checks that setting parentID as the parent of categoryID
// would not create a cycle in the category hierarchy.
func (s *Service) validateNoCyclicParent(ctx context.Context, categoryID, parentID, workspaceID uuid.UUID) error {
	// Cannot set self as parent
	if categoryID == parentID {
		return ErrCyclicParent
	}

	// Walk up the parent chain from the proposed parent to check if we hit categoryID
	visited := make(map[uuid.UUID]bool)
	currentID := &parentID

	for currentID != nil {
		if *currentID == categoryID {
			return ErrCyclicParent
		}

		if visited[*currentID] {
			// Already found a cycle in existing data (shouldn't happen, but be safe)
			break
		}
		visited[*currentID] = true

		parent, err := s.repo.FindByID(ctx, *currentID, workspaceID)
		if err != nil {
			return err
		}
		if parent == nil {
			break
		}

		currentID = parent.ParentCategoryID()
	}

	return nil
}

// Archive archives a category.
func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	category, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	category.Archive()
	return s.repo.Save(ctx, category)
}

// Restore restores an archived category.
func (s *Service) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	category, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	category.Restore()
	return s.repo.Save(ctx, category)
}

// Delete deletes a category.
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	category, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	// Check if category has children
	hasChildren, err := s.repo.HasChildren(ctx, category.ID())
	if err != nil {
		return err
	}
	if hasChildren {
		return ErrHasChildren
	}

	return s.repo.Delete(ctx, id)
}

// BreadcrumbItem represents a single item in a breadcrumb trail.
type BreadcrumbItem struct {
	ID   uuid.UUID
	Name string
}

// GetBreadcrumb returns the breadcrumb trail from root to the specified category.
// The first item is the root, the last item is the specified category.
func (s *Service) GetBreadcrumb(ctx context.Context, categoryID, workspaceID uuid.UUID) ([]BreadcrumbItem, error) {
	breadcrumb := make([]BreadcrumbItem, 0)
	visited := make(map[uuid.UUID]bool) // Prevent infinite loops from bad data
	currentID := &categoryID

	for currentID != nil && !visited[*currentID] {
		visited[*currentID] = true

		category, err := s.repo.FindByID(ctx, *currentID, workspaceID)
		if err != nil {
			return nil, err
		}
		if category == nil {
			break
		}

		// Prepend to build root-to-current path
		breadcrumb = append([]BreadcrumbItem{{
			ID:   category.ID(),
			Name: category.Name(),
		}}, breadcrumb...)

		currentID = category.ParentCategoryID()
	}

	return breadcrumb, nil
}
