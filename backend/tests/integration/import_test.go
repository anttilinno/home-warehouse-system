package integration

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

func TestImportJobWorkflow(t *testing.T) {
	ts := NewTestServer(t)
	ctx := context.Background()

	repo := postgres.NewImportJobRepository(ts.Pool)

	// Create test workspace and user
	workspaceID := uuid.New()
	userID := uuid.New()

	// Create test CSV file
	testFile := createTestCSV(t)
	defer os.Remove(testFile)

	t.Run("CreateImportJob", func(t *testing.T) {
		// Create import job
		job, err := importjob.NewImportJob(
			workspaceID,
			userID,
			importjob.EntityTypeItems,
			"test.csv",
			testFile,
			1024,
		)
		require.NoError(t, err)
		assert.Equal(t, importjob.StatusPending, job.Status())

		// Save job to database
		err = repo.SaveJob(ctx, job)
		require.NoError(t, err)

		// Verify job was saved
		retrieved, err := repo.FindJobByID(ctx, job.ID(), workspaceID)
		require.NoError(t, err)
		assert.Equal(t, job.ID(), retrieved.ID())
		assert.Equal(t, workspaceID, retrieved.WorkspaceID())
		assert.Equal(t, userID, retrieved.UserID())
		assert.Equal(t, "test.csv", retrieved.FileName())
		assert.Equal(t, importjob.StatusPending, retrieved.Status())
	})

	t.Run("ProcessImportJob", func(t *testing.T) {
		// Create a new job for processing test
		job, err := importjob.NewImportJob(
			workspaceID,
			userID,
			importjob.EntityTypeItems,
			"test-process.csv",
			testFile,
			1024,
		)
		require.NoError(t, err)
		err = repo.SaveJob(ctx, job)
		require.NoError(t, err)

		// Start processing
		job.Start(10)
		err = repo.SaveJob(ctx, job)
		require.NoError(t, err)

		// Verify status changed to processing
		retrieved, err := repo.FindJobByID(ctx, job.ID(), workspaceID)
		require.NoError(t, err)
		assert.Equal(t, importjob.StatusProcessing, retrieved.Status())
		assert.NotNil(t, retrieved.StartedAt())

		// Simulate progress updates
		job.UpdateProgress(5, 4, 1)
		err = repo.SaveJob(ctx, job)
		require.NoError(t, err)

		retrieved, err = repo.FindJobByID(ctx, job.ID(), workspaceID)
		require.NoError(t, err)
		assert.Equal(t, 5, retrieved.ProcessedRows())
		assert.Equal(t, 4, retrieved.SuccessCount())
		assert.Equal(t, 1, retrieved.ErrorCount())

		// Complete job
		job.UpdateProgress(10, 9, 1)
		job.Complete()
		err = repo.SaveJob(ctx, job)
		require.NoError(t, err)

		retrieved, err = repo.FindJobByID(ctx, job.ID(), workspaceID)
		require.NoError(t, err)
		assert.Equal(t, importjob.StatusCompleted, retrieved.Status())
		assert.NotNil(t, retrieved.CompletedAt())
		assert.Equal(t, 10, retrieved.ProcessedRows())
		assert.Equal(t, 9, retrieved.SuccessCount())
		assert.Equal(t, 1, retrieved.ErrorCount())
	})

	t.Run("ImportJobErrors", func(t *testing.T) {
		// Create a job
		job, err := importjob.NewImportJob(
			workspaceID,
			userID,
			importjob.EntityTypeItems,
			"test-errors.csv",
			testFile,
			1024,
		)
		require.NoError(t, err)
		err = repo.SaveJob(ctx, job)
		require.NoError(t, err)

		// Add error records
		importErr1, err := importjob.NewImportError(
			job.ID(),
			3,
			strPtr("name"),
			"name is required",
			map[string]any{"sku": "TEST123"},
		)
		require.NoError(t, err)

		importErr2, err := importjob.NewImportError(
			job.ID(),
			5,
			strPtr("sku"),
			"sku already exists",
			map[string]any{"sku": "TEST456", "name": "Test Item"},
		)
		require.NoError(t, err)

		err = repo.SaveError(ctx, importErr1)
		require.NoError(t, err)

		err = repo.SaveError(ctx, importErr2)
		require.NoError(t, err)

		// Retrieve errors
		errors, err := repo.FindErrorsByJobID(ctx, job.ID())
		require.NoError(t, err)
		assert.Len(t, errors, 2)

		// Verify error details
		assert.Equal(t, 3, errors[0].RowNumber())
		assert.Equal(t, "name", *errors[0].FieldName())
		assert.Equal(t, "name is required", errors[0].ErrorMessage())

		assert.Equal(t, 5, errors[1].RowNumber())
		assert.Equal(t, "sku", *errors[1].FieldName())
		assert.Equal(t, "sku already exists", errors[1].ErrorMessage())
	})

	t.Run("ListJobsByWorkspace", func(t *testing.T) {
		// Create multiple jobs
		for i := 0; i < 3; i++ {
			job, err := importjob.NewImportJob(
				workspaceID,
				userID,
				importjob.EntityTypeItems,
				"test.csv",
				testFile,
				1024,
			)
			require.NoError(t, err)
			err = repo.SaveJob(ctx, job)
			require.NoError(t, err)

			// Add a small delay to ensure different timestamps
			time.Sleep(10 * time.Millisecond)
		}

		// List jobs
		jobs, total, err := repo.FindJobsByWorkspace(ctx, workspaceID, shared.Pagination{
			Page:     1,
			PageSize: 10,
		})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(jobs), 3)
		assert.GreaterOrEqual(t, total, 3)

		// Verify jobs are ordered by created_at desc (most recent first)
		for i := 1; i < len(jobs); i++ {
			assert.True(t, jobs[i-1].CreatedAt().After(jobs[i].CreatedAt()) ||
				jobs[i-1].CreatedAt().Equal(jobs[i].CreatedAt()))
		}
	})

	t.Run("DeleteImportJob", func(t *testing.T) {
		// Create a job
		job, err := importjob.NewImportJob(
			workspaceID,
			userID,
			importjob.EntityTypeItems,
			"test-delete.csv",
			testFile,
			1024,
		)
		require.NoError(t, err)
		err = repo.SaveJob(ctx, job)
		require.NoError(t, err)

		// Add some errors
		importErr, err := importjob.NewImportError(
			job.ID(),
			1,
			strPtr("name"),
			"test error",
			map[string]any{},
		)
		require.NoError(t, err)
		err = repo.SaveError(ctx, importErr)
		require.NoError(t, err)

		// Delete errors first
		err = repo.DeleteErrorsByJobID(ctx, job.ID())
		require.NoError(t, err)

		// Verify errors are deleted
		errors, err := repo.FindErrorsByJobID(ctx, job.ID())
		require.NoError(t, err)
		assert.Len(t, errors, 0)

		// Delete job
		err = repo.DeleteJob(ctx, job.ID())
		require.NoError(t, err)

		// Verify job is deleted
		_, err = repo.FindJobByID(ctx, job.ID(), workspaceID)
		assert.ErrorIs(t, err, importjob.ErrImportJobNotFound)
	})
}

func createTestCSV(t *testing.T) string {
	content := `name,sku,description
Item 1,SKU001,Test item 1
Item 2,SKU002,Test item 2
,SKU003,Missing name
Item 4,SKU004,Test item 4
`
	tmpFile, err := os.CreateTemp("", "test-*.csv")
	require.NoError(t, err)

	_, err = tmpFile.WriteString(content)
	require.NoError(t, err)

	tmpFile.Close()
	return tmpFile.Name()
}

func strPtr(s string) *string {
	return &s
}
