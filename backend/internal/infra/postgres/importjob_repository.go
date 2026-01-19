package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type ImportJobRepository struct {
	pool *pgxpool.Pool
}

func NewImportJobRepository(pool *pgxpool.Pool) *ImportJobRepository {
	return &ImportJobRepository{pool: pool}
}

func (r *ImportJobRepository) SaveJob(ctx context.Context, job *importjob.ImportJob) error {
	query := `
		INSERT INTO warehouse.import_jobs (
			id, workspace_id, user_id, entity_type, status,
			file_name, file_path, file_size_bytes, total_rows,
			processed_rows, success_count, error_count,
			started_at, completed_at, created_at, updated_at, error_message
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		ON CONFLICT (id) DO UPDATE SET
			status = EXCLUDED.status,
			total_rows = EXCLUDED.total_rows,
			processed_rows = EXCLUDED.processed_rows,
			success_count = EXCLUDED.success_count,
			error_count = EXCLUDED.error_count,
			started_at = EXCLUDED.started_at,
			completed_at = EXCLUDED.completed_at,
			updated_at = EXCLUDED.updated_at,
			error_message = EXCLUDED.error_message
	`

	_, err := r.pool.Exec(ctx, query,
		job.ID(),
		job.WorkspaceID(),
		job.UserID(),
		job.EntityType(),
		job.Status(),
		job.FileName(),
		job.FilePath(),
		job.FileSizeBytes(),
		job.TotalRows(),
		job.ProcessedRows(),
		job.SuccessCount(),
		job.ErrorCount(),
		job.StartedAt(),
		job.CompletedAt(),
		job.CreatedAt(),
		job.UpdatedAt(),
		job.ErrorMessage(),
	)

	return err
}

func (r *ImportJobRepository) FindJobByID(ctx context.Context, id, workspaceID uuid.UUID) (*importjob.ImportJob, error) {
	query := `
		SELECT id, workspace_id, user_id, entity_type, status,
			file_name, file_path, file_size_bytes, total_rows,
			processed_rows, success_count, error_count,
			started_at, completed_at, created_at, updated_at, error_message
		FROM warehouse.import_jobs
		WHERE id = $1 AND workspace_id = $2
	`

	var (
		jobID, workspaceIDVal, userID uuid.UUID
		entityType                    string
		status                        string
		fileName, filePath            string
		fileSizeBytes                 int64
		totalRows                     *int
		processedRows, successCount, errorCount int
		startedAt, completedAt        *time.Time
		createdAt, updatedAt          time.Time
		errorMessage                  *string
	)

	err := r.pool.QueryRow(ctx, query, id, workspaceID).Scan(
		&jobID, &workspaceIDVal, &userID, &entityType, &status,
		&fileName, &filePath, &fileSizeBytes, &totalRows,
		&processedRows, &successCount, &errorCount,
		&startedAt, &completedAt, &createdAt, &updatedAt, &errorMessage,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, importjob.ErrImportJobNotFound
		}
		return nil, err
	}

	return importjob.ReconstructImportJob(
		jobID, workspaceIDVal, userID,
		importjob.EntityType(entityType),
		importjob.ImportStatus(status),
		fileName, filePath, fileSizeBytes,
		totalRows, processedRows, successCount, errorCount,
		startedAt, completedAt, createdAt, updatedAt, errorMessage,
	), nil
}

func (r *ImportJobRepository) FindJobsByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*importjob.ImportJob, int, error) {
	// Count total jobs
	countQuery := `
		SELECT COUNT(*)
		FROM warehouse.import_jobs
		WHERE workspace_id = $1
	`

	var totalCount int
	if err := r.pool.QueryRow(ctx, countQuery, workspaceID).Scan(&totalCount); err != nil {
		return nil, 0, err
	}

	// Fetch paginated jobs
	query := `
		SELECT id, workspace_id, user_id, entity_type, status,
			file_name, file_path, file_size_bytes, total_rows,
			processed_rows, success_count, error_count,
			started_at, completed_at, created_at, updated_at, error_message
		FROM warehouse.import_jobs
		WHERE workspace_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, workspaceID, pagination.Limit(), pagination.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var jobs []*importjob.ImportJob
	for rows.Next() {
		var (
			jobID, workspaceIDVal, userID uuid.UUID
			entityType                    string
			status                        string
			fileName, filePath            string
			fileSizeBytes                 int64
			totalRows                     *int
			processedRows, successCount, errorCount int
			startedAt, completedAt        *time.Time
			createdAt, updatedAt          time.Time
			errorMessage                  *string
		)

		if err := rows.Scan(
			&jobID, &workspaceIDVal, &userID, &entityType, &status,
			&fileName, &filePath, &fileSizeBytes, &totalRows,
			&processedRows, &successCount, &errorCount,
			&startedAt, &completedAt, &createdAt, &updatedAt, &errorMessage,
		); err != nil {
			return nil, 0, err
		}

		job := importjob.ReconstructImportJob(
			jobID, workspaceIDVal, userID,
			importjob.EntityType(entityType),
			importjob.ImportStatus(status),
			fileName, filePath, fileSizeBytes,
			totalRows, processedRows, successCount, errorCount,
			startedAt, completedAt, createdAt, updatedAt, errorMessage,
		)
		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return jobs, totalCount, nil
}

func (r *ImportJobRepository) FindJobsByStatus(ctx context.Context, status importjob.ImportStatus, limit int) ([]*importjob.ImportJob, error) {
	query := `
		SELECT id, workspace_id, user_id, entity_type, status,
			file_name, file_path, file_size_bytes, total_rows,
			processed_rows, success_count, error_count,
			started_at, completed_at, created_at, updated_at, error_message
		FROM warehouse.import_jobs
		WHERE status = $1
		ORDER BY created_at ASC
		LIMIT $2
	`

	rows, err := r.pool.Query(ctx, query, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*importjob.ImportJob
	for rows.Next() {
		var (
			jobID, workspaceIDVal, userID uuid.UUID
			entityType                    string
			statusStr                     string
			fileName, filePath            string
			fileSizeBytes                 int64
			totalRows                     *int
			processedRows, successCount, errorCount int
			startedAt, completedAt        *time.Time
			createdAt, updatedAt          time.Time
			errorMessage                  *string
		)

		if err := rows.Scan(
			&jobID, &workspaceIDVal, &userID, &entityType, &statusStr,
			&fileName, &filePath, &fileSizeBytes, &totalRows,
			&processedRows, &successCount, &errorCount,
			&startedAt, &completedAt, &createdAt, &updatedAt, &errorMessage,
		); err != nil {
			return nil, err
		}

		job := importjob.ReconstructImportJob(
			jobID, workspaceIDVal, userID,
			importjob.EntityType(entityType),
			importjob.ImportStatus(statusStr),
			fileName, filePath, fileSizeBytes,
			totalRows, processedRows, successCount, errorCount,
			startedAt, completedAt, createdAt, updatedAt, errorMessage,
		)
		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return jobs, nil
}

func (r *ImportJobRepository) DeleteJob(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM warehouse.import_jobs WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *ImportJobRepository) SaveError(ctx context.Context, importError *importjob.ImportError) error {
	query := `
		INSERT INTO warehouse.import_errors (
			id, import_job_id, row_number, field_name, error_message, row_data, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	rowDataJSON, err := json.Marshal(importError.RowData())
	if err != nil {
		return fmt.Errorf("failed to marshal row data: %w", err)
	}

	_, err = r.pool.Exec(ctx, query,
		importError.ID(),
		importError.ImportJobID(),
		importError.RowNumber(),
		importError.FieldName(),
		importError.ErrorMessage(),
		rowDataJSON,
		importError.CreatedAt(),
	)

	return err
}

func (r *ImportJobRepository) FindErrorsByJobID(ctx context.Context, jobID uuid.UUID) ([]*importjob.ImportError, error) {
	query := `
		SELECT id, import_job_id, row_number, field_name, error_message, row_data, created_at
		FROM warehouse.import_errors
		WHERE import_job_id = $1
		ORDER BY row_number ASC
	`

	rows, err := r.pool.Query(ctx, query, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var errors []*importjob.ImportError
	for rows.Next() {
		var (
			id, importJobID  uuid.UUID
			rowNumber        int
			fieldName        *string
			errorMsg         string
			rowDataJSON      []byte
			createdAt        time.Time
		)

		if err := rows.Scan(
			&id, &importJobID, &rowNumber, &fieldName, &errorMsg, &rowDataJSON, &createdAt,
		); err != nil {
			return nil, err
		}

		var rowData map[string]any
		if err := json.Unmarshal(rowDataJSON, &rowData); err != nil {
			return nil, fmt.Errorf("failed to unmarshal row data: %w", err)
		}

		importError := importjob.ReconstructImportError(
			id, importJobID, rowNumber, fieldName, errorMsg, rowData, createdAt,
		)
		errors = append(errors, importError)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return errors, nil
}

func (r *ImportJobRepository) DeleteErrorsByJobID(ctx context.Context, jobID uuid.UUID) error {
	query := `DELETE FROM warehouse.import_errors WHERE import_job_id = $1`
	_, err := r.pool.Exec(ctx, query, jobID)
	return err
}
