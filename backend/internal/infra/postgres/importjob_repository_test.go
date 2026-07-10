//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func newTestImportJob(t *testing.T, workspaceID, userID uuid.UUID) *importjob.ImportJob {
	t.Helper()
	job, err := importjob.NewImportJob(workspaceID, userID, importjob.EntityTypeItems, "items.csv", "/uploads/items-"+uuid.NewString()[:8]+".csv", 4096)
	require.NoError(t, err)
	return job
}

func TestImportJobRepository_SaveJob(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportJobRepository(pool)
	ctx := context.Background()

	t.Run("creates a new job", func(t *testing.T) {
		job := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, job))

		found, err := repo.FindJobByID(ctx, job.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, job.ID(), found.ID())
		assert.Equal(t, job.WorkspaceID(), found.WorkspaceID())
		assert.Equal(t, job.UserID(), found.UserID())
		assert.Equal(t, importjob.EntityTypeItems, found.EntityType())
		assert.Equal(t, importjob.StatusPending, found.Status())
		assert.Equal(t, job.FileName(), found.FileName())
		assert.Equal(t, job.FilePath(), found.FilePath())
		assert.Equal(t, job.FileSizeBytes(), found.FileSizeBytes())
	})

	t.Run("upserts progress on an existing job (ON CONFLICT DO UPDATE)", func(t *testing.T) {
		job := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, job))

		job.Start(10)
		job.UpdateProgress(5, 4, 1)
		require.NoError(t, repo.SaveJob(ctx, job))

		found, err := repo.FindJobByID(ctx, job.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, importjob.StatusProcessing, found.Status())
		require.NotNil(t, found.TotalRows())
		assert.Equal(t, 10, *found.TotalRows())
		assert.Equal(t, 5, found.ProcessedRows())
		assert.Equal(t, 4, found.SuccessCount())
		assert.Equal(t, 1, found.ErrorCount())

		job.Complete()
		require.NoError(t, repo.SaveJob(ctx, job))

		found, err = repo.FindJobByID(ctx, job.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, importjob.StatusCompleted, found.Status())
		assert.NotNil(t, found.CompletedAt())
	})

	t.Run("saves a failed job with an error message", func(t *testing.T) {
		job := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, job))

		job.Fail("could not parse row 3")
		require.NoError(t, repo.SaveJob(ctx, job))

		found, err := repo.FindJobByID(ctx, job.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, importjob.StatusFailed, found.Status())
		require.NotNil(t, found.ErrorMessage())
		assert.Equal(t, "could not parse row 3", *found.ErrorMessage())
	})
}

func TestImportJobRepository_FindJobByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportJobRepository(pool)
	ctx := context.Background()

	t.Run("returns ErrImportJobNotFound for a missing job", func(t *testing.T) {
		found, err := repo.FindJobByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak a job across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		job := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, job))

		found, err := repo.FindJobByID(ctx, job.ID(), otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)

		found, err = repo.FindJobByID(ctx, job.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestImportJobRepository_FindJobsByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportJobRepository(pool)
	ctx := context.Background()

	t.Run("lists jobs scoped to their workspace only", func(t *testing.T) {
		// import_jobs is not truncated between tests (see testdb.CleanupTestDB),
		// so this uses dedicated workspaces rather than the shared
		// testfixtures.TestWorkspaceID to keep the count assertions exact.
		workspaceA := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceA)
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		jobA1 := newTestImportJob(t, workspaceA, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, jobA1))
		jobA2 := newTestImportJob(t, workspaceA, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, jobA2))

		jobB := newTestImportJob(t, otherWorkspace, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, jobB))

		jobs, total, err := repo.FindJobsByWorkspace(ctx, workspaceA, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 2, total)
		require.Len(t, jobs, 2)
		for _, j := range jobs {
			assert.Equal(t, workspaceA, j.WorkspaceID())
		}

		jobsB, totalB, err := repo.FindJobsByWorkspace(ctx, otherWorkspace, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 1, totalB)
		require.Len(t, jobsB, 1)
		assert.Equal(t, jobB.ID(), jobsB[0].ID())
	})

	t.Run("returns empty for a workspace with no jobs", func(t *testing.T) {
		emptyWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, emptyWorkspace)

		jobs, total, err := repo.FindJobsByWorkspace(ctx, emptyWorkspace, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 0, total)
		assert.Empty(t, jobs)
	})
}

func TestImportJobRepository_FindJobsByStatus(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportJobRepository(pool)
	ctx := context.Background()

	t.Run("finds jobs across workspaces by status", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		pending := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, pending))

		processing := newTestImportJob(t, otherWorkspace, testfixtures.TestUserID)
		processing.Start(10)
		require.NoError(t, repo.SaveJob(ctx, processing))

		found, err := repo.FindJobsByStatus(ctx, importjob.StatusPending, 10)
		require.NoError(t, err)

		var ids []uuid.UUID
		for _, j := range found {
			ids = append(ids, j.ID())
		}
		assert.Contains(t, ids, pending.ID())
		assert.NotContains(t, ids, processing.ID())
	})
}

func TestImportJobRepository_DeleteJob(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportJobRepository(pool)
	ctx := context.Background()

	t.Run("deletes a job", func(t *testing.T) {
		job := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, job))

		require.NoError(t, repo.DeleteJob(ctx, job.ID()))

		found, err := repo.FindJobByID(ctx, job.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("delete of a non-existent job does not error", func(t *testing.T) {
		require.NoError(t, repo.DeleteJob(ctx, uuid.New()))
	})
}

func TestImportJobRepository_SaveAndFindErrors(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportJobRepository(pool)
	ctx := context.Background()

	t.Run("saves and lists errors ordered by row number", func(t *testing.T) {
		job := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, job))

		fieldName := "sku"
		err2, err := importjob.NewImportError(job.ID(), 2, &fieldName, "duplicate sku", map[string]any{"sku": "ABC"})
		require.NoError(t, err)
		require.NoError(t, repo.SaveError(ctx, err2))

		err1, err := importjob.NewImportError(job.ID(), 1, nil, "missing name", map[string]any{"name": ""})
		require.NoError(t, err)
		require.NoError(t, repo.SaveError(ctx, err1))

		found, err := repo.FindErrorsByJobID(ctx, job.ID())
		require.NoError(t, err)
		require.Len(t, found, 2)
		assert.Equal(t, 1, found[0].RowNumber())
		assert.Equal(t, "missing name", found[0].ErrorMessage())
		assert.Nil(t, found[0].FieldName())
		assert.Equal(t, 2, found[1].RowNumber())
		require.NotNil(t, found[1].FieldName())
		assert.Equal(t, "sku", *found[1].FieldName())
		assert.Equal(t, "ABC", found[1].RowData()["sku"])
	})

	t.Run("returns empty for a job with no errors", func(t *testing.T) {
		job := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, job))

		found, err := repo.FindErrorsByJobID(ctx, job.ID())
		require.NoError(t, err)
		assert.Empty(t, found)
	})
}

func TestImportJobRepository_DeleteErrorsByJobID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewImportJobRepository(pool)
	ctx := context.Background()

	t.Run("deletes all errors for a job", func(t *testing.T) {
		job := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, job))

		otherJob := newTestImportJob(t, testfixtures.TestWorkspaceID, testfixtures.TestUserID)
		require.NoError(t, repo.SaveJob(ctx, otherJob))

		e1, err := importjob.NewImportError(job.ID(), 1, nil, "boom", map[string]any{})
		require.NoError(t, err)
		require.NoError(t, repo.SaveError(ctx, e1))

		eOther, err := importjob.NewImportError(otherJob.ID(), 1, nil, "boom too", map[string]any{})
		require.NoError(t, err)
		require.NoError(t, repo.SaveError(ctx, eOther))

		require.NoError(t, repo.DeleteErrorsByJobID(ctx, job.ID()))

		found, err := repo.FindErrorsByJobID(ctx, job.ID())
		require.NoError(t, err)
		assert.Empty(t, found)

		foundOther, err := repo.FindErrorsByJobID(ctx, otherJob.ID())
		require.NoError(t, err)
		assert.Len(t, foundOther, 1)
	})
}
