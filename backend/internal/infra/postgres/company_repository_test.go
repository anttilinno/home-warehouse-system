package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/company"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestCompanyRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCompanyRepository(pool)
	ctx := context.Background()

	t.Run("saves new company successfully", func(t *testing.T) {
		c, err := company.NewCompany(testfixtures.TestWorkspaceID, "Acme Corp", nil, nil)
		require.NoError(t, err)

		err = repo.Save(ctx, c)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, c.ID(), retrieved.ID())
		assert.Equal(t, c.Name(), retrieved.Name())
	})

	t.Run("saves company with all fields", func(t *testing.T) {
		website := "https://example.com"
		notes := "Important partner"
		c, err := company.NewCompany(testfixtures.TestWorkspaceID, "Full Company", &website, &notes)
		require.NoError(t, err)

		err = repo.Save(ctx, c)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, website, *retrieved.Website())
		assert.Equal(t, notes, *retrieved.Notes())
	})
}

func TestCompanyRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCompanyRepository(pool)
	ctx := context.Background()

	t.Run("finds existing company", func(t *testing.T) {
		c, err := company.NewCompany(testfixtures.TestWorkspaceID, "Find Me Co", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, c.ID(), found.ID())
	})

	t.Run("returns nil for non-existent company", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		c, err := company.NewCompany(workspace1, "WS1 Company", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, c.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		found, err = repo.FindByID(ctx, c.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestCompanyRepository_FindByName(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCompanyRepository(pool)
	ctx := context.Background()

	t.Run("finds company by name", func(t *testing.T) {
		c, err := company.NewCompany(testfixtures.TestWorkspaceID, "Unique Corp Name", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		found, err := repo.FindByName(ctx, testfixtures.TestWorkspaceID, "Unique Corp Name")
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, c.ID(), found.ID())
	})

	t.Run("returns nil for non-existent name", func(t *testing.T) {
		found, err := repo.FindByName(ctx, testfixtures.TestWorkspaceID, "Does Not Exist Corp")
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestCompanyRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCompanyRepository(pool)
	ctx := context.Background()

	t.Run("lists companies with pagination", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		for i := 0; i < 5; i++ {
			name := "Company " + uuid.NewString()[:8]
			c, _ := company.NewCompany(workspace, name, nil, nil)
			require.NoError(t, repo.Save(ctx, c))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 3}
		companies, count, err := repo.FindByWorkspace(ctx, workspace, pagination)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(companies), 3)
		assert.GreaterOrEqual(t, count, 3)
	})

	t.Run("returns empty for workspace with no companies", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		companies, count, err := repo.FindByWorkspace(ctx, workspace, pagination)
		require.NoError(t, err)
		assert.Empty(t, companies)
		assert.Equal(t, 0, count)
	})
}

func TestCompanyRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCompanyRepository(pool)
	ctx := context.Background()

	t.Run("deletes company", func(t *testing.T) {
		c, err := company.NewCompany(testfixtures.TestWorkspaceID, "To Delete Corp", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)

		err = repo.Delete(ctx, c.ID())
		require.NoError(t, err)

		found, err = repo.FindByID(ctx, c.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestCompanyRepository_NameExists(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewCompanyRepository(pool)
	ctx := context.Background()

	t.Run("returns true for existing name", func(t *testing.T) {
		c, err := company.NewCompany(testfixtures.TestWorkspaceID, "Exists Corp", nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, c)
		require.NoError(t, err)

		exists, err := repo.NameExists(ctx, testfixtures.TestWorkspaceID, "Exists Corp")
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent name", func(t *testing.T) {
		exists, err := repo.NameExists(ctx, testfixtures.TestWorkspaceID, "Not Exists Corp")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}
