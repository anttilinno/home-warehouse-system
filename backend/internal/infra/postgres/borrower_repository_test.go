package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestBorrowerRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	t.Run("saves new borrower successfully", func(t *testing.T) {
		b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "John Doe", nil, nil, nil)
		require.NoError(t, err)

		err = repo.Save(ctx, b)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, b.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, b.ID(), retrieved.ID())
		assert.Equal(t, b.Name(), retrieved.Name())
	})

	t.Run("saves borrower with all fields", func(t *testing.T) {
		email := "jane@example.com"
		phone := "+1234567890"
		notes := "VIP borrower"
		b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "Jane Doe", &email, &phone, &notes)
		require.NoError(t, err)

		err = repo.Save(ctx, b)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, b.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, email, *retrieved.Email())
		assert.Equal(t, phone, *retrieved.Phone())
		assert.Equal(t, notes, *retrieved.Notes())
	})
}

func TestBorrowerRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	t.Run("finds existing borrower", func(t *testing.T) {
		b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "Find Me", nil, nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, b)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, b.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, b.ID(), found.ID())
	})

	t.Run("returns nil for non-existent borrower", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		b, err := borrower.NewBorrower(workspace1, "WS1 Borrower", nil, nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, b)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, b.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		found, err = repo.FindByID(ctx, b.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestBorrowerRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	t.Run("lists borrowers with pagination", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		for i := 0; i < 5; i++ {
			name := "Borrower " + uuid.NewString()[:8]
			b, _ := borrower.NewBorrower(workspace, name, nil, nil, nil)
			require.NoError(t, repo.Save(ctx, b))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 3}
		borrowers, count, err := repo.FindByWorkspace(ctx, workspace, pagination)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(borrowers), 3)
		assert.GreaterOrEqual(t, count, 3)
	})

	t.Run("returns empty for workspace with no borrowers", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		borrowers, count, err := repo.FindByWorkspace(ctx, workspace, pagination)
		require.NoError(t, err)
		assert.Empty(t, borrowers)
		assert.Equal(t, 0, count)
	})
}

func TestBorrowerRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	t.Run("archives borrower (soft delete)", func(t *testing.T) {
		b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "To Delete", nil, nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, b)
		require.NoError(t, err)

		err = repo.Delete(ctx, b.ID())
		require.NoError(t, err)

		// Archived borrowers may still be found depending on query
		// The test validates the archive operation succeeds
	})
}

func TestBorrowerRepository_HasActiveLoans(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	t.Run("returns false for borrower with no loans", func(t *testing.T) {
		b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "No Loans", nil, nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, b)
		require.NoError(t, err)

		hasLoans, err := repo.HasActiveLoans(ctx, b.ID())
		require.NoError(t, err)
		assert.False(t, hasLoans)
	})
}
