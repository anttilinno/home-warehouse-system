package importjob

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queue"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

const (
	MaxFileSize   = 10 * 1024 * 1024 // 10MB
	AllowedCSVExt = ".csv"
)

var (
	UploadDir = getUploadDir()
)

// getUploadDir returns the configured upload directory, creating it if needed
func getUploadDir() string {
	dir := os.Getenv("IMPORT_UPLOAD_DIR")
	if dir == "" {
		dir = "/tmp/imports"
	}

	// Create directory if it doesn't exist
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("Warning: failed to create upload directory %s: %v", dir, err)
	}

	return dir
}

// Input/Output types

type ListImportJobsInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"20" minimum:"1" maximum:"100"`
}

type ListImportJobsOutput struct {
	Body ImportJobListResponse
}

type GetImportJobInput struct {
	ID uuid.UUID `path:"id"`
}

type GetImportJobOutput struct {
	Body ImportJobResponse
}

type GetImportJobErrorsInput struct {
	ID uuid.UUID `path:"id"`
}

type GetImportJobErrorsOutput struct {
	Body ImportJobErrorListResponse
}

type DeleteImportJobInput struct {
	ID uuid.UUID `path:"id"`
}

type DeleteImportJobOutput struct {
	Status int
}

// Response types

type ImportJobResponse struct {
	ID            uuid.UUID     `json:"id"`
	WorkspaceID   uuid.UUID     `json:"workspace_id"`
	UserID        uuid.UUID     `json:"user_id"`
	EntityType    EntityType    `json:"entity_type"`
	Status        ImportStatus  `json:"status"`
	FileName      string        `json:"file_name"`
	FileSizeBytes int64         `json:"file_size_bytes"`
	TotalRows     *int          `json:"total_rows"`
	ProcessedRows int           `json:"processed_rows"`
	SuccessCount  int           `json:"success_count"`
	ErrorCount    int           `json:"error_count"`
	Progress      int           `json:"progress"`
	StartedAt     *time.Time    `json:"started_at"`
	CompletedAt   *time.Time    `json:"completed_at"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
	ErrorMessage  *string       `json:"error_message"`
}

type ImportJobListResponse struct {
	Jobs       []ImportJobResponse `json:"jobs"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	TotalPages int                 `json:"total_pages"`
}

type ImportErrorResponse struct {
	ID           uuid.UUID      `json:"id"`
	ImportJobID  uuid.UUID      `json:"import_job_id"`
	RowNumber    int            `json:"row_number"`
	FieldName    *string        `json:"field_name"`
	ErrorMessage string         `json:"error_message"`
	RowData      map[string]any `json:"row_data"`
	CreatedAt    time.Time      `json:"created_at"`
}

type ImportJobErrorListResponse struct {
	Errors []ImportErrorResponse `json:"errors"`
	Total  int                   `json:"total"`
}

// RegisterRoutes registers import job routes.
func RegisterRoutes(api huma.API, repo Repository, importQueue *queue.Queue, broadcaster *events.Broadcaster) {
	// List import jobs
	huma.Get(api, "/imports/jobs", func(ctx context.Context, input *ListImportJobsInput) (*ListImportJobsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		jobs, total, err := repo.FindJobsByWorkspace(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list import jobs")
		}

		responses := make([]ImportJobResponse, len(jobs))
		for i, job := range jobs {
			responses[i] = toImportJobResponse(job)
		}

		return &ListImportJobsOutput{
			Body: ImportJobListResponse{
				Jobs:       responses,
				Total:      total,
				Page:       input.Page,
				TotalPages: (total + input.Limit - 1) / input.Limit,
			},
		}, nil
	})

	// Get single import job
	huma.Get(api, "/imports/jobs/{id}", func(ctx context.Context, input *GetImportJobInput) (*GetImportJobOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		job, err := repo.FindJobByID(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrImportJobNotFound {
				return nil, huma.Error404NotFound("import job not found")
			}
			return nil, huma.Error500InternalServerError("failed to get import job")
		}

		return &GetImportJobOutput{
			Body: toImportJobResponse(job),
		}, nil
	})

	// Get import job errors
	huma.Get(api, "/imports/jobs/{id}/errors", func(ctx context.Context, input *GetImportJobErrorsInput) (*GetImportJobErrorsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Verify job exists and belongs to workspace
		_, err := repo.FindJobByID(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrImportJobNotFound {
				return nil, huma.Error404NotFound("import job not found")
			}
			return nil, huma.Error500InternalServerError("failed to get import job")
		}

		errors, err := repo.FindErrorsByJobID(ctx, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get import errors")
		}

		responses := make([]ImportErrorResponse, len(errors))
		for i, importError := range errors {
			responses[i] = toImportErrorResponse(importError)
		}

		return &GetImportJobErrorsOutput{
			Body: ImportJobErrorListResponse{
				Errors: responses,
				Total:  len(responses),
			},
		}, nil
	})

	// Delete import job
	huma.Delete(api, "/imports/jobs/{id}", func(ctx context.Context, input *DeleteImportJobInput) (*DeleteImportJobOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Verify job exists and belongs to workspace
		job, err := repo.FindJobByID(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrImportJobNotFound {
				return nil, huma.Error404NotFound("import job not found")
			}
			return nil, huma.Error500InternalServerError("failed to get import job")
		}

		// Delete errors first
		if err := repo.DeleteErrorsByJobID(ctx, input.ID); err != nil {
			return nil, huma.Error500InternalServerError("failed to delete import errors")
		}

		// Delete job
		if err := repo.DeleteJob(ctx, input.ID); err != nil {
			return nil, huma.Error500InternalServerError("failed to delete import job")
		}

		// Clean up file
		if job.FilePath() != "" {
			os.Remove(job.FilePath())
		}

		return &DeleteImportJobOutput{
			Status: 204,
		}, nil
	})

	// Note: SSE streaming for import progress is handled via the global /sse endpoint
	// Clients should connect to /sse and filter for events with type "import.progress"
}

// Helper functions

func toImportJobResponse(job *ImportJob) ImportJobResponse {
	return ImportJobResponse{
		ID:            job.ID(),
		WorkspaceID:   job.WorkspaceID(),
		UserID:        job.UserID(),
		EntityType:    job.EntityType(),
		Status:        job.Status(),
		FileName:      job.FileName(),
		FileSizeBytes: job.FileSizeBytes(),
		TotalRows:     job.TotalRows(),
		ProcessedRows: job.ProcessedRows(),
		SuccessCount:  job.SuccessCount(),
		ErrorCount:    job.ErrorCount(),
		Progress:      job.Progress(),
		StartedAt:     job.StartedAt(),
		CompletedAt:   job.CompletedAt(),
		CreatedAt:     job.CreatedAt(),
		UpdatedAt:     job.UpdatedAt(),
		ErrorMessage:  job.ErrorMessage(),
	}
}

func toImportErrorResponse(err *ImportError) ImportErrorResponse {
	return ImportErrorResponse{
		ID:           err.ID(),
		ImportJobID:  err.ImportJobID(),
		RowNumber:    err.RowNumber(),
		FieldName:    err.FieldName(),
		ErrorMessage: err.ErrorMessage(),
		RowData:      err.RowData(),
		CreatedAt:    err.CreatedAt(),
	}
}
