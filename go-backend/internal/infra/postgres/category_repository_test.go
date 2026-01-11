package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestCategoryRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCategoryRepository(pool)
	ctx := context.Background()

	t.Run("saves new category successfully", func(t *testing.T) {
		cat, err := category.NewCategory(testfixtures.TestWorkspaceID, "Electronics", nil, nil)
		require.NoError(t, err)

		err = repo.Save(ctx, cat)
		require.NoError(t, err)

		// Verify it was saved by retrieving it
		retrieved, err := repo.FindByID(ctx, cat.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, cat.ID(), retrieved.ID())
		assert.Equal(t, cat.Name(), retrieved.Name())
		assert.Equal(t, cat.WorkspaceID(), retrieved.WorkspaceID())
	})

	t.Run("saves category with parent and description", func(t *testing.T) {
		// Create parent category
		parent, err := category.NewCategory(testfixtures.TestWorkspaceID, "Electronics", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, parent)
		require.NoError(t, err)

		// Create child category
		parentID := parent.ID()
		desc := "Mobile phones and accessories"
		child, err := category.NewCategory(testfixtures.TestWorkspaceID, "Smartphones", &parentID, &desc)
		require.NoError(t, err)

		err = repo.Save(ctx, child)
		require.NoError(t, err)

		// Verify
		retrieved, err := repo.FindByID(ctx, child.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.NotNil(t, retrieved.ParentCategoryID())
		assert.Equal(t, parentID, *retrieved.ParentCategoryID())
		assert.NotNil(t, retrieved.Description())
		assert.Equal(t, desc, *retrieved.Description())
	})

	t.Run("updates existing category", func(t *testing.T) {
		cat, err := category.NewCategory(testfixtures.TestWorkspaceID, "Original Name", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, cat)
		require.NoError(t, err)

		// Update the category
		newDesc := "Updated description"
		err = cat.Update("Updated Name", nil, &newDesc)
		require.NoError(t, err)

		// Save again
		err = repo.Save(ctx, cat)
		require.NoError(t, err)

		// Verify updates
		retrieved, err := repo.FindByID(ctx, cat.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, "Updated Name", retrieved.Name())
		assert.NotNil(t, retrieved.Description())
		assert.Equal(t, newDesc, *retrieved.Description())
	})
}

func TestCategoryRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCategoryRepository(pool)
	ctx := context.Background()

	t.Run("finds existing category", func(t *testing.T) {
		cat, err := category.NewCategory(testfixtures.TestWorkspaceID, "Test Category", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, cat)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, cat.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)

		assert.Equal(t, cat.ID(), found.ID())
		assert.Equal(t, cat.Name(), found.Name())
	})

	t.Run("returns nil for non-existent category", func(t *testing.T) {
		nonExistentID := uuid.New()
		found, err := repo.FindByID(ctx, nonExistentID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()

		// Create category in workspace 1
		cat, err := category.NewCategory(workspace1, "Workspace 1 Category", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, cat)
		require.NoError(t, err)

		// Try to find in workspace 2
		found, err := repo.FindByID(ctx, cat.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		// Verify it exists in workspace 1
		found, err = repo.FindByID(ctx, cat.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestCategoryRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCategoryRepository(pool)
	ctx := context.Background()

	t.Run("finds all categories in workspace", func(t *testing.T) {
		workspaceID := uuid.New()

		// Create multiple categories
		cat1, _ := category.NewCategory(workspaceID, "Category 1", nil, nil)
		cat2, _ := category.NewCategory(workspaceID, "Category 2", nil, nil)
		cat3, _ := category.NewCategory(workspaceID, "Category 3", nil, nil)

		repo.Save(ctx, cat1)
		repo.Save(ctx, cat2)
		repo.Save(ctx, cat3)

		// Find all
		categories, err := repo.FindByWorkspace(ctx, workspaceID)
		require.NoError(t, err)
		assert.Len(t, categories, 3)
	})

	t.Run("returns empty slice for workspace with no categories", func(t *testing.T) {
		emptyWorkspaceID := uuid.New()
		categories, err := repo.FindByWorkspace(ctx, emptyWorkspaceID)
		require.NoError(t, err)
		assert.Empty(t, categories)
	})

	t.Run("isolates categories by workspace", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()

		// Create categories in different workspaces
		cat1, _ := category.NewCategory(workspace1, "WS1 Category", nil, nil)
		cat2, _ := category.NewCategory(workspace2, "WS2 Category", nil, nil)

		repo.Save(ctx, cat1)
		repo.Save(ctx, cat2)

		// Verify workspace 1 only has 1 category
		categories1, err := repo.FindByWorkspace(ctx, workspace1)
		require.NoError(t, err)
		assert.Len(t, categories1, 1)
		assert.Equal(t, "WS1 Category", categories1[0].Name())

		// Verify workspace 2 only has 1 category
		categories2, err := repo.FindByWorkspace(ctx, workspace2)
		require.NoError(t, err)
		assert.Len(t, categories2, 1)
		assert.Equal(t, "WS2 Category", categories2[0].Name())
	})
}

func TestCategoryRepository_FindByParent(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCategoryRepository(pool)
	ctx := context.Background()

	t.Run("finds child categories", func(t *testing.T) {
		workspaceID := uuid.New()

		// Create parent
		parent, _ := category.NewCategory(workspaceID, "Parent", nil, nil)
		repo.Save(ctx, parent)
		parentID := parent.ID()

		// Create children
		child1, _ := category.NewCategory(workspaceID, "Child 1", &parentID, nil)
		child2, _ := category.NewCategory(workspaceID, "Child 2", &parentID, nil)
		repo.Save(ctx, child1)
		repo.Save(ctx, child2)

		// Find children
		children, err := repo.FindByParent(ctx, workspaceID, parentID)
		require.NoError(t, err)
		assert.Len(t, children, 2)
	})

	t.Run("returns empty for parent with no children", func(t *testing.T) {
		workspaceID := uuid.New()
		parent, _ := category.NewCategory(workspaceID, "Childless Parent", nil, nil)
		repo.Save(ctx, parent)

		children, err := repo.FindByParent(ctx, workspaceID, parent.ID())
		require.NoError(t, err)
		assert.Empty(t, children)
	})
}

func TestCategoryRepository_FindRootCategories(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCategoryRepository(pool)
	ctx := context.Background()

	t.Run("finds only root categories", func(t *testing.T) {
		workspaceID := uuid.New()

		// Create root categories
		root1, _ := category.NewCategory(workspaceID, "Root 1", nil, nil)
		root2, _ := category.NewCategory(workspaceID, "Root 2", nil, nil)
		repo.Save(ctx, root1)
		repo.Save(ctx, root2)

		// Create child category
		root1ID := root1.ID()
		child, _ := category.NewCategory(workspaceID, "Child", &root1ID, nil)
		repo.Save(ctx, child)

		// Find root categories
		roots, err := repo.FindRootCategories(ctx, workspaceID)
		require.NoError(t, err)
		assert.Len(t, roots, 2)

		// Verify both are root categories (no parent)
		for _, root := range roots {
			assert.Nil(t, root.ParentCategoryID())
		}
	})
}

func TestCategoryRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCategoryRepository(pool)
	ctx := context.Background()

	t.Run("deletes category successfully", func(t *testing.T) {
		cat, err := category.NewCategory(testfixtures.TestWorkspaceID, "To Delete", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, cat)
		require.NoError(t, err)

		// Delete
		err = repo.Delete(ctx, cat.ID())
		require.NoError(t, err)

		// Verify it's gone
		found, err := repo.FindByID(ctx, cat.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("delete non-existent category does not error", func(t *testing.T) {
		nonExistentID := uuid.New()
		err := repo.Delete(ctx, nonExistentID)
		// Should not error on delete of non-existent
		assert.NoError(t, err)
	})
}

func TestCategoryRepository_HasChildren(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCategoryRepository(pool)
	ctx := context.Background()

	t.Run("returns true when category has children", func(t *testing.T) {
		workspaceID := uuid.New()

		// Create parent and child
		parent, _ := category.NewCategory(workspaceID, "Parent", nil, nil)
		repo.Save(ctx, parent)

		parentID := parent.ID()
		child, _ := category.NewCategory(workspaceID, "Child", &parentID, nil)
		repo.Save(ctx, child)

		// Check
		hasChildren, err := repo.HasChildren(ctx, parent.ID())
		require.NoError(t, err)
		assert.True(t, hasChildren)
	})

	t.Run("returns false when category has no children", func(t *testing.T) {
		workspaceID := uuid.New()

		parent, _ := category.NewCategory(workspaceID, "Childless", nil, nil)
		repo.Save(ctx, parent)

		hasChildren, err := repo.HasChildren(ctx, parent.ID())
		require.NoError(t, err)
		assert.False(t, hasChildren)
	})
}
