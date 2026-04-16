//go:build integration
// +build integration

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
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
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
		borrowers, count, err := repo.FindByWorkspace(ctx, workspace, pagination, false)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(borrowers), 3)
		assert.GreaterOrEqual(t, count, 3)
	})

	t.Run("returns empty for workspace with no borrowers", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		borrowers, count, err := repo.FindByWorkspace(ctx, workspace, pagination, false)
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

	t.Run("hard-deletes borrower", func(t *testing.T) {
		b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "To Delete", nil, nil, nil)
		require.NoError(t, err)
		err = repo.Save(ctx, b)
		require.NoError(t, err)

		err = repo.Delete(ctx, b.ID())
		require.NoError(t, err)

		// After hard-delete, the row is gone
		found, err := repo.FindByID(ctx, b.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
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

// Tests for the split Archive/Restore/Delete semantics added in Phase 59-01.

func TestBorrowerRepository_Archive_SetsFlagButKeepsRow(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "To Archive", nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, b))

	require.NoError(t, repo.Archive(ctx, b.ID()))

	// Row still exists but is_archived=true
	retrieved, err := repo.FindByID(ctx, b.ID(), testfixtures.TestWorkspaceID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.True(t, retrieved.IsArchived())
}

func TestBorrowerRepository_Restore_ClearsFlag(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "To Restore", nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, b))
	require.NoError(t, repo.Archive(ctx, b.ID()))

	require.NoError(t, repo.Restore(ctx, b.ID()))

	retrieved, err := repo.FindByID(ctx, b.ID(), testfixtures.TestWorkspaceID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.False(t, retrieved.IsArchived())
}

func TestBorrowerRepository_Delete_RemovesRow(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, "To Hard Delete", nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, b))

	require.NoError(t, repo.Delete(ctx, b.ID()))

	// Row is gone — FindByID should return shared.ErrNotFound
	found, err := repo.FindByID(ctx, b.ID(), testfixtures.TestWorkspaceID)
	require.Error(t, err)
	assert.True(t, shared.IsNotFound(err))
	assert.Nil(t, found)
}

func TestBorrowerRepository_FindByWorkspace_ExcludesArchivedByDefault(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewBorrowerRepository(pool)
	ctx := context.Background()

	workspace := uuid.New()
	testdb.CreateTestWorkspace(t, pool, workspace)

	// Seed: 1 active + 1 archived borrower in the same workspace
	active, err := borrower.NewBorrower(workspace, "Active Borrower "+uuid.NewString()[:8], nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, active))

	archived, err := borrower.NewBorrower(workspace, "Archived Borrower "+uuid.NewString()[:8], nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, archived))
	require.NoError(t, repo.Archive(ctx, archived.ID()))

	pagination := shared.Pagination{Page: 1, PageSize: 50}

	t.Run("includeArchived=false returns only active", func(t *testing.T) {
		rows, count, err := repo.FindByWorkspace(ctx, workspace, pagination, false)
		require.NoError(t, err)
		assert.Equal(t, 1, count)
		require.Len(t, rows, 1)
		assert.False(t, rows[0].IsArchived())
		assert.Equal(t, active.ID(), rows[0].ID())
	})

	t.Run("includeArchived=true returns active and archived", func(t *testing.T) {
		rows, count, err := repo.FindByWorkspace(ctx, workspace, pagination, true)
		require.NoError(t, err)
		assert.Equal(t, 2, count)
		require.Len(t, rows, 2)
	})
}
