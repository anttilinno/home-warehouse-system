package category

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewCategory(t *testing.T) {
	workspaceID := uuid.New()

	t.Run("creates valid category", func(t *testing.T) {
		name := "Electronics"
		cat, err := NewCategory(workspaceID, name, nil, nil)

		require.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, cat.ID())
		assert.Equal(t, workspaceID, cat.WorkspaceID())
		assert.Equal(t, name, cat.Name())
		assert.Nil(t, cat.ParentCategoryID())
		assert.Nil(t, cat.Description())
		assert.False(t, cat.IsArchived())
		assert.WithinDuration(t, time.Now(), cat.CreatedAt(), time.Second)
		assert.WithinDuration(t, time.Now(), cat.UpdatedAt(), time.Second)
	})

	t.Run("creates category with parent", func(t *testing.T) {
		parentID := uuid.New()
		cat, err := NewCategory(workspaceID, "Smartphones", &parentID, nil)

		require.NoError(t, err)
		assert.NotNil(t, cat.ParentCategoryID())
		assert.Equal(t, parentID, *cat.ParentCategoryID())
	})

	t.Run("creates category with description", func(t *testing.T) {
		desc := "Electronic devices and accessories"
		cat, err := NewCategory(workspaceID, "Electronics", nil, &desc)

		require.NoError(t, err)
		assert.NotNil(t, cat.Description())
		assert.Equal(t, desc, *cat.Description())
	})

	t.Run("fails with empty name", func(t *testing.T) {
		cat, err := NewCategory(workspaceID, "", nil, nil)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Contains(t, err.Error(), "name")
	})

	t.Run("fails with nil workspace ID", func(t *testing.T) {
		cat, err := NewCategory(uuid.Nil, "Electronics", nil, nil)

		assert.Error(t, err)
		assert.Nil(t, cat)
		assert.Contains(t, err.Error(), "workspace_id")
	})
}

func TestCategory_Update(t *testing.T) {
	workspaceID := uuid.New()

	t.Run("updates name successfully", func(t *testing.T) {
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		originalUpdatedAt := cat.UpdatedAt()

		time.Sleep(time.Millisecond) // Ensure time difference

		newName := "Consumer Electronics"
		err := cat.Update(newName, nil, nil)

		require.NoError(t, err)
		assert.Equal(t, newName, cat.Name())
		assert.True(t, cat.UpdatedAt().After(originalUpdatedAt))
	})

	t.Run("updates parent category", func(t *testing.T) {
		cat, _ := NewCategory(workspaceID, "Smartphones", nil, nil)
		parentID := uuid.New()

		err := cat.Update("Smartphones", &parentID, nil)

		require.NoError(t, err)
		assert.NotNil(t, cat.ParentCategoryID())
		assert.Equal(t, parentID, *cat.ParentCategoryID())
	})

	t.Run("updates description", func(t *testing.T) {
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		desc := "Updated description"

		err := cat.Update("Electronics", nil, &desc)

		require.NoError(t, err)
		assert.NotNil(t, cat.Description())
		assert.Equal(t, desc, *cat.Description())
	})

	t.Run("fails with empty name", func(t *testing.T) {
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)

		err := cat.Update("", nil, nil)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "name")
		assert.Equal(t, "Electronics", cat.Name()) // Name should not change
	})

	t.Run("removes parent category when set to nil", func(t *testing.T) {
		parentID := uuid.New()
		cat, _ := NewCategory(workspaceID, "Smartphones", &parentID, nil)
		assert.NotNil(t, cat.ParentCategoryID())

		err := cat.Update("Smartphones", nil, nil)

		require.NoError(t, err)
		assert.Nil(t, cat.ParentCategoryID())
	})
}

func TestCategory_Archive(t *testing.T) {
	workspaceID := uuid.New()

	t.Run("archives category", func(t *testing.T) {
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		originalUpdatedAt := cat.UpdatedAt()

		time.Sleep(time.Millisecond)

		cat.Archive()

		assert.True(t, cat.IsArchived())
		assert.True(t, cat.UpdatedAt().After(originalUpdatedAt))
	})

	t.Run("archiving already archived category is idempotent", func(t *testing.T) {
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		cat.Archive()
		firstArchivedTime := cat.UpdatedAt()

		time.Sleep(time.Millisecond)
		cat.Archive()

		assert.True(t, cat.IsArchived())
		assert.True(t, cat.UpdatedAt().After(firstArchivedTime))
	})
}

func TestCategory_Restore(t *testing.T) {
	workspaceID := uuid.New()

	t.Run("restores archived category", func(t *testing.T) {
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		cat.Archive()
		assert.True(t, cat.IsArchived())

		time.Sleep(time.Millisecond)
		archivedTime := cat.UpdatedAt()

		cat.Restore()

		assert.False(t, cat.IsArchived())
		assert.True(t, cat.UpdatedAt().After(archivedTime))
	})

	t.Run("restoring already active category is idempotent", func(t *testing.T) {
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)
		assert.False(t, cat.IsArchived())

		cat.Restore()

		assert.False(t, cat.IsArchived())
	})
}

func TestReconstruct(t *testing.T) {
	t.Run("reconstructs category from stored data", func(t *testing.T) {
		id := uuid.New()
		workspaceID := uuid.New()
		parentID := uuid.New()
		name := "Electronics"
		desc := "Test description"
		isArchived := true
		createdAt := time.Now().Add(-24 * time.Hour)
		updatedAt := time.Now()

		cat := Reconstruct(
			id, workspaceID, name, &parentID, &desc,
			isArchived, createdAt, updatedAt,
		)

		assert.Equal(t, id, cat.ID())
		assert.Equal(t, workspaceID, cat.WorkspaceID())
		assert.Equal(t, name, cat.Name())
		assert.NotNil(t, cat.ParentCategoryID())
		assert.Equal(t, parentID, *cat.ParentCategoryID())
		assert.NotNil(t, cat.Description())
		assert.Equal(t, desc, *cat.Description())
		assert.True(t, cat.IsArchived())
		assert.Equal(t, createdAt, cat.CreatedAt())
		assert.Equal(t, updatedAt, cat.UpdatedAt())
	})

	t.Run("reconstructs category without optional fields", func(t *testing.T) {
		id := uuid.New()
		workspaceID := uuid.New()
		name := "Electronics"
		createdAt := time.Now()
		updatedAt := time.Now()

		cat := Reconstruct(
			id, workspaceID, name, nil, nil,
			false, createdAt, updatedAt,
		)

		assert.Equal(t, id, cat.ID())
		assert.Nil(t, cat.ParentCategoryID())
		assert.Nil(t, cat.Description())
		assert.False(t, cat.IsArchived())
	})
}
