package category

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Category represents a product category in the warehouse system.
type Category struct {
	id               uuid.UUID
	workspaceID      uuid.UUID
	name             string
	parentCategoryID *uuid.UUID
	description      *string
	isArchived       bool
	createdAt        time.Time
	updatedAt        time.Time
}

// NewCategory creates a new category.
func NewCategory(workspaceID uuid.UUID, name string, parentCategoryID *uuid.UUID, description *string) (*Category, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "name", "category name is required")
	}

	now := time.Now()
	return &Category{
		id:               shared.NewUUID(),
		workspaceID:      workspaceID,
		name:             name,
		parentCategoryID: parentCategoryID,
		description:      description,
		isArchived:       false,
		createdAt:        now,
		updatedAt:        now,
	}, nil
}

// Reconstruct recreates a category from stored data.
func Reconstruct(
	id, workspaceID uuid.UUID,
	name string,
	parentCategoryID *uuid.UUID,
	description *string,
	isArchived bool,
	createdAt, updatedAt time.Time,
) *Category {
	return &Category{
		id:               id,
		workspaceID:      workspaceID,
		name:             name,
		parentCategoryID: parentCategoryID,
		description:      description,
		isArchived:       isArchived,
		createdAt:        createdAt,
		updatedAt:        updatedAt,
	}
}

// ID returns the category's ID.
func (c *Category) ID() uuid.UUID { return c.id }

// WorkspaceID returns the workspace ID.
func (c *Category) WorkspaceID() uuid.UUID { return c.workspaceID }

// Name returns the category's name.
func (c *Category) Name() string { return c.name }

// ParentCategoryID returns the parent category ID.
func (c *Category) ParentCategoryID() *uuid.UUID { return c.parentCategoryID }

// Description returns the category's description.
func (c *Category) Description() *string { return c.description }

// IsArchived returns whether the category is archived.
func (c *Category) IsArchived() bool { return c.isArchived }

// CreatedAt returns when the category was created.
func (c *Category) CreatedAt() time.Time { return c.createdAt }

// UpdatedAt returns when the category was last updated.
func (c *Category) UpdatedAt() time.Time { return c.updatedAt }

// Update updates the category's information.
func (c *Category) Update(name string, parentCategoryID *uuid.UUID, description *string) error {
	if name == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "name", "category name is required")
	}
	c.name = name
	c.parentCategoryID = parentCategoryID
	c.description = description
	c.updatedAt = time.Now()
	return nil
}

// Archive marks the category as archived.
func (c *Category) Archive() {
	c.isArchived = true
	c.updatedAt = time.Now()
}

// Restore marks the category as not archived.
func (c *Category) Restore() {
	c.isArchived = false
	c.updatedAt = time.Now()
}
