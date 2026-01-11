package testfixtures

import (
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
)

// Common test workspace ID
var TestWorkspaceID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
var TestUserID = uuid.MustParse("00000000-0000-0000-0000-000000000002")

// StringPtr returns a pointer to the given string.
func StringPtr(s string) *string {
	return &s
}

// UUIDPtr returns a pointer to the given UUID.
func UUIDPtr(id uuid.UUID) *uuid.UUID {
	return &id
}

// NewTestCategory creates a test category with default values.
func NewTestCategory(name string) (*category.Category, error) {
	return category.NewCategory(TestWorkspaceID, name, nil, nil)
}

// NewTestCategoryWithParent creates a test category with a parent.
func NewTestCategoryWithParent(name string, parentID uuid.UUID) (*category.Category, error) {
	return category.NewCategory(TestWorkspaceID, name, &parentID, nil)
}

// NewTestCategoryWithDescription creates a test category with a description.
func NewTestCategoryWithDescription(name, description string) (*category.Category, error) {
	desc := description
	return category.NewCategory(TestWorkspaceID, name, nil, &desc)
}
