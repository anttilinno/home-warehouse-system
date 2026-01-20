package importjob_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
)

func TestNewImportJob(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name          string
		workspaceID   uuid.UUID
		userID        uuid.UUID
		entityType    importjob.EntityType
		fileName      string
		filePath      string
		fileSizeBytes int64
		wantErr       bool
		errMsg        string
	}{
		{
			name:          "valid import job with items entity type",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeItems,
			fileName:      "items.csv",
			filePath:      "/tmp/imports/items.csv",
			fileSizeBytes: 1024,
			wantErr:       false,
		},
		{
			name:          "valid import job with inventory entity type",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeInventory,
			fileName:      "inventory.csv",
			filePath:      "/tmp/imports/inventory.csv",
			fileSizeBytes: 2048,
			wantErr:       false,
		},
		{
			name:          "valid import job with locations entity type",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeLocations,
			fileName:      "locations.csv",
			filePath:      "/tmp/imports/locations.csv",
			fileSizeBytes: 512,
			wantErr:       false,
		},
		{
			name:          "valid import job with containers entity type",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeContainers,
			fileName:      "containers.csv",
			filePath:      "/tmp/imports/containers.csv",
			fileSizeBytes: 768,
			wantErr:       false,
		},
		{
			name:          "valid import job with categories entity type",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeCategories,
			fileName:      "categories.csv",
			filePath:      "/tmp/imports/categories.csv",
			fileSizeBytes: 256,
			wantErr:       false,
		},
		{
			name:          "valid import job with borrowers entity type",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeBorrowers,
			fileName:      "borrowers.csv",
			filePath:      "/tmp/imports/borrowers.csv",
			fileSizeBytes: 128,
			wantErr:       false,
		},
		{
			name:          "nil workspace ID",
			workspaceID:   uuid.Nil,
			userID:        userID,
			entityType:    importjob.EntityTypeItems,
			fileName:      "items.csv",
			filePath:      "/tmp/imports/items.csv",
			fileSizeBytes: 1024,
			wantErr:       true,
			errMsg:        "workspace_id",
		},
		{
			name:          "nil user ID",
			workspaceID:   workspaceID,
			userID:        uuid.Nil,
			entityType:    importjob.EntityTypeItems,
			fileName:      "items.csv",
			filePath:      "/tmp/imports/items.csv",
			fileSizeBytes: 1024,
			wantErr:       true,
			errMsg:        "user_id",
		},
		{
			name:          "empty file name",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeItems,
			fileName:      "",
			filePath:      "/tmp/imports/items.csv",
			fileSizeBytes: 1024,
			wantErr:       true,
			errMsg:        "file name is required",
		},
		{
			name:          "empty file path",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeItems,
			fileName:      "items.csv",
			filePath:      "",
			fileSizeBytes: 1024,
			wantErr:       true,
			errMsg:        "file path is required",
		},
		{
			name:          "zero file size",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeItems,
			fileName:      "items.csv",
			filePath:      "/tmp/imports/items.csv",
			fileSizeBytes: 0,
			wantErr:       true,
			errMsg:        "file size must be greater than 0",
		},
		{
			name:          "negative file size",
			workspaceID:   workspaceID,
			userID:        userID,
			entityType:    importjob.EntityTypeItems,
			fileName:      "items.csv",
			filePath:      "/tmp/imports/items.csv",
			fileSizeBytes: -100,
			wantErr:       true,
			errMsg:        "file size must be greater than 0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job, err := importjob.NewImportJob(
				tt.workspaceID,
				tt.userID,
				tt.entityType,
				tt.fileName,
				tt.filePath,
				tt.fileSizeBytes,
			)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, job)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, job)
				assert.NotEqual(t, uuid.Nil, job.ID())
				assert.Equal(t, tt.workspaceID, job.WorkspaceID())
				assert.Equal(t, tt.userID, job.UserID())
				assert.Equal(t, tt.entityType, job.EntityType())
				assert.Equal(t, importjob.StatusPending, job.Status())
				assert.Equal(t, tt.fileName, job.FileName())
				assert.Equal(t, tt.filePath, job.FilePath())
				assert.Equal(t, tt.fileSizeBytes, job.FileSizeBytes())
				assert.Nil(t, job.TotalRows())
				assert.Equal(t, 0, job.ProcessedRows())
				assert.Equal(t, 0, job.SuccessCount())
				assert.Equal(t, 0, job.ErrorCount())
				assert.Nil(t, job.StartedAt())
				assert.Nil(t, job.CompletedAt())
				assert.Nil(t, job.ErrorMessage())
				assert.NotZero(t, job.CreatedAt())
				assert.NotZero(t, job.UpdatedAt())
			}
		})
	}
}

func TestImportJob_Start(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	job, err := importjob.NewImportJob(
		workspaceID,
		userID,
		importjob.EntityTypeItems,
		"items.csv",
		"/tmp/imports/items.csv",
		1024,
	)
	assert.NoError(t, err)
	assert.Equal(t, importjob.StatusPending, job.Status())
	assert.Nil(t, job.TotalRows())
	assert.Nil(t, job.StartedAt())

	originalUpdatedAt := job.UpdatedAt()
	time.Sleep(time.Millisecond)

	job.Start(100)

	assert.Equal(t, importjob.StatusProcessing, job.Status())
	assert.NotNil(t, job.TotalRows())
	assert.Equal(t, 100, *job.TotalRows())
	assert.NotNil(t, job.StartedAt())
	assert.True(t, job.UpdatedAt().After(originalUpdatedAt))
}

func TestImportJob_UpdateProgress(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	job, err := importjob.NewImportJob(
		workspaceID,
		userID,
		importjob.EntityTypeItems,
		"items.csv",
		"/tmp/imports/items.csv",
		1024,
	)
	assert.NoError(t, err)

	job.Start(100)
	originalUpdatedAt := job.UpdatedAt()
	time.Sleep(time.Millisecond)

	job.UpdateProgress(50, 45, 5)

	assert.Equal(t, 50, job.ProcessedRows())
	assert.Equal(t, 45, job.SuccessCount())
	assert.Equal(t, 5, job.ErrorCount())
	assert.True(t, job.UpdatedAt().After(originalUpdatedAt))
}

func TestImportJob_Complete(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	job, err := importjob.NewImportJob(
		workspaceID,
		userID,
		importjob.EntityTypeItems,
		"items.csv",
		"/tmp/imports/items.csv",
		1024,
	)
	assert.NoError(t, err)

	job.Start(100)
	job.UpdateProgress(100, 95, 5)

	originalUpdatedAt := job.UpdatedAt()
	time.Sleep(time.Millisecond)

	job.Complete()

	assert.Equal(t, importjob.StatusCompleted, job.Status())
	assert.NotNil(t, job.CompletedAt())
	assert.True(t, job.UpdatedAt().After(originalUpdatedAt))
}

func TestImportJob_Fail(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	job, err := importjob.NewImportJob(
		workspaceID,
		userID,
		importjob.EntityTypeItems,
		"items.csv",
		"/tmp/imports/items.csv",
		1024,
	)
	assert.NoError(t, err)

	job.Start(100)

	originalUpdatedAt := job.UpdatedAt()
	time.Sleep(time.Millisecond)

	errorMessage := "Failed to parse CSV: invalid format"
	job.Fail(errorMessage)

	assert.Equal(t, importjob.StatusFailed, job.Status())
	assert.NotNil(t, job.ErrorMessage())
	assert.Equal(t, errorMessage, *job.ErrorMessage())
	assert.NotNil(t, job.CompletedAt())
	assert.True(t, job.UpdatedAt().After(originalUpdatedAt))
}

func TestImportJob_Cancel(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	job, err := importjob.NewImportJob(
		workspaceID,
		userID,
		importjob.EntityTypeItems,
		"items.csv",
		"/tmp/imports/items.csv",
		1024,
	)
	assert.NoError(t, err)
	assert.Equal(t, importjob.StatusPending, job.Status())

	originalUpdatedAt := job.UpdatedAt()
	time.Sleep(time.Millisecond)

	job.Cancel()

	assert.Equal(t, importjob.StatusCancelled, job.Status())
	assert.NotNil(t, job.CompletedAt())
	assert.True(t, job.UpdatedAt().After(originalUpdatedAt))
}

func TestImportJob_Progress(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name          string
		totalRows     *int
		processedRows int
		wantProgress  int
	}{
		{
			name:          "nil total rows returns 0",
			totalRows:     nil,
			processedRows: 50,
			wantProgress:  0,
		},
		{
			name:          "zero total rows returns 0",
			totalRows:     intPtr(0),
			processedRows: 50,
			wantProgress:  0,
		},
		{
			name:          "50% progress",
			totalRows:     intPtr(100),
			processedRows: 50,
			wantProgress:  50,
		},
		{
			name:          "100% progress",
			totalRows:     intPtr(100),
			processedRows: 100,
			wantProgress:  100,
		},
		{
			name:          "0% progress",
			totalRows:     intPtr(100),
			processedRows: 0,
			wantProgress:  0,
		},
		{
			name:          "25% progress",
			totalRows:     intPtr(200),
			processedRows: 50,
			wantProgress:  25,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job, err := importjob.NewImportJob(
				workspaceID,
				userID,
				importjob.EntityTypeItems,
				"items.csv",
				"/tmp/imports/items.csv",
				1024,
			)
			assert.NoError(t, err)

			if tt.totalRows != nil {
				job.Start(*tt.totalRows)
			}
			if tt.processedRows > 0 {
				job.UpdateProgress(tt.processedRows, tt.processedRows, 0)
			}

			assert.Equal(t, tt.wantProgress, job.Progress())
		})
	}
}

func TestImportJob_Getters(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	job, err := importjob.NewImportJob(
		workspaceID,
		userID,
		importjob.EntityTypeInventory,
		"inventory.csv",
		"/tmp/imports/inventory.csv",
		2048,
	)
	assert.NoError(t, err)

	// Test all getters on a freshly created job
	assert.NotEqual(t, uuid.Nil, job.ID())
	assert.Equal(t, workspaceID, job.WorkspaceID())
	assert.Equal(t, userID, job.UserID())
	assert.Equal(t, importjob.EntityTypeInventory, job.EntityType())
	assert.Equal(t, importjob.StatusPending, job.Status())
	assert.Equal(t, "inventory.csv", job.FileName())
	assert.Equal(t, "/tmp/imports/inventory.csv", job.FilePath())
	assert.Equal(t, int64(2048), job.FileSizeBytes())
	assert.Nil(t, job.TotalRows())
	assert.Equal(t, 0, job.ProcessedRows())
	assert.Equal(t, 0, job.SuccessCount())
	assert.Equal(t, 0, job.ErrorCount())
	assert.Nil(t, job.StartedAt())
	assert.Nil(t, job.CompletedAt())
	assert.Nil(t, job.ErrorMessage())
	assert.NotZero(t, job.CreatedAt())
	assert.NotZero(t, job.UpdatedAt())

	// Start the job and test again
	job.Start(500)

	assert.Equal(t, importjob.StatusProcessing, job.Status())
	assert.NotNil(t, job.TotalRows())
	assert.Equal(t, 500, *job.TotalRows())
	assert.NotNil(t, job.StartedAt())

	// Update progress and test
	job.UpdateProgress(250, 240, 10)

	assert.Equal(t, 250, job.ProcessedRows())
	assert.Equal(t, 240, job.SuccessCount())
	assert.Equal(t, 10, job.ErrorCount())
	assert.Equal(t, 50, job.Progress())
}

func TestImportJob_Reconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()
	totalRows := 100
	startedAt := time.Now().Add(-time.Hour)
	completedAt := time.Now()
	createdAt := time.Now().Add(-2 * time.Hour)
	updatedAt := time.Now()
	errorMessage := "Test error message"

	job := importjob.ReconstructImportJob(
		id,
		workspaceID,
		userID,
		importjob.EntityTypeCategories,
		importjob.StatusFailed,
		"categories.csv",
		"/tmp/imports/categories.csv",
		512,
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

	assert.NotNil(t, job)
	assert.Equal(t, id, job.ID())
	assert.Equal(t, workspaceID, job.WorkspaceID())
	assert.Equal(t, userID, job.UserID())
	assert.Equal(t, importjob.EntityTypeCategories, job.EntityType())
	assert.Equal(t, importjob.StatusFailed, job.Status())
	assert.Equal(t, "categories.csv", job.FileName())
	assert.Equal(t, "/tmp/imports/categories.csv", job.FilePath())
	assert.Equal(t, int64(512), job.FileSizeBytes())
	assert.NotNil(t, job.TotalRows())
	assert.Equal(t, totalRows, *job.TotalRows())
	assert.Equal(t, 50, job.ProcessedRows())
	assert.Equal(t, 45, job.SuccessCount())
	assert.Equal(t, 5, job.ErrorCount())
	assert.NotNil(t, job.StartedAt())
	assert.Equal(t, startedAt, *job.StartedAt())
	assert.NotNil(t, job.CompletedAt())
	assert.Equal(t, completedAt, *job.CompletedAt())
	assert.Equal(t, createdAt, job.CreatedAt())
	assert.Equal(t, updatedAt, job.UpdatedAt())
	assert.NotNil(t, job.ErrorMessage())
	assert.Equal(t, errorMessage, *job.ErrorMessage())
}

func TestImportJob_ReconstructWithNilOptionalFields(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()
	createdAt := time.Now()
	updatedAt := time.Now()

	job := importjob.ReconstructImportJob(
		id,
		workspaceID,
		userID,
		importjob.EntityTypeItems,
		importjob.StatusPending,
		"items.csv",
		"/tmp/imports/items.csv",
		1024,
		nil, // totalRows
		0,
		0,
		0,
		nil, // startedAt
		nil, // completedAt
		createdAt,
		updatedAt,
		nil, // errorMessage
	)

	assert.NotNil(t, job)
	assert.Nil(t, job.TotalRows())
	assert.Nil(t, job.StartedAt())
	assert.Nil(t, job.CompletedAt())
	assert.Nil(t, job.ErrorMessage())
}

func TestEntityType_Constants(t *testing.T) {
	assert.Equal(t, importjob.EntityType("items"), importjob.EntityTypeItems)
	assert.Equal(t, importjob.EntityType("inventory"), importjob.EntityTypeInventory)
	assert.Equal(t, importjob.EntityType("locations"), importjob.EntityTypeLocations)
	assert.Equal(t, importjob.EntityType("containers"), importjob.EntityTypeContainers)
	assert.Equal(t, importjob.EntityType("categories"), importjob.EntityTypeCategories)
	assert.Equal(t, importjob.EntityType("borrowers"), importjob.EntityTypeBorrowers)
}

func TestImportStatus_Constants(t *testing.T) {
	assert.Equal(t, importjob.ImportStatus("pending"), importjob.StatusPending)
	assert.Equal(t, importjob.ImportStatus("processing"), importjob.StatusProcessing)
	assert.Equal(t, importjob.ImportStatus("completed"), importjob.StatusCompleted)
	assert.Equal(t, importjob.ImportStatus("failed"), importjob.StatusFailed)
	assert.Equal(t, importjob.ImportStatus("cancelled"), importjob.StatusCancelled)
}

// TestNewImportError tests the NewImportError constructor
func TestNewImportError(t *testing.T) {
	importJobID := uuid.New()
	fieldName := "name"
	rowData := map[string]any{"name": "test", "value": 123}

	tests := []struct {
		name        string
		importJobID uuid.UUID
		rowNumber   int
		fieldName   *string
		errorMsg    string
		rowData     map[string]any
		wantErr     bool
		errMsg      string
	}{
		{
			name:        "valid import error with field name",
			importJobID: importJobID,
			rowNumber:   5,
			fieldName:   &fieldName,
			errorMsg:    "Invalid value",
			rowData:     rowData,
			wantErr:     false,
		},
		{
			name:        "valid import error without field name",
			importJobID: importJobID,
			rowNumber:   10,
			fieldName:   nil,
			errorMsg:    "Row validation failed",
			rowData:     rowData,
			wantErr:     false,
		},
		{
			name:        "valid import error with zero row number",
			importJobID: importJobID,
			rowNumber:   0,
			fieldName:   nil,
			errorMsg:    "Header row error",
			rowData:     nil,
			wantErr:     false,
		},
		{
			name:        "valid import error with nil row data",
			importJobID: importJobID,
			rowNumber:   3,
			fieldName:   &fieldName,
			errorMsg:    "Missing field",
			rowData:     nil,
			wantErr:     false,
		},
		{
			name:        "nil import job ID",
			importJobID: uuid.Nil,
			rowNumber:   5,
			fieldName:   &fieldName,
			errorMsg:    "Invalid value",
			rowData:     rowData,
			wantErr:     true,
			errMsg:      "import_job_id",
		},
		{
			name:        "negative row number",
			importJobID: importJobID,
			rowNumber:   -1,
			fieldName:   &fieldName,
			errorMsg:    "Invalid value",
			rowData:     rowData,
			wantErr:     true,
			errMsg:      "row number must be non-negative",
		},
		{
			name:        "empty error message",
			importJobID: importJobID,
			rowNumber:   5,
			fieldName:   &fieldName,
			errorMsg:    "",
			rowData:     rowData,
			wantErr:     true,
			errMsg:      "error message is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			importError, err := importjob.NewImportError(
				tt.importJobID,
				tt.rowNumber,
				tt.fieldName,
				tt.errorMsg,
				tt.rowData,
			)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, importError)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, importError)
				assert.NotEqual(t, uuid.Nil, importError.ID())
				assert.Equal(t, tt.importJobID, importError.ImportJobID())
				assert.Equal(t, tt.rowNumber, importError.RowNumber())
				assert.Equal(t, tt.fieldName, importError.FieldName())
				assert.Equal(t, tt.errorMsg, importError.ErrorMessage())
				assert.Equal(t, tt.rowData, importError.RowData())
				assert.NotZero(t, importError.CreatedAt())
			}
		})
	}
}

func TestImportError_Getters(t *testing.T) {
	importJobID := uuid.New()
	fieldName := "quantity"
	rowData := map[string]any{
		"name":     "Test Item",
		"quantity": "invalid",
	}

	importError, err := importjob.NewImportError(
		importJobID,
		15,
		&fieldName,
		"Quantity must be a number",
		rowData,
	)
	assert.NoError(t, err)

	assert.NotEqual(t, uuid.Nil, importError.ID())
	assert.Equal(t, importJobID, importError.ImportJobID())
	assert.Equal(t, 15, importError.RowNumber())
	assert.NotNil(t, importError.FieldName())
	assert.Equal(t, fieldName, *importError.FieldName())
	assert.Equal(t, "Quantity must be a number", importError.ErrorMessage())
	assert.Equal(t, rowData, importError.RowData())
	assert.NotZero(t, importError.CreatedAt())
}

func TestImportError_Reconstruct(t *testing.T) {
	id := uuid.New()
	importJobID := uuid.New()
	fieldName := "category"
	rowData := map[string]any{"category": "unknown"}
	createdAt := time.Now()

	importError := importjob.ReconstructImportError(
		id,
		importJobID,
		25,
		&fieldName,
		"Unknown category",
		rowData,
		createdAt,
	)

	assert.NotNil(t, importError)
	assert.Equal(t, id, importError.ID())
	assert.Equal(t, importJobID, importError.ImportJobID())
	assert.Equal(t, 25, importError.RowNumber())
	assert.NotNil(t, importError.FieldName())
	assert.Equal(t, fieldName, *importError.FieldName())
	assert.Equal(t, "Unknown category", importError.ErrorMessage())
	assert.Equal(t, rowData, importError.RowData())
	assert.Equal(t, createdAt, importError.CreatedAt())
}

func TestImportError_ReconstructWithNilFields(t *testing.T) {
	id := uuid.New()
	importJobID := uuid.New()
	createdAt := time.Now()

	importError := importjob.ReconstructImportError(
		id,
		importJobID,
		30,
		nil, // fieldName
		"General error",
		nil, // rowData
		createdAt,
	)

	assert.NotNil(t, importError)
	assert.Nil(t, importError.FieldName())
	assert.Nil(t, importError.RowData())
}

// Helper function to create an int pointer
func intPtr(i int) *int {
	return &i
}
