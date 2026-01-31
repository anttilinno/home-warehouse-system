package factory

import (
	"github.com/brianvoe/gofakeit/v7"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
)

// CategoryOpt is a functional option for customizing a Category.
type CategoryOpt func(*category.Category)

// Category creates a new Category entity with realistic fake data.
// Options can be used to override specific fields.
func (f *Factory) Category(opts ...CategoryOpt) *category.Category {
	name := gofakeit.ProductCategory()
	description := gofakeit.Sentence(8)

	c, err := category.NewCategory(f.workspaceID, name, nil, &description)
	if err != nil {
		panic("factory: failed to create category: " + err.Error())
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// WithCategoryName sets the category's name.
func WithCategoryName(name string) CategoryOpt {
	return func(c *category.Category) {
		_ = c.Update(name, c.ParentCategoryID(), c.Description())
	}
}

// WithParentCategory sets the category's parent category ID.
func WithParentCategory(parentID uuid.UUID) CategoryOpt {
	return func(c *category.Category) {
		_ = c.Update(c.Name(), &parentID, c.Description())
	}
}

// WithCategoryDescription sets the category's description.
func WithCategoryDescription(description string) CategoryOpt {
	return func(c *category.Category) {
		_ = c.Update(c.Name(), c.ParentCategoryID(), &description)
	}
}
