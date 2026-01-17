package testfixtures

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
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

// CreateTestItem creates a test item and saves it to the database.
// Returns the item ID.
func CreateTestItem(t *testing.T, pool *pgxpool.Pool, workspaceID uuid.UUID) uuid.UUID {
	t.Helper()

	itm, err := item.NewItem(workspaceID, "Test Item", "SKU-"+uuid.NewString()[:8], 0)
	if err != nil {
		t.Fatalf("failed to create test item: %v", err)
	}

	// Use raw SQL to insert the item
	_, err = pool.Exec(context.Background(), `
		INSERT INTO warehouse.items (id, workspace_id, sku, name, description)
		VALUES ($1, $2, $3, $4, $5)
	`, itm.ID(), itm.WorkspaceID(), itm.SKU(), itm.Name(), itm.Description())
	if err != nil {
		t.Fatalf("failed to save test item: %v", err)
	}

	return itm.ID()
}

// DeleteTestItem deletes a test item from the database.
func DeleteTestItem(t *testing.T, pool *pgxpool.Pool, itemID uuid.UUID) {
	t.Helper()

	_, err := pool.Exec(context.Background(), `
		DELETE FROM warehouse.items WHERE id = $1
	`, itemID)
	if err != nil {
		t.Fatalf("failed to delete test item: %v", err)
	}
}
