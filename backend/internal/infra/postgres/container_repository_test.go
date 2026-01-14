package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func strPtr(s string) *string { return &s }

// createTestLocation creates a location for container tests
func createTestLocation(t *testing.T, repo *LocationRepository, ctx context.Context, name string) *location.Location {
	t.Helper()
	loc, err := location.NewLocation(testfixtures.TestWorkspaceID, name, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	err = repo.Save(ctx, loc)
	require.NoError(t, err)
	return loc
}

func TestContainerRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewContainerRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("saves new container successfully", func(t *testing.T) {
		loc := createTestLocation(t, locRepo, ctx, "Warehouse A")

		c, err := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "Box 1", nil, nil, nil)
		require.NoError(t, err)

		err = repo.Save(ctx, c)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, c.ID(), retrieved.ID())
		assert.Equal(t, c.Name(), retrieved.Name())
		assert.Equal(t, c.LocationID(), retrieved.LocationID())
		assert.Equal(t, c.WorkspaceID(), retrieved.WorkspaceID())
	})

	t.Run("saves container with all optional fields", func(t *testing.T) {
		loc := createTestLocation(t, locRepo, ctx, "Warehouse B")
		desc := "Large storage box"
		capacity := "50"
		shortCode := "BOX-001"

		c, err := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "Big Box", &desc, &capacity, &shortCode)
		require.NoError(t, err)

		err = repo.Save(ctx, c)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, desc, *retrieved.Description())
		assert.Equal(t, shortCode, *retrieved.ShortCode())
	})
}

func TestContainerRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewContainerRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds existing container", func(t *testing.T) {
		loc := createTestLocation(t, locRepo, ctx, "Find Location")
		c, err := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "Find Me", nil, nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, c.ID(), found.ID())
	})

	t.Run("returns nil for non-existent container", func(t *testing.T) {
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

		// Create location in workspace1
		loc, err := location.NewLocation(workspace1, "WS1 Location", nil, nil, nil, nil, nil, nil)
		require.NoError(t, err)
		err = locRepo.Save(ctx, loc)
		require.NoError(t, err)

		c, err := container.NewContainer(workspace1, loc.ID(), "WS1 Container", nil, nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		// Should not find in different workspace
		found, err := repo.FindByID(ctx, c.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		// Should find in correct workspace
		found, err = repo.FindByID(ctx, c.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestContainerRepository_FindByLocation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewContainerRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds containers by location", func(t *testing.T) {
		loc1 := createTestLocation(t, locRepo, ctx, "Location 1")
		loc2 := createTestLocation(t, locRepo, ctx, "Location 2")

		// Create containers in loc1
		c1, _ := container.NewContainer(testfixtures.TestWorkspaceID, loc1.ID(), "Container A", nil, nil, nil)
		c2, _ := container.NewContainer(testfixtures.TestWorkspaceID, loc1.ID(), "Container B", nil, nil, nil)
		// Create container in loc2
		c3, _ := container.NewContainer(testfixtures.TestWorkspaceID, loc2.ID(), "Container C", nil, nil, nil)

		require.NoError(t, repo.Save(ctx, c1))
		require.NoError(t, repo.Save(ctx, c2))
		require.NoError(t, repo.Save(ctx, c3))

		// Find containers in loc1
		containers, err := repo.FindByLocation(ctx, testfixtures.TestWorkspaceID, loc1.ID())
		require.NoError(t, err)
		assert.Len(t, containers, 2)

		// Find containers in loc2
		containers, err = repo.FindByLocation(ctx, testfixtures.TestWorkspaceID, loc2.ID())
		require.NoError(t, err)
		assert.Len(t, containers, 1)
	})

	t.Run("returns empty slice for location with no containers", func(t *testing.T) {
		loc := createTestLocation(t, locRepo, ctx, "Empty Location")
		containers, err := repo.FindByLocation(ctx, testfixtures.TestWorkspaceID, loc.ID())
		require.NoError(t, err)
		assert.Empty(t, containers)
	})
}

func TestContainerRepository_FindByShortCode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewContainerRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds container by short code", func(t *testing.T) {
		loc := createTestLocation(t, locRepo, ctx, "ShortCode Location")
		shortCode := "UNQ-001"
		c, err := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "Coded Box", nil, nil, &shortCode)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		found, err := repo.FindByShortCode(ctx, testfixtures.TestWorkspaceID, "UNQ-001")
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, c.ID(), found.ID())
	})

	t.Run("returns nil for non-existent short code", func(t *testing.T) {
		found, err := repo.FindByShortCode(ctx, testfixtures.TestWorkspaceID, "NON-EXISTENT")
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestContainerRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewContainerRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("lists containers with pagination", func(t *testing.T) {
		loc := createTestLocation(t, locRepo, ctx, "Paginated Location")

		// Create multiple containers
		for i := 0; i < 5; i++ {
			c, _ := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "Container", nil, nil, nil)
			require.NoError(t, repo.Save(ctx, c))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 3}
		containers, count, err := repo.FindByWorkspace(ctx, testfixtures.TestWorkspaceID, pagination)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(containers), 3)
		assert.GreaterOrEqual(t, count, 3)
	})
}

func TestContainerRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewContainerRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("deletes container", func(t *testing.T) {
		loc := createTestLocation(t, locRepo, ctx, "Delete Location")
		c, err := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "To Delete", nil, nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		// Verify exists
		found, err := repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)

		// Delete
		err = repo.Delete(ctx, c.ID())
		require.NoError(t, err)

		// Verify deleted
		found, err = repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestContainerRepository_ShortCodeExists(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewContainerRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("returns true for existing short code", func(t *testing.T) {
		loc := createTestLocation(t, locRepo, ctx, "Exists Location")
		shortCode := "EXT-001"
		c, err := container.NewContainer(testfixtures.TestWorkspaceID, loc.ID(), "Existing", nil, nil, &shortCode)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		exists, err := repo.ShortCodeExists(ctx, testfixtures.TestWorkspaceID, "EXT-001")
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent short code", func(t *testing.T) {
		exists, err := repo.ShortCodeExists(ctx, testfixtures.TestWorkspaceID, "NO-EXST")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}
