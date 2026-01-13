package category

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockRepository is a mock implementation of Repository for testing.
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, category *Category) error {
	args := m.Called(ctx, category)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Category, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Category), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Category), args.Error(1)
}

func (m *MockRepository) FindByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*Category, error) {
	args := m.Called(ctx, workspaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Category), args.Error(1)
}

func (m *MockRepository) FindRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Category), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) HasChildren(ctx context.Context, id uuid.UUID) (bool, error) {
	args := m.Called(ctx, id)
	return args.Bool(0), args.Error(1)
}

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("creates category successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(nil)

		input := CreateInput{
			WorkspaceID: workspaceID,
			Name:        "Electronics",
			Description: nil,
		}

		cat, err := svc.Create(ctx, input)

		require.NoError(t, err)
		assert.NotNil(t, cat)
		assert.Equal(t, "Electronics", cat.Name())
		assert.Equal(t, workspaceID, cat.WorkspaceID())
		repo.AssertExpectations(t)
	})

	t.Run("creates category with parent and description", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		parentID := uuid.New()
		desc := "Electronic devices"

		// Mock the parent category lookup
		parentCategory := Reconstruct(parentID, workspaceID, "Electronics", nil, nil, false, time.Now(), time.Now())
		repo.On("FindByID", ctx, parentID, workspaceID).Return(parentCategory, nil)
		repo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(nil)

		input := CreateInput{
			WorkspaceID:      workspaceID,
			Name:             "Smartphones",
			ParentCategoryID: &parentID,
			Description:      &desc,
		}

		cat, err := svc.Create(ctx, input)

		require.NoError(t, err)
		assert.NotNil(t, cat)
		assert.Equal(t, "Smartphones", cat.Name())
		assert.NotNil(t, cat.ParentCategoryID())
		assert.Equal(t, parentID, *cat.ParentCategoryID())
		assert.NotNil(t, cat.Description())
		assert.Equal(t, desc, *cat.Description())
		repo.AssertExpectations(t)
	})

	t.Run("fails when repository save fails", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		saveErr := errors.New("database error")
		repo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(saveErr)

		input := CreateInput{
			WorkspaceID: workspaceID,
			Name:        "Electronics",
		}

		cat, err := svc.Create(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Equal(t, saveErr, err)
		repo.AssertExpectations(t)
	})

	t.Run("fails with invalid input", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		input := CreateInput{
			WorkspaceID: workspaceID,
			Name:        "", // Empty name
		}

		cat, err := svc.Create(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
		// Repository should not be called
		repo.AssertNotCalled(t, "Save")
	})
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("retrieves category successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		expectedCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(expectedCat, nil)

		cat, err := svc.GetByID(ctx, categoryID, workspaceID)

		require.NoError(t, err)
		assert.NotNil(t, cat)
		assert.Equal(t, expectedCat, cat)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when category not found", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, nil)

		cat, err := svc.GetByID(ctx, categoryID, workspaceID)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Equal(t, ErrCategoryNotFound, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when repository fails", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repoErr := errors.New("database error")
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, repoErr)

		cat, err := svc.GetByID(ctx, categoryID, workspaceID)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Equal(t, repoErr, err)
		repo.AssertExpectations(t)
	})
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("updates category successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("Save", ctx, existingCat).Return(nil)

		newName := "Consumer Electronics"
		newDesc := "Updated description"
		input := UpdateInput{
			Name:        newName,
			Description: &newDesc,
		}

		cat, err := svc.Update(ctx, categoryID, workspaceID, input)

		require.NoError(t, err)
		assert.NotNil(t, cat)
		assert.Equal(t, newName, cat.Name())
		assert.NotNil(t, cat.Description())
		assert.Equal(t, newDesc, *cat.Description())
		repo.AssertExpectations(t)
	})

	t.Run("fails when category not found", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, nil)

		input := UpdateInput{Name: "New Name"}
		cat, err := svc.Update(ctx, categoryID, workspaceID, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Equal(t, ErrCategoryNotFound, err)
		repo.AssertNotCalled(t, "Save")
	})
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("deletes category successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("HasChildren", ctx, existingCat.ID()).Return(false, nil)
		repo.On("Delete", ctx, categoryID).Return(nil)

		err := svc.Delete(ctx, categoryID, workspaceID)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("fails when category has children", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("HasChildren", ctx, existingCat.ID()).Return(true, nil)

		err := svc.Delete(ctx, categoryID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrHasChildren, err)
		repo.AssertNotCalled(t, "Delete")
		repo.AssertExpectations(t)
	})

	t.Run("fails when category not found", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, nil)

		err := svc.Delete(ctx, categoryID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrCategoryNotFound, err)
		repo.AssertNotCalled(t, "HasChildren")
		repo.AssertNotCalled(t, "Delete")
	})
}

func TestService_Archive(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("archives category successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("Save", ctx, existingCat).Return(nil)

		err := svc.Archive(ctx, categoryID, workspaceID)

		require.NoError(t, err)
		assert.True(t, existingCat.IsArchived())
		repo.AssertExpectations(t)
	})
}

func TestService_Restore(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("restores category successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		existingCat.Archive()
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("Save", ctx, existingCat).Return(nil)

		err := svc.Restore(ctx, categoryID, workspaceID)

		require.NoError(t, err)
		assert.False(t, existingCat.IsArchived())
		repo.AssertExpectations(t)
	})
}

func TestService_ListByWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("returns categories successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		cat1, _ := NewCategory(workspaceID, "Category1", nil, nil)
		cat2, _ := NewCategory(workspaceID, "Category2", nil, nil)
		categories := []*Category{cat1, cat2}

		repo.On("FindByWorkspace", ctx, workspaceID).Return(categories, nil)

		result, err := svc.ListByWorkspace(ctx, workspaceID)

		require.NoError(t, err)
		assert.Len(t, result, 2)
		repo.AssertExpectations(t)
	})

	t.Run("returns error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByWorkspace", ctx, workspaceID).Return(nil, errors.New("db error"))

		result, err := svc.ListByWorkspace(ctx, workspaceID)

		assert.Error(t, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_ListByParent(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	parentID := uuid.New()

	t.Run("returns child categories successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		child, _ := NewCategory(workspaceID, "Child", &parentID, nil)
		categories := []*Category{child}

		repo.On("FindByParent", ctx, workspaceID, parentID).Return(categories, nil)

		result, err := svc.ListByParent(ctx, workspaceID, parentID)

		require.NoError(t, err)
		assert.Len(t, result, 1)
		repo.AssertExpectations(t)
	})

	t.Run("returns error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByParent", ctx, workspaceID, parentID).Return(nil, errors.New("db error"))

		result, err := svc.ListByParent(ctx, workspaceID, parentID)

		assert.Error(t, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_ListRootCategories(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("returns root categories successfully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		root, _ := NewCategory(workspaceID, "RootCategory", nil, nil)
		categories := []*Category{root}

		repo.On("FindRootCategories", ctx, workspaceID).Return(categories, nil)

		result, err := svc.ListRootCategories(ctx, workspaceID)

		require.NoError(t, err)
		assert.Len(t, result, 1)
		assert.Nil(t, result[0].ParentCategoryID())
		repo.AssertExpectations(t)
	})

	t.Run("returns error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindRootCategories", ctx, workspaceID).Return(nil, errors.New("db error"))

		result, err := svc.ListRootCategories(ctx, workspaceID)

		assert.Error(t, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_Update_CyclicParent(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("fails when setting self as parent", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		categoryID := uuid.New()
		existingCat := Reconstruct(categoryID, workspaceID, "Category", nil, nil, false, time.Now(), time.Now())

		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)

		input := UpdateInput{
			Name:             "Updated Category",
			ParentCategoryID: &categoryID, // Setting self as parent
		}

		cat, err := svc.Update(ctx, categoryID, workspaceID, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Equal(t, ErrCyclicParent, err)
	})

	t.Run("fails when creating cycle with grandparent", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		// Create hierarchy: Root -> Parent -> Child
		// Then try to set Root's parent to Child (creating cycle)
		rootID := uuid.New()
		parentID := uuid.New()
		childID := uuid.New()

		root := Reconstruct(rootID, workspaceID, "Root", nil, nil, false, time.Now(), time.Now())
		parent := Reconstruct(parentID, workspaceID, "Parent", &rootID, nil, false, time.Now(), time.Now())
		child := Reconstruct(childID, workspaceID, "Child", &parentID, nil, false, time.Now(), time.Now())

		// We're updating Root, trying to set its parent to Child
		repo.On("FindByID", ctx, rootID, workspaceID).Return(root, nil)
		repo.On("FindByID", ctx, childID, workspaceID).Return(child, nil)
		repo.On("FindByID", ctx, parentID, workspaceID).Return(parent, nil)
		// The loop will check if child's parent chain includes rootID

		input := UpdateInput{
			Name:             "Root",
			ParentCategoryID: &childID, // Try to set child as parent of root
		}

		cat, err := svc.Update(ctx, rootID, workspaceID, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Equal(t, ErrCyclicParent, err)
	})

	t.Run("succeeds when parent chain is valid", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		// Create hierarchy: Root -> NewParent
		// Then move an existing category under NewParent (no cycle)
		rootID := uuid.New()
		newParentID := uuid.New()
		categoryID := uuid.New()

		root := Reconstruct(rootID, workspaceID, "Root", nil, nil, false, time.Now(), time.Now())
		newParent := Reconstruct(newParentID, workspaceID, "NewParent", &rootID, nil, false, time.Now(), time.Now())
		existingCat := Reconstruct(categoryID, workspaceID, "Category", nil, nil, false, time.Now(), time.Now())

		// FindByID calls for the category being updated
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		// FindByID calls for cycle detection (walks parent chain from newParent)
		repo.On("FindByID", ctx, newParentID, workspaceID).Return(newParent, nil)
		repo.On("FindByID", ctx, rootID, workspaceID).Return(root, nil)
		repo.On("Save", ctx, existingCat).Return(nil)

		input := UpdateInput{
			Name:             "Category",
			ParentCategoryID: &newParentID,
		}

		cat, err := svc.Update(ctx, categoryID, workspaceID, input)

		require.NoError(t, err)
		assert.NotNil(t, cat)
		repo.AssertExpectations(t)
	})

	t.Run("fails when parent lookup fails during cycle check", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		categoryID := uuid.New()
		parentID := uuid.New()
		existingCat := Reconstruct(categoryID, workspaceID, "Category", nil, nil, false, time.Now(), time.Now())

		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("FindByID", ctx, parentID, workspaceID).Return(nil, errors.New("db error"))

		input := UpdateInput{
			Name:             "Category",
			ParentCategoryID: &parentID,
		}

		cat, err := svc.Update(ctx, categoryID, workspaceID, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
	})
}

func TestService_Archive_ErrorPaths(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("fails when category not found", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, nil)

		err := svc.Archive(ctx, categoryID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrCategoryNotFound, err)
	})

	t.Run("fails when save fails", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("Save", ctx, existingCat).Return(errors.New("db error"))

		err := svc.Archive(ctx, categoryID, workspaceID)

		assert.Error(t, err)
	})
}

func TestService_Restore_ErrorPaths(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("fails when category not found", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, nil)

		err := svc.Restore(ctx, categoryID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrCategoryNotFound, err)
	})

	t.Run("fails when save fails", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		existingCat.Archive()
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("Save", ctx, existingCat).Return(errors.New("db error"))

		err := svc.Restore(ctx, categoryID, workspaceID)

		assert.Error(t, err)
	})
}

func TestService_Delete_ErrorPaths(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("fails when HasChildren returns error", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("HasChildren", ctx, existingCat.ID()).Return(false, errors.New("db error"))

		err := svc.Delete(ctx, categoryID, workspaceID)

		assert.Error(t, err)
		repo.AssertNotCalled(t, "Delete")
	})
}

func TestService_Create_ParentNotFound(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	parentID := uuid.New()

	t.Run("fails when parent category not found", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByID", ctx, parentID, workspaceID).Return(nil, nil)

		input := CreateInput{
			WorkspaceID:      workspaceID,
			Name:             "Child",
			ParentCategoryID: &parentID,
		}

		cat, err := svc.Create(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Equal(t, ErrCategoryNotFound, err)
	})

	t.Run("fails when parent lookup returns error", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		repo.On("FindByID", ctx, parentID, workspaceID).Return(nil, errors.New("db error"))

		input := CreateInput{
			WorkspaceID:      workspaceID,
			Name:             "Child",
			ParentCategoryID: &parentID,
		}

		cat, err := svc.Create(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
	})
}

func TestService_GetBreadcrumb(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("returns breadcrumb trail for nested category", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		// Create hierarchy: Root -> Parent -> Child
		root, _ := NewCategory(workspaceID, "Root", nil, nil)
		rootID := root.ID()

		parent, _ := NewCategory(workspaceID, "Parent", &rootID, nil)
		parentID := parent.ID()

		child, _ := NewCategory(workspaceID, "Child", &parentID, nil)
		childID := child.ID()

		// Mock repository calls (walks from child to root)
		repo.On("FindByID", ctx, childID, workspaceID).Return(child, nil)
		repo.On("FindByID", ctx, parentID, workspaceID).Return(parent, nil)
		repo.On("FindByID", ctx, rootID, workspaceID).Return(root, nil)

		breadcrumb, err := svc.GetBreadcrumb(ctx, childID, workspaceID)

		require.NoError(t, err)
		require.Len(t, breadcrumb, 3)

		// Should be ordered from root to current
		assert.Equal(t, rootID, breadcrumb[0].ID)
		assert.Equal(t, "Root", breadcrumb[0].Name)

		assert.Equal(t, parentID, breadcrumb[1].ID)
		assert.Equal(t, "Parent", breadcrumb[1].Name)

		assert.Equal(t, childID, breadcrumb[2].ID)
		assert.Equal(t, "Child", breadcrumb[2].Name)

		repo.AssertExpectations(t)
	})

	t.Run("returns single item for root category", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		root, _ := NewCategory(workspaceID, "Root", nil, nil)
		rootID := root.ID()

		repo.On("FindByID", ctx, rootID, workspaceID).Return(root, nil)

		breadcrumb, err := svc.GetBreadcrumb(ctx, rootID, workspaceID)

		require.NoError(t, err)
		require.Len(t, breadcrumb, 1)
		assert.Equal(t, rootID, breadcrumb[0].ID)
		assert.Equal(t, "Root", breadcrumb[0].Name)

		repo.AssertExpectations(t)
	})

	t.Run("handles non-existent category gracefully", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		nonExistentID := uuid.New()

		repo.On("FindByID", ctx, nonExistentID, workspaceID).Return(nil, nil)

		breadcrumb, err := svc.GetBreadcrumb(ctx, nonExistentID, workspaceID)

		require.NoError(t, err)
		assert.Empty(t, breadcrumb)

		repo.AssertExpectations(t)
	})

	t.Run("prevents infinite loops from circular references", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		// Create circular reference (bad data scenario)
		cat1, _ := NewCategory(workspaceID, "Category1", nil, nil)
		cat1ID := cat1.ID()

		cat2ID := uuid.New()

		// Manually set parent to create circular reference
		cat1 = Reconstruct(
			cat1.ID(),
			cat1.WorkspaceID(),
			cat1.Name(),
			&cat2ID,
			cat1.Description(),
			cat1.IsArchived(),
			cat1.CreatedAt(),
			cat1.UpdatedAt(),
		)

		cat2 := Reconstruct(
			cat2ID,
			workspaceID,
			"Category2",
			&cat1ID,
			nil,
			false,
			cat1.CreatedAt(),
			cat1.UpdatedAt(),
		)

		// Mock will be called once for cat1, once for cat2, then stop
		repo.On("FindByID", ctx, cat1ID, workspaceID).Return(cat1, nil)
		repo.On("FindByID", ctx, cat2ID, workspaceID).Return(cat2, nil)

		breadcrumb, err := svc.GetBreadcrumb(ctx, cat1ID, workspaceID)

		require.NoError(t, err)
		// Should stop after visiting both categories once
		assert.LessOrEqual(t, len(breadcrumb), 2)

		repo.AssertExpectations(t)
	})

	t.Run("fails when repository returns error", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		categoryID := uuid.New()
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, errors.New("database error"))

		breadcrumb, err := svc.GetBreadcrumb(ctx, categoryID, workspaceID)

		assert.Error(t, err)
		assert.Nil(t, breadcrumb)
		repo.AssertExpectations(t)
	})
}

func TestService_Update_ErrorPaths(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	t.Run("fails when entity update validation fails", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)

		// Empty name should fail validation
		input := UpdateInput{
			Name: "",
		}

		cat, err := svc.Update(ctx, categoryID, workspaceID, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("fails when repository save fails", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		repo.On("Save", ctx, existingCat).Return(errors.New("database error"))

		input := UpdateInput{
			Name: "Updated Electronics",
		}

		cat, err := svc.Update(ctx, categoryID, workspaceID, input)

		assert.Error(t, err)
		assert.Nil(t, cat)
		repo.AssertExpectations(t)
	})
}

func TestService_ValidateNoCyclicParent_NilParent(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()
	parentID := uuid.New()

	t.Run("succeeds when parent lookup returns nil", func(t *testing.T) {
		repo := new(MockRepository)
		svc := NewService(repo)

		existingCat, _ := NewCategory(workspaceID, "Category", nil, nil)
		repo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCat, nil)
		// Parent is not found (returns nil)
		repo.On("FindByID", ctx, parentID, workspaceID).Return(nil, nil)
		repo.On("Save", ctx, existingCat).Return(nil)

		input := UpdateInput{
			Name:             "Updated Category",
			ParentCategoryID: &parentID,
		}

		cat, err := svc.Update(ctx, categoryID, workspaceID, input)

		require.NoError(t, err)
		assert.NotNil(t, cat)
		repo.AssertExpectations(t)
	})
}
