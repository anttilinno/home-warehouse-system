package importjob_test

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
)

// UploadTestSetup provides test infrastructure for upload handler tests
type UploadTestSetup struct {
	Router      *chi.Mux
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
	authUser    *appMiddleware.AuthUser
}

// NewUploadTestSetup creates a new test setup with Chi router for upload testing
func NewUploadTestSetup() *UploadTestSetup {
	r := chi.NewRouter()
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	authUser := &appMiddleware.AuthUser{
		ID:          userID,
		Email:       "test@example.com",
		IsSuperuser: false,
	}

	setup := &UploadTestSetup{
		Router:      r,
		WorkspaceID: workspaceID,
		UserID:      userID,
		authUser:    authUser,
	}

	// Inject workspace and user context middleware for testing
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := req.Context()
			ctx = context.WithValue(ctx, appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
			ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})

	return setup
}

// createUploadRequest creates a multipart form request with a file
func createUploadRequest(t *testing.T, entityType, filename string, content []byte) *http.Request {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add entity_type field
	err := writer.WriteField("entity_type", entityType)
	assert.NoError(t, err)

	// Add file
	part, err := writer.CreateFormFile("file", filename)
	assert.NoError(t, err)
	_, err = part.Write(content)
	assert.NoError(t, err)

	err = writer.Close()
	assert.NoError(t, err)

	req := httptest.NewRequest("POST", "/imports/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	return req
}

// createUploadRequestWithoutFile creates a request without a file
func createUploadRequestWithoutFile(t *testing.T, entityType string) *http.Request {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	err := writer.WriteField("entity_type", entityType)
	assert.NoError(t, err)

	err = writer.Close()
	assert.NoError(t, err)

	req := httptest.NewRequest("POST", "/imports/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	return req
}

// createUploadRequestWithoutEntityType creates a request without entity_type
func createUploadRequestWithoutEntityType(t *testing.T) *http.Request {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", "test.csv")
	assert.NoError(t, err)
	_, err = part.Write([]byte("name,value\ntest,123"))
	assert.NoError(t, err)

	err = writer.Close()
	assert.NoError(t, err)

	req := httptest.NewRequest("POST", "/imports/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	return req
}

// Tests for Upload Handler - Invalid Entity Type

func TestUploadHandler_InvalidEntityType(t *testing.T) {
	setup := NewUploadTestSetup()
	mockRepo := new(MockRepository)

	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(setup.Router)

	t.Run("rejects invalid entity type", func(t *testing.T) {
		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "invalid_type", "test.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "invalid entity_type")
	})

	t.Run("rejects empty entity type", func(t *testing.T) {
		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "", "test.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("rejects unknown entity type users", func(t *testing.T) {
		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "users", "test.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "invalid entity_type")
	})
}

// Tests for Upload Handler - Missing Entity Type

func TestUploadHandler_MissingEntityType(t *testing.T) {
	setup := NewUploadTestSetup()
	mockRepo := new(MockRepository)

	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(setup.Router)

	t.Run("rejects request without entity_type", func(t *testing.T) {
		req := createUploadRequestWithoutEntityType(t)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "entity_type is required")
	})
}

// Tests for Upload Handler - Missing File

func TestUploadHandler_MissingFile(t *testing.T) {
	setup := NewUploadTestSetup()
	mockRepo := new(MockRepository)

	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(setup.Router)

	t.Run("rejects request without file", func(t *testing.T) {
		req := createUploadRequestWithoutFile(t, "items")

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "file is required")
	})
}

// Tests for Upload Handler - Invalid File Extension

func TestUploadHandler_InvalidFileExtension(t *testing.T) {
	setup := NewUploadTestSetup()
	mockRepo := new(MockRepository)

	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(setup.Router)

	fileExtensions := []struct {
		ext  string
		name string
	}{
		{".txt", "test.txt"},
		{".xlsx", "spreadsheet.xlsx"},
		{".json", "data.json"},
		{".xml", "data.xml"},
		{".pdf", "document.pdf"},
		{".doc", "document.doc"},
		{".xls", "spreadsheet.xls"},
	}

	for _, tt := range fileExtensions {
		t.Run("rejects "+tt.ext+" file extension", func(t *testing.T) {
			content := []byte("some content")
			req := createUploadRequest(t, "items", tt.name, content)

			// Inject context
			ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
			ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
			req = req.WithContext(ctx)

			rec := httptest.NewRecorder()
			setup.Router.ServeHTTP(rec, req)

			assert.Equal(t, http.StatusBadRequest, rec.Code)
			assert.Contains(t, rec.Body.String(), "only CSV files are supported")
		})
	}
}

// Tests for Upload Handler - Missing Workspace Context

func TestUploadHandler_MissingWorkspaceContext(t *testing.T) {
	mockRepo := new(MockRepository)

	// Create router without workspace middleware
	r := chi.NewRouter()
	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(r)

	t.Run("rejects request without workspace context", func(t *testing.T) {
		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "items", "test.csv", csvContent)

		// Don't inject workspace context
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
		assert.Contains(t, rec.Body.String(), "workspace context required")
	})
}

// Tests for Upload Handler - Missing User Context

func TestUploadHandler_MissingUserContext(t *testing.T) {
	setup := NewUploadTestSetup()
	mockRepo := new(MockRepository)

	// Create router with only workspace middleware
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
			// Don't inject user context
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(r)

	t.Run("rejects request without user context", func(t *testing.T) {
		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "items", "test.csv", csvContent)

		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
		assert.Contains(t, rec.Body.String(), "user context required")
	})
}

// Tests for Upload Handler - SaveJob Error

func TestUploadHandler_SaveJobError(t *testing.T) {
	setup := NewUploadTestSetup()
	mockRepo := new(MockRepository)

	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(setup.Router)

	t.Run("returns 500 when SaveJob fails", func(t *testing.T) {
		mockRepo.On("SaveJob", mock.Anything, mock.Anything).
			Return(errors.New("database error")).Once()

		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "items", "test.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusInternalServerError, rec.Code)
		assert.Contains(t, rec.Body.String(), "failed to create import job")
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns 500 when SaveJob fails for inventory entity", func(t *testing.T) {
		mockRepo.On("SaveJob", mock.Anything, mock.MatchedBy(func(job *importjob.ImportJob) bool {
			return job.EntityType() == importjob.EntityTypeInventory
		})).Return(errors.New("database connection lost")).Once()

		csvContent := []byte("location,item,quantity\nA-1,Widget,10")
		req := createUploadRequest(t, "inventory", "inventory.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusInternalServerError, rec.Code)
		assert.Contains(t, rec.Body.String(), "failed to create import job")
		mockRepo.AssertExpectations(t)
	})
}

// Tests for Upload Handler - Validates Job Entity Types

func TestUploadHandler_ValidEntityTypes(t *testing.T) {
	// For these tests, we only verify that valid entity types pass validation
	// by checking that the SaveJob is called with the correct entity type
	// The tests fail after SaveJob (at the queue step) which is expected

	entityTypes := []struct {
		entityType string
		expected   importjob.EntityType
	}{
		{"items", importjob.EntityTypeItems},
		{"inventory", importjob.EntityTypeInventory},
		{"locations", importjob.EntityTypeLocations},
		{"containers", importjob.EntityTypeContainers},
		{"categories", importjob.EntityTypeCategories},
		{"borrowers", importjob.EntityTypeBorrowers},
	}

	for _, tt := range entityTypes {
		t.Run("validates "+tt.entityType+" entity type reaches SaveJob", func(t *testing.T) {
			setup := NewUploadTestSetup()
			mockRepo := new(MockRepository)

			handler := importjob.NewUploadHandler(mockRepo, nil)
			handler.RegisterUploadRoutes(setup.Router)

			// Mock SaveJob to fail - this proves validation passed
			mockRepo.On("SaveJob", mock.Anything, mock.MatchedBy(func(job *importjob.ImportJob) bool {
				return job.EntityType() == tt.expected
			})).Return(errors.New("mock error")).Once()

			csvContent := []byte("col1,col2\nval1,val2")
			req := createUploadRequest(t, tt.entityType, "test.csv", csvContent)

			// Inject context
			ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
			ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
			req = req.WithContext(ctx)

			rec := httptest.NewRecorder()
			setup.Router.ServeHTTP(rec, req)

			// SaveJob was called with correct entity type - proves validation passed
			mockRepo.AssertExpectations(t)
		})
	}
}

// Tests for Upload Handler - File Metadata Validation

func TestUploadHandler_FileMetadataValidation(t *testing.T) {
	setup := NewUploadTestSetup()
	mockRepo := new(MockRepository)

	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(setup.Router)

	t.Run("passes correct filename to SaveJob", func(t *testing.T) {
		mockRepo.On("SaveJob", mock.Anything, mock.MatchedBy(func(job *importjob.ImportJob) bool {
			return job.FileName() == "my_data_file.csv"
		})).Return(errors.New("mock error")).Once()

		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "items", "my_data_file.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		mockRepo.AssertExpectations(t)
	})

	t.Run("passes file size to SaveJob", func(t *testing.T) {
		csvContent := []byte("name,value\ntest,123\ntest2,456")

		mockRepo.On("SaveJob", mock.Anything, mock.MatchedBy(func(job *importjob.ImportJob) bool {
			return job.FileSizeBytes() > 0
		})).Return(errors.New("mock error")).Once()

		req := createUploadRequest(t, "items", "data.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		mockRepo.AssertExpectations(t)
	})

	t.Run("passes workspace ID from context to SaveJob", func(t *testing.T) {
		mockRepo.On("SaveJob", mock.Anything, mock.MatchedBy(func(job *importjob.ImportJob) bool {
			return job.WorkspaceID() == setup.WorkspaceID
		})).Return(errors.New("mock error")).Once()

		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "items", "test.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		mockRepo.AssertExpectations(t)
	})

	t.Run("passes user ID from context to SaveJob", func(t *testing.T) {
		mockRepo.On("SaveJob", mock.Anything, mock.MatchedBy(func(job *importjob.ImportJob) bool {
			return job.UserID() == setup.UserID
		})).Return(errors.New("mock error")).Once()

		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "items", "test.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		mockRepo.AssertExpectations(t)
	})
}

// Tests for Upload Handler - Case Insensitive File Extension

func TestUploadHandler_FileExtensionCaseInsensitive(t *testing.T) {
	extensions := []string{".CSV", ".Csv", ".cSv"}

	for _, ext := range extensions {
		t.Run("accepts "+ext+" extension", func(t *testing.T) {
			setup := NewUploadTestSetup()
			mockRepo := new(MockRepository)

			handler := importjob.NewUploadHandler(mockRepo, nil)
			handler.RegisterUploadRoutes(setup.Router)

			// Mock SaveJob to prove validation passed
			mockRepo.On("SaveJob", mock.Anything, mock.Anything).
				Return(errors.New("mock error")).Once()

			csvContent := []byte("name,value\ntest,123")
			req := createUploadRequest(t, "items", "test"+ext, csvContent)

			// Inject context
			ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
			ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
			req = req.WithContext(ctx)

			rec := httptest.NewRecorder()
			setup.Router.ServeHTTP(rec, req)

			// If SaveJob was called, extension validation passed
			mockRepo.AssertExpectations(t)
		})
	}
}

// Tests for Upload Handler - Initial Job State

func TestUploadHandler_InitialJobState(t *testing.T) {
	setup := NewUploadTestSetup()
	mockRepo := new(MockRepository)

	handler := importjob.NewUploadHandler(mockRepo, nil)
	handler.RegisterUploadRoutes(setup.Router)

	t.Run("creates job with pending status", func(t *testing.T) {
		mockRepo.On("SaveJob", mock.Anything, mock.MatchedBy(func(job *importjob.ImportJob) bool {
			return job.Status() == importjob.StatusPending
		})).Return(errors.New("mock error")).Once()

		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "items", "test.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		mockRepo.AssertExpectations(t)
	})

	t.Run("creates job with zero progress", func(t *testing.T) {
		mockRepo.On("SaveJob", mock.Anything, mock.MatchedBy(func(job *importjob.ImportJob) bool {
			return job.ProcessedRows() == 0 && job.SuccessCount() == 0 && job.ErrorCount() == 0
		})).Return(errors.New("mock error")).Once()

		csvContent := []byte("name,value\ntest,123")
		req := createUploadRequest(t, "items", "test.csv", csvContent)

		// Inject context
		ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, setup.WorkspaceID)
		ctx = context.WithValue(ctx, appMiddleware.UserContextKey, setup.authUser)
		req = req.WithContext(ctx)

		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		mockRepo.AssertExpectations(t)
	})
}
