//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

func TestImportExportRepository_Items(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportExportRepository(pool)
	ctx := context.Background()

	t.Run("creates an item and lists it back", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)

		created, err := repo.CreateItem(ctx, queries.CreateItemParams{
			ID:            uuid.New(),
			WorkspaceID:   wsID,
			Sku:           "SKU-" + uuid.NewString()[:8],
			Name:          "Import Export Item",
			MinStockLevel: 1,
			ShortCode:     uuid.NewString()[:8],
		})
		require.NoError(t, err)

		items, err := repo.ListAllItems(ctx, wsID, false)
		require.NoError(t, err)
		require.Len(t, items, 1)
		assert.Equal(t, created.ID, items[0].ID)
		assert.Equal(t, "Import Export Item", items[0].Name)
	})

	t.Run("does not leak items across workspaces", func(t *testing.T) {
		wsA := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsB)

		_, err := repo.CreateItem(ctx, queries.CreateItemParams{
			ID:            uuid.New(),
			WorkspaceID:   wsA,
			Sku:           "SKU-" + uuid.NewString()[:8],
			Name:          "Tenant A Item",
			MinStockLevel: 1,
			ShortCode:     uuid.NewString()[:8],
		})
		require.NoError(t, err)

		itemsB, err := repo.ListAllItems(ctx, wsB, false)
		require.NoError(t, err)
		assert.Empty(t, itemsB)

		itemsA, err := repo.ListAllItems(ctx, wsA, false)
		require.NoError(t, err)
		assert.Len(t, itemsA, 1)
	})
}

func TestImportExportRepository_Categories(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportExportRepository(pool)
	ctx := context.Background()

	t.Run("creates, lists and finds a category by name", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)

		created, err := repo.CreateCategory(ctx, queries.CreateCategoryParams{
			ID:          uuid.New(),
			WorkspaceID: wsID,
			Name:        "Electronics",
		})
		require.NoError(t, err)

		categories, err := repo.ListAllCategories(ctx, wsID, false)
		require.NoError(t, err)
		require.Len(t, categories, 1)
		assert.Equal(t, created.ID, categories[0].ID)

		found, err := repo.GetCategoryByName(ctx, wsID, "Electronics")
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, created.ID, found.ID)
	})

	t.Run("does not leak categories across workspaces", func(t *testing.T) {
		wsA := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsB)

		_, err := repo.CreateCategory(ctx, queries.CreateCategoryParams{
			ID:          uuid.New(),
			WorkspaceID: wsA,
			Name:        "Tenant A Category",
		})
		require.NoError(t, err)

		categoriesB, err := repo.ListAllCategories(ctx, wsB, false)
		require.NoError(t, err)
		assert.Empty(t, categoriesB)

		found, err := repo.GetCategoryByName(ctx, wsB, "Tenant A Category")
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("returns nil for a category that does not exist", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)

		found, err := repo.GetCategoryByName(ctx, wsID, "Nonexistent")
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestImportExportRepository_Locations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportExportRepository(pool)
	ctx := context.Background()

	t.Run("creates, lists and finds a location by name", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)

		created, err := repo.CreateLocation(ctx, queries.CreateLocationParams{
			ID:          uuid.New(),
			WorkspaceID: wsID,
			Name:        "Garage",
			ShortCode:   uuid.NewString()[:8],
		})
		require.NoError(t, err)

		locations, err := repo.ListAllLocations(ctx, wsID, false)
		require.NoError(t, err)
		require.Len(t, locations, 1)
		assert.Equal(t, created.ID, locations[0].ID)

		found, err := repo.GetLocationByName(ctx, wsID, "Garage")
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, created.ID, found.ID)
	})

	t.Run("does not leak locations across workspaces", func(t *testing.T) {
		wsA := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsB)

		_, err := repo.CreateLocation(ctx, queries.CreateLocationParams{
			ID:          uuid.New(),
			WorkspaceID: wsA,
			Name:        "Tenant A Location",
			ShortCode:   uuid.NewString()[:8],
		})
		require.NoError(t, err)

		locationsB, err := repo.ListAllLocations(ctx, wsB, false)
		require.NoError(t, err)
		assert.Empty(t, locationsB)

		found, err := repo.GetLocationByName(ctx, wsB, "Tenant A Location")
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestImportExportRepository_Containers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportExportRepository(pool)
	ctx := context.Background()

	t.Run("creates a container and lists it scoped to its workspace", func(t *testing.T) {
		wsA := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsB)

		loc, err := repo.CreateLocation(ctx, queries.CreateLocationParams{
			ID:          uuid.New(),
			WorkspaceID: wsA,
			Name:        "Shed",
			ShortCode:   uuid.NewString()[:8],
		})
		require.NoError(t, err)

		created, err := repo.CreateContainer(ctx, queries.CreateContainerParams{
			ID:          uuid.New(),
			WorkspaceID: wsA,
			Name:        "Bin 1",
			LocationID:  loc.ID,
			ShortCode:   uuid.NewString()[:8],
		})
		require.NoError(t, err)

		containersA, err := repo.ListAllContainers(ctx, wsA, false)
		require.NoError(t, err)
		require.Len(t, containersA, 1)
		assert.Equal(t, created.ID, containersA[0].ID)

		containersB, err := repo.ListAllContainers(ctx, wsB, false)
		require.NoError(t, err)
		assert.Empty(t, containersB)
	})
}

func TestImportExportRepository_Labels(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportExportRepository(pool)
	ctx := context.Background()

	t.Run("creates a label and lists it scoped to its workspace", func(t *testing.T) {
		wsA := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsB)

		created, err := repo.CreateLabel(ctx, queries.CreateLabelParams{
			ID:          uuid.New(),
			WorkspaceID: wsA,
			Name:        "Fragile",
		})
		require.NoError(t, err)

		labelsA, err := repo.ListAllLabels(ctx, wsA, false)
		require.NoError(t, err)
		require.Len(t, labelsA, 1)
		assert.Equal(t, created.ID, labelsA[0].ID)

		labelsB, err := repo.ListAllLabels(ctx, wsB, false)
		require.NoError(t, err)
		assert.Empty(t, labelsB)
	})
}

func TestImportExportRepository_Companies(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportExportRepository(pool)
	ctx := context.Background()

	t.Run("creates a company and lists it scoped to its workspace", func(t *testing.T) {
		wsA := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsB)

		created, err := repo.CreateCompany(ctx, queries.CreateCompanyParams{
			ID:          uuid.New(),
			WorkspaceID: wsA,
			Name:        "Acme Corp",
		})
		require.NoError(t, err)

		companiesA, err := repo.ListAllCompanies(ctx, wsA, false)
		require.NoError(t, err)
		require.Len(t, companiesA, 1)
		assert.Equal(t, created.ID, companiesA[0].ID)

		companiesB, err := repo.ListAllCompanies(ctx, wsB, false)
		require.NoError(t, err)
		assert.Empty(t, companiesB)
	})
}

func TestImportExportRepository_Borrowers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportExportRepository(pool)
	ctx := context.Background()

	t.Run("creates a borrower and lists it scoped to its workspace", func(t *testing.T) {
		wsA := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsB)

		created, err := repo.CreateBorrower(ctx, queries.CreateBorrowerParams{
			ID:          uuid.New(),
			WorkspaceID: wsA,
			Name:        "Jane Borrower",
		})
		require.NoError(t, err)

		borrowersA, err := repo.ListAllBorrowers(ctx, wsA, false)
		require.NoError(t, err)
		require.Len(t, borrowersA, 1)
		assert.Equal(t, created.ID, borrowersA[0].ID)

		borrowersB, err := repo.ListAllBorrowers(ctx, wsB, false)
		require.NoError(t, err)
		assert.Empty(t, borrowersB)
	})
}
