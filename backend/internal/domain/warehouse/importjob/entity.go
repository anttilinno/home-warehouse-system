package importjob

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type EntityType string

const (
	EntityTypeItems      EntityType = "items"
	EntityTypeInventory  EntityType = "inventory"
	EntityTypeLocations  EntityType = "locations"
	EntityTypeContainers EntityType = "containers"
	EntityTypeCategories EntityType = "categories"
	EntityTypeBorrowers  EntityType = "borrowers"
)

type ImportStatus string

const (
	StatusPending    ImportStatus = "pending"
	StatusProcessing ImportStatus = "processing"
	StatusCompleted  ImportStatus = "completed"
	StatusFailed     ImportStatus = "failed"
	StatusCancelled  ImportStatus = "cancelled"
)

type ImportJob struct {
	id            uuid.UUID
	workspaceID   uuid.UUID
	userID        uuid.UUID
	entityType    EntityType
	status        ImportStatus
	fileName      string
	filePath      string
	fileSizeBytes int64
	totalRows     *int
	processedRows int
	successCount  int
	errorCount    int
	startedAt     *time.Time
	completedAt   *time.Time
	createdAt     time.Time
	updatedAt     time.Time
	errorMessage  *string
}

func NewImportJob(
	workspaceID uuid.UUID,
	userID uuid.UUID,
	entityType EntityType,
	fileName string,
	filePath string,
	fileSizeBytes int64,
) (*ImportJob, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(userID, "user_id"); err != nil {
		return nil, err
	}
	if fileName == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "file_name", "file name is required")
	}
	if filePath == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "file_path", "file path is required")
	}
	if fileSizeBytes <= 0 {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "file_size_bytes", "file size must be greater than 0")
	}

	now := time.Now()
	return &ImportJob{
		id:            shared.NewUUID(),
		workspaceID:   workspaceID,
		userID:        userID,
		entityType:    entityType,
		status:        StatusPending,
		fileName:      fileName,
		filePath:      filePath,
		fileSizeBytes: fileSizeBytes,
		totalRows:     nil,
		processedRows: 0,
		successCount:  0,
		errorCount:    0,
		startedAt:     nil,
		completedAt:   nil,
		createdAt:     now,
		updatedAt:     now,
		errorMessage:  nil,
	}, nil
}

func ReconstructImportJob(
	id uuid.UUID,
	workspaceID uuid.UUID,
	userID uuid.UUID,
	entityType EntityType,
	status ImportStatus,
	fileName string,
	filePath string,
	fileSizeBytes int64,
	totalRows *int,
	processedRows int,
	successCount int,
	errorCount int,
	startedAt *time.Time,
	completedAt *time.Time,
	createdAt time.Time,
	updatedAt time.Time,
	errorMessage *string,
) *ImportJob {
	return &ImportJob{
		id:            id,
		workspaceID:   workspaceID,
		userID:        userID,
		entityType:    entityType,
		status:        status,
		fileName:      fileName,
		filePath:      filePath,
		fileSizeBytes: fileSizeBytes,
		totalRows:     totalRows,
		processedRows: processedRows,
		successCount:  successCount,
		errorCount:    errorCount,
		startedAt:     startedAt,
		completedAt:   completedAt,
		createdAt:     createdAt,
		updatedAt:     updatedAt,
		errorMessage:  errorMessage,
	}
}

// Getters
func (j *ImportJob) ID() uuid.UUID            { return j.id }
func (j *ImportJob) WorkspaceID() uuid.UUID   { return j.workspaceID }
func (j *ImportJob) UserID() uuid.UUID        { return j.userID }
func (j *ImportJob) EntityType() EntityType   { return j.entityType }
func (j *ImportJob) Status() ImportStatus     { return j.status }
func (j *ImportJob) FileName() string         { return j.fileName }
func (j *ImportJob) FilePath() string         { return j.filePath }
func (j *ImportJob) FileSizeBytes() int64     { return j.fileSizeBytes }
func (j *ImportJob) TotalRows() *int          { return j.totalRows }
func (j *ImportJob) ProcessedRows() int       { return j.processedRows }
func (j *ImportJob) SuccessCount() int        { return j.successCount }
func (j *ImportJob) ErrorCount() int          { return j.errorCount }
func (j *ImportJob) StartedAt() *time.Time    { return j.startedAt }
func (j *ImportJob) CompletedAt() *time.Time  { return j.completedAt }
func (j *ImportJob) CreatedAt() time.Time     { return j.createdAt }
func (j *ImportJob) UpdatedAt() time.Time     { return j.updatedAt }
func (j *ImportJob) ErrorMessage() *string    { return j.errorMessage }

// Progress returns progress percentage (0-100)
func (j *ImportJob) Progress() int {
	if j.totalRows == nil || *j.totalRows == 0 {
		return 0
	}
	return (j.processedRows * 100) / *j.totalRows
}

// Business methods
func (j *ImportJob) Start(totalRows int) {
	now := time.Now()
	j.status = StatusProcessing
	j.totalRows = &totalRows
	j.startedAt = &now
	j.updatedAt = now
}

func (j *ImportJob) UpdateProgress(processedRows, successCount, errorCount int) {
	j.processedRows = processedRows
	j.successCount = successCount
	j.errorCount = errorCount
	j.updatedAt = time.Now()
}

func (j *ImportJob) Complete() {
	now := time.Now()
	j.status = StatusCompleted
	j.completedAt = &now
	j.updatedAt = now
}

func (j *ImportJob) Fail(errorMessage string) {
	now := time.Now()
	j.status = StatusFailed
	j.errorMessage = &errorMessage
	j.completedAt = &now
	j.updatedAt = now
}

func (j *ImportJob) Cancel() {
	now := time.Now()
	j.status = StatusCancelled
	j.completedAt = &now
	j.updatedAt = now
}

// ImportError represents an error during import
type ImportError struct {
	id          uuid.UUID
	importJobID uuid.UUID
	rowNumber   int
	fieldName   *string
	errorMsg    string
	rowData     map[string]any
	createdAt   time.Time
}

func NewImportError(
	importJobID uuid.UUID,
	rowNumber int,
	fieldName *string,
	errorMsg string,
	rowData map[string]any,
) (*ImportError, error) {
	if err := shared.ValidateUUID(importJobID, "import_job_id"); err != nil {
		return nil, err
	}
	if rowNumber < 0 {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "row_number", "row number must be non-negative")
	}
	if errorMsg == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "error_message", "error message is required")
	}

	return &ImportError{
		id:          shared.NewUUID(),
		importJobID: importJobID,
		rowNumber:   rowNumber,
		fieldName:   fieldName,
		errorMsg:    errorMsg,
		rowData:     rowData,
		createdAt:   time.Now(),
	}, nil
}

func ReconstructImportError(
	id uuid.UUID,
	importJobID uuid.UUID,
	rowNumber int,
	fieldName *string,
	errorMsg string,
	rowData map[string]any,
	createdAt time.Time,
) *ImportError {
	return &ImportError{
		id:          id,
		importJobID: importJobID,
		rowNumber:   rowNumber,
		fieldName:   fieldName,
		errorMsg:    errorMsg,
		rowData:     rowData,
		createdAt:   createdAt,
	}
}

// Getters
func (e *ImportError) ID() uuid.UUID                     { return e.id }
func (e *ImportError) ImportJobID() uuid.UUID            { return e.importJobID }
func (e *ImportError) RowNumber() int                    { return e.rowNumber }
func (e *ImportError) FieldName() *string                { return e.fieldName }
func (e *ImportError) ErrorMessage() string              { return e.errorMsg }
func (e *ImportError) RowData() map[string]any   { return e.rowData }
func (e *ImportError) CreatedAt() time.Time              { return e.createdAt }
