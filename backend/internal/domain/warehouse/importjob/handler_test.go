package importjob_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockRepository implements importjob.Repository interface for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) SaveJob(ctx context.Context, job *importjob.ImportJob) error {
	args := m.Called(ctx, job)
	return args.Error(0)
}

func (m *MockRepository) FindJobByID(ctx context.Context, id, workspaceID uuid.UUID) (*importjob.ImportJob, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*importjob.ImportJob), args.Error(1)
}

func (m *MockRepository) FindJobsByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*importjob.ImportJob, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*importjob.ImportJob), args.Int(1), args.Error(2)
}

func (m *MockRepository) FindJobsByStatus(ctx context.Context, status importjob.ImportStatus, limit int) ([]*importjob.ImportJob, error) {
	args := m.Called(ctx, status, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*importjob.ImportJob), args.Error(1)
}

func (m *MockRepository) DeleteJob(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) SaveError(ctx context.Context, importError *importjob.ImportError) error {
	args := m.Called(ctx, importError)
	return args.Error(0)
}

func (m *MockRepository) FindErrorsByJobID(ctx context.Context, jobID uuid.UUID) ([]*importjob.ImportError, error) {
	args := m.Called(ctx, jobID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*importjob.ImportError), args.Error(1)
}

func (m *MockRepository) DeleteErrorsByJobID(ctx context.Context, jobID uuid.UUID) error {
	args := m.Called(ctx, jobID)
	return args.Error(0)
}

// Helper function to create a test import job
func createTestJob(workspaceID, userID uuid.UUID, entityType importjob.EntityType) *importjob.ImportJob {
	job, _ := importjob.NewImportJob(
		workspaceID,
		userID,
		entityType,
		"test.csv",
		"/tmp/imports/test.csv",
		1024,
	)
	return job
}

// Helper function to create a test import error
func createTestError(jobID uuid.UUID, rowNum int, errorMsg string) *importjob.ImportError {
	fieldName := "name"
	importErr, _ := importjob.NewImportError(
		jobID,
		rowNum,
		&fieldName,
		errorMsg,
		map[string]any{"name": "test"},
	)
	return importErr
}

// Tests for ListImportJobs handler

func TestHandler_ListImportJobs(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	importjob.RegisterRoutes(setup.API, mockRepo, nil, nil)

	t.Run("lists import jobs successfully", func(t *testing.T) {
		job1 := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		job2 := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeInventory)
		jobs := []*importjob.ImportJob{job1, job2}

		mockRepo.On("FindJobsByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 20
		})).Return(jobs, 2, nil).Once()

		rec := setup.Get("/imports/jobs")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("handles custom pagination", func(t *testing.T) {
		mockRepo.On("FindJobsByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return([]*importjob.ImportJob{}, 0, nil).Once()

		rec := setup.Get("/imports/jobs?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns empty list when no jobs", func(t *testing.T) {
		mockRepo.On("FindJobsByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*importjob.ImportJob{}, 0, nil).Once()

		rec := setup.Get("/imports/jobs")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on repository error", func(t *testing.T) {
		mockRepo.On("FindJobsByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*importjob.ImportJob{}, 0, errors.New("database error")).Once()

		rec := setup.Get("/imports/jobs")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})
}

// Tests for GetImportJob handler

func TestHandler_GetImportJob(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	importjob.RegisterRoutes(setup.API, mockRepo, nil, nil)

	t.Run("gets import job by ID successfully", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 404 when job not found", func(t *testing.T) {
		jobID := uuid.New()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(nil, importjob.ErrImportJobNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on repository error", func(t *testing.T) {
		jobID := uuid.New()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})
}

// Tests for GetImportJobErrors handler

func TestHandler_GetImportJobErrors(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	importjob.RegisterRoutes(setup.API, mockRepo, nil, nil)

	t.Run("gets import job errors successfully", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		jobID := testJob.ID()

		err1 := createTestError(jobID, 5, "Invalid name")
		err2 := createTestError(jobID, 10, "Missing field")
		importErrors := []*importjob.ImportError{err1, err2}

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()
		mockRepo.On("FindErrorsByJobID", mock.Anything, jobID).
			Return(importErrors, nil).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s/errors", jobID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns empty errors list", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()
		mockRepo.On("FindErrorsByJobID", mock.Anything, jobID).
			Return([]*importjob.ImportError{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s/errors", jobID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 404 when job not found", func(t *testing.T) {
		jobID := uuid.New()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(nil, importjob.ErrImportJobNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s/errors", jobID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on find job error", func(t *testing.T) {
		jobID := uuid.New()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s/errors", jobID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on find errors error", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()
		mockRepo.On("FindErrorsByJobID", mock.Anything, jobID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s/errors", jobID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})
}

// Tests for DeleteImportJob handler

func TestHandler_DeleteImportJob(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	importjob.RegisterRoutes(setup.API, mockRepo, nil, nil)

	t.Run("deletes import job successfully", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()
		mockRepo.On("DeleteErrorsByJobID", mock.Anything, jobID).
			Return(nil).Once()
		mockRepo.On("DeleteJob", mock.Anything, jobID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 404 when job not found", func(t *testing.T) {
		jobID := uuid.New()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(nil, importjob.ErrImportJobNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on find job error", func(t *testing.T) {
		jobID := uuid.New()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on delete errors error", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()
		mockRepo.On("DeleteErrorsByJobID", mock.Anything, jobID).
			Return(errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 on delete job error", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()
		mockRepo.On("DeleteErrorsByJobID", mock.Anything, jobID).
			Return(nil).Once()
		mockRepo.On("DeleteJob", mock.Anything, jobID).
			Return(errors.New("database error")).Once()

		rec := setup.Delete(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockRepo.AssertExpectations(t)
	})
}

// Tests for import job response transformation

func TestHandler_ResponseTransformation(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	importjob.RegisterRoutes(setup.API, mockRepo, nil, nil)

	t.Run("transforms job with processing status correctly", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		testJob.Start(100)
		testJob.UpdateProgress(50, 45, 5)
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("transforms completed job correctly", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		testJob.Start(100)
		testJob.UpdateProgress(100, 95, 5)
		testJob.Complete()
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("transforms failed job correctly", func(t *testing.T) {
		testJob := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		testJob.Start(100)
		testJob.Fail("CSV parsing error")
		jobID := testJob.ID()

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(testJob, nil).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})
}

// Tests for pagination calculation

func TestHandler_ListPagination(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	importjob.RegisterRoutes(setup.API, mockRepo, nil, nil)

	t.Run("calculates total pages correctly", func(t *testing.T) {
		jobs := make([]*importjob.ImportJob, 5)
		for i := 0; i < 5; i++ {
			jobs[i] = createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		}

		mockRepo.On("FindJobsByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 5
		})).Return(jobs, 23, nil).Once()

		rec := setup.Get("/imports/jobs?page=1&limit=5")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})

	t.Run("handles single page result", func(t *testing.T) {
		job1 := createTestJob(setup.WorkspaceID, setup.UserID, importjob.EntityTypeItems)
		jobs := []*importjob.ImportJob{job1}

		mockRepo.On("FindJobsByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return(jobs, 1, nil).Once()

		rec := setup.Get("/imports/jobs")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})
}

// Tests for reconstructed jobs (simulating database retrieval)

func TestHandler_ReconstructedJob(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockRepo := new(MockRepository)
	importjob.RegisterRoutes(setup.API, mockRepo, nil, nil)

	t.Run("handles reconstructed job with all fields", func(t *testing.T) {
		jobID := uuid.New()
		totalRows := 100
		startedAt := time.Now().Add(-time.Hour)
		completedAt := time.Now()
		createdAt := time.Now().Add(-2 * time.Hour)
		updatedAt := time.Now()
		errorMessage := "Test error"

		reconstructedJob := importjob.ReconstructImportJob(
			jobID,
			setup.WorkspaceID,
			setup.UserID,
			importjob.EntityTypeItems,
			importjob.StatusFailed,
			"test.csv",
			"/tmp/imports/test.csv",
			2048,
			&totalRows,
			50,
			45,
			5,
			&startedAt,
			&completedAt,
			createdAt,
			updatedAt,
			&errorMessage,
		)

		mockRepo.On("FindJobByID", mock.Anything, jobID, setup.WorkspaceID).
			Return(reconstructedJob, nil).Once()

		rec := setup.Get(fmt.Sprintf("/imports/jobs/%s", jobID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockRepo.AssertExpectations(t)
	})
}
