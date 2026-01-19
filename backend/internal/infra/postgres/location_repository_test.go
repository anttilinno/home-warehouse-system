//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestLocationRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("saves new location successfully", func(t *testing.T) {
		loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Garage", nil, nil, "GAR-001")
		require.NoError(t, err)

		err = repo.Save(ctx, loc)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, loc.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, loc.ID(), retrieved.ID())
		assert.Equal(t, loc.Name(), retrieved.Name())
		assert.Equal(t, loc.WorkspaceID(), retrieved.WorkspaceID())
	})

	t.Run("saves location with all optional fields", func(t *testing.T) {
		desc := "Main storage area"
		shortCode := "GAR-A1-3"

		loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Garage Shelf", nil, &desc, shortCode)
		require.NoError(t, err)

		err = repo.Save(ctx, loc)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, loc.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, desc, *retrieved.Description())
		assert.Equal(t, shortCode, retrieved.ShortCode())
	})

	t.Run("saves location with parent", func(t *testing.T) {
		parent, err := location.NewLocation(testfixtures.TestWorkspaceID, "Building A", nil, nil, "BLDA-001")
		require.NoError(t, err)
		err = repo.Save(ctx, parent)
		require.NoError(t, err)

		parentID := parent.ID()
		child, err := location.NewLocation(testfixtures.TestWorkspaceID, "Room 101", &parentID, nil, "BLDA-R101")
		require.NoError(t, err)

		err = repo.Save(ctx, child)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, child.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		require.NotNil(t, retrieved.ParentLocation())
		assert.Equal(t, parentID, *retrieved.ParentLocation())
	})
}

func TestLocationRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds existing location", func(t *testing.T) {
		loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Test Location", nil, nil, "FIND-001")
		require.NoError(t, err)
		err = repo.Save(ctx, loc)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, loc.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, loc.ID(), found.ID())
	})

	t.Run("returns nil for non-existent location", func(t *testing.T) {
		nonExistentID := uuid.New()
		found, err := repo.FindByID(ctx, nonExistentID, testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		loc, err := location.NewLocation(workspace1, "WS1 Location", nil, nil, "WS1-001")
		require.NoError(t, err)
		err = repo.Save(ctx, loc)
		require.NoError(t, err)

		// Should not find in different workspace
		found, err := repo.FindByID(ctx, loc.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		// Should find in correct workspace
		found, err = repo.FindByID(ctx, loc.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestLocationRepository_FindByShortCode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds location by short code", func(t *testing.T) {
		shortCode := "UC-123"
		loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Coded Location", nil, nil, shortCode)
		require.NoError(t, err)
		err = repo.Save(ctx, loc)
		require.NoError(t, err)

		found, err := repo.FindByShortCode(ctx, testfixtures.TestWorkspaceID, shortCode)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, loc.ID(), found.ID())
	})

	t.Run("returns nil for non-existent short code", func(t *testing.T) {
		found, err := repo.FindByShortCode(ctx, testfixtures.TestWorkspaceID, "NON-EXISTENT")
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestLocationRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds all locations in workspace with pagination", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)

		// Create multiple locations
		for i := 0; i < 5; i++ {
			loc, _ := location.NewLocation(workspaceID, "Location", nil, nil, uuid.NewString()[:8])
			repo.Save(ctx, loc)
		}

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		locations, count, err := repo.FindByWorkspace(ctx, workspaceID, pagination)
		require.NoError(t, err)
		assert.Equal(t, 5, count)
		assert.Len(t, locations, 5)
	})

	t.Run("respects pagination limit", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)

		for i := 0; i < 5; i++ {
			loc, _ := location.NewLocation(workspaceID, "Location", nil, nil, uuid.NewString()[:8])
			repo.Save(ctx, loc)
		}

		pagination := shared.Pagination{Page: 1, PageSize: 2}
		locations, _, err := repo.FindByWorkspace(ctx, workspaceID, pagination)
		require.NoError(t, err)
		assert.Len(t, locations, 2)
	})
}

func TestLocationRepository_FindRootLocations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds only root locations", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)

		// Create root locations
		root1, _ := location.NewLocation(workspaceID, "Root 1", nil, nil, "ROOT-001")
		root2, _ := location.NewLocation(workspaceID, "Root 2", nil, nil, "ROOT-002")
		repo.Save(ctx, root1)
		repo.Save(ctx, root2)

		// Create child location
		root1ID := root1.ID()
		child, _ := location.NewLocation(workspaceID, "Child", &root1ID, nil, "CHILD-001")
		repo.Save(ctx, child)

		roots, err := repo.FindRootLocations(ctx, workspaceID)
		require.NoError(t, err)
		assert.Len(t, roots, 2)

		for _, root := range roots {
			assert.Nil(t, root.ParentLocation())
		}
	})
}

func TestLocationRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("deletes location successfully", func(t *testing.T) {
		loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "To Delete", nil, nil, "DEL-001")
		require.NoError(t, err)
		err = repo.Save(ctx, loc)
		require.NoError(t, err)

		err = repo.Delete(ctx, loc.ID())
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, loc.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestLocationRepository_ShortCodeExists(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("returns true for existing short code", func(t *testing.T) {
		shortCode := "SC-EX01"
		loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Location", nil, nil, shortCode)
		require.NoError(t, err)
		err = repo.Save(ctx, loc)
		require.NoError(t, err)

		exists, err := repo.ShortCodeExists(ctx, testfixtures.TestWorkspaceID, shortCode)
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent short code", func(t *testing.T) {
		exists, err := repo.ShortCodeExists(ctx, testfixtures.TestWorkspaceID, "NOT-EXISTS")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}
