package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestLabelRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLabelRepository(pool)
	ctx := context.Background()

	t.Run("saves new label successfully", func(t *testing.T) {
		l, err := label.NewLabel(testfixtures.TestWorkspaceID, "Important", testfixtures.StringPtr("#FF0000"), nil)
		require.NoError(t, err)

		err = repo.Save(ctx, l)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, l.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, l.ID(), retrieved.ID())
		assert.Equal(t, l.Name(), retrieved.Name())
		assert.Equal(t, l.Color(), retrieved.Color())
	})

	t.Run("saves label with description", func(t *testing.T) {
		desc := "High priority items"
		l, err := label.NewLabel(testfixtures.TestWorkspaceID, "Priority", testfixtures.StringPtr("#00FF00"), &desc)
		require.NoError(t, err)

		err = repo.Save(ctx, l)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, l.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, desc, *retrieved.Description())
	})
}

func TestLabelRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLabelRepository(pool)
	ctx := context.Background()

	t.Run("finds existing label", func(t *testing.T) {
		l, err := label.NewLabel(testfixtures.TestWorkspaceID, "Find Me Label", testfixtures.StringPtr("#0000FF"), nil)
		require.NoError(t, err)
		err = repo.Save(ctx, l)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, l.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, l.ID(), found.ID())
	})

	t.Run("returns nil for non-existent label", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		l, err := label.NewLabel(workspace1, "WS1 Label", testfixtures.StringPtr("#AABBCC"), nil)
		require.NoError(t, err)
		err = repo.Save(ctx, l)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, l.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		found, err = repo.FindByID(ctx, l.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestLabelRepository_FindByName(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLabelRepository(pool)
	ctx := context.Background()

	t.Run("finds label by name", func(t *testing.T) {
		l, err := label.NewLabel(testfixtures.TestWorkspaceID, "Unique Name", testfixtures.StringPtr("#123456"), nil)
		require.NoError(t, err)
		err = repo.Save(ctx, l)
		require.NoError(t, err)

		found, err := repo.FindByName(ctx, testfixtures.TestWorkspaceID, "Unique Name")
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, l.ID(), found.ID())
	})

	t.Run("returns nil for non-existent name", func(t *testing.T) {
		found, err := repo.FindByName(ctx, testfixtures.TestWorkspaceID, "Does Not Exist")
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestLabelRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLabelRepository(pool)
	ctx := context.Background()

	t.Run("lists labels by workspace", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		for i := 0; i < 3; i++ {
			name := "Label " + uuid.NewString()[:8]
			l, _ := label.NewLabel(workspace, name, testfixtures.StringPtr("#000000"), nil)
			require.NoError(t, repo.Save(ctx, l))
		}

		labels, err := repo.FindByWorkspace(ctx, workspace)
		require.NoError(t, err)
		assert.Len(t, labels, 3)
	})

	t.Run("returns empty slice for workspace with no labels", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		labels, err := repo.FindByWorkspace(ctx, workspace)
		require.NoError(t, err)
		assert.Empty(t, labels)
	})
}

func TestLabelRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLabelRepository(pool)
	ctx := context.Background()

	t.Run("deletes label", func(t *testing.T) {
		l, err := label.NewLabel(testfixtures.TestWorkspaceID, "To Delete", testfixtures.StringPtr("#FFFFFF"), nil)
		require.NoError(t, err)
		err = repo.Save(ctx, l)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, l.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)

		err = repo.Delete(ctx, l.ID())
		require.NoError(t, err)

		found, err = repo.FindByID(ctx, l.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestLabelRepository_NameExists(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLabelRepository(pool)
	ctx := context.Background()

	t.Run("returns true for existing name", func(t *testing.T) {
		l, err := label.NewLabel(testfixtures.TestWorkspaceID, "Exists Label", testfixtures.StringPtr("#AAAAAA"), nil)
		require.NoError(t, err)
		err = repo.Save(ctx, l)
		require.NoError(t, err)

		exists, err := repo.NameExists(ctx, testfixtures.TestWorkspaceID, "Exists Label")
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent name", func(t *testing.T) {
		exists, err := repo.NameExists(ctx, testfixtures.TestWorkspaceID, "Not Exists")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}
