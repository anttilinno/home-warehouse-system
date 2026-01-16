package importexport_test

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/importexport"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements importexport.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) Export(ctx context.Context, opts importexport.ExportOptions) ([]byte, *importexport.ExportMetadata, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, nil, args.Error(2)
	}
	return args.Get(0).([]byte), args.Get(1).(*importexport.ExportMetadata), args.Error(2)
}

func (m *MockService) Import(ctx context.Context, workspaceID uuid.UUID, entityType importexport.EntityType, format importexport.Format, data []byte) (*importexport.ImportResult, error) {
	args := m.Called(ctx, workspaceID, entityType, format, data)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*importexport.ImportResult), args.Error(1)
}

// Tests

func TestImportExportHandler_Export(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := importexport.NewHandler(mockSvc, nil)
	handler.RegisterRoutes(setup.API)

	t.Run("exports items as CSV successfully", func(t *testing.T) {
		csvData := []byte("id,sku,name\n123,SKU-001,Test Item\n")
		metadata := &importexport.ExportMetadata{
			EntityType:   importexport.EntityTypeItem,
			Format:       importexport.FormatCSV,
			TotalRecords: 1,
			ExportedAt:   time.Now(),
			WorkspaceID:  setup.WorkspaceID,
		}

		mockSvc.On("Export", mock.Anything, mock.MatchedBy(func(opts importexport.ExportOptions) bool {
			return opts.EntityType == importexport.EntityTypeItem &&
				opts.Format == importexport.FormatCSV &&
				opts.WorkspaceID == setup.WorkspaceID
		})).Return(csvData, metadata, nil).Once()

		rec := setup.Get("/export/item?format=csv")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("exports items as JSON successfully", func(t *testing.T) {
		jsonData := []byte(`[{"id":"123","sku":"SKU-001","name":"Test Item"}]`)
		metadata := &importexport.ExportMetadata{
			EntityType:   importexport.EntityTypeItem,
			Format:       importexport.FormatJSON,
			TotalRecords: 1,
			ExportedAt:   time.Now(),
			WorkspaceID:  setup.WorkspaceID,
		}

		mockSvc.On("Export", mock.Anything, mock.MatchedBy(func(opts importexport.ExportOptions) bool {
			return opts.EntityType == importexport.EntityTypeItem &&
				opts.Format == importexport.FormatJSON &&
				opts.WorkspaceID == setup.WorkspaceID
		})).Return(jsonData, metadata, nil).Once()

		rec := setup.Get("/export/item?format=json")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("includes archived records when requested", func(t *testing.T) {
		csvData := []byte("id,sku,name\n123,SKU-001,Test Item\n")
		metadata := &importexport.ExportMetadata{
			EntityType:   importexport.EntityTypeItem,
			Format:       importexport.FormatCSV,
			TotalRecords: 1,
			ExportedAt:   time.Now(),
			WorkspaceID:  setup.WorkspaceID,
		}

		mockSvc.On("Export", mock.Anything, mock.MatchedBy(func(opts importexport.ExportOptions) bool {
			return opts.IncludeArchived == true
		})).Return(csvData, metadata, nil).Once()

		rec := setup.Get("/export/item?include_archived=true")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("exports locations successfully", func(t *testing.T) {
		csvData := []byte("id,name,zone\n123,Warehouse A,Zone 1\n")
		metadata := &importexport.ExportMetadata{
			EntityType:   importexport.EntityTypeLocation,
			Format:       importexport.FormatCSV,
			TotalRecords: 1,
			ExportedAt:   time.Now(),
			WorkspaceID:  setup.WorkspaceID,
		}

		mockSvc.On("Export", mock.Anything, mock.MatchedBy(func(opts importexport.ExportOptions) bool {
			return opts.EntityType == importexport.EntityTypeLocation
		})).Return(csvData, metadata, nil).Once()

		rec := setup.Get("/export/location")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("exports categories successfully", func(t *testing.T) {
		csvData := []byte("id,name,description\n123,Electronics,Electronic items\n")
		metadata := &importexport.ExportMetadata{
			EntityType:   importexport.EntityTypeCategory,
			Format:       importexport.FormatCSV,
			TotalRecords: 1,
			ExportedAt:   time.Now(),
			WorkspaceID:  setup.WorkspaceID,
		}

		mockSvc.On("Export", mock.Anything, mock.MatchedBy(func(opts importexport.ExportOptions) bool {
			return opts.EntityType == importexport.EntityTypeCategory
		})).Return(csvData, metadata, nil).Once()

		rec := setup.Get("/export/category")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid entity type", func(t *testing.T) {
		rec := setup.Get("/export/invalid_type")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns 400 for invalid format", func(t *testing.T) {
		rec := setup.Get("/export/item?format=xml")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("Export", mock.Anything, mock.Anything).
			Return(nil, nil, fmt.Errorf("test error")).Once()

		rec := setup.Get("/export/item")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestImportExportHandler_Import(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := importexport.NewHandler(mockSvc, nil)
	handler.RegisterRoutes(setup.API)

	t.Run("imports items from CSV successfully", func(t *testing.T) {
		csvData := "sku,name\nSKU-001,Test Item\n"
		encodedData := base64.StdEncoding.EncodeToString([]byte(csvData))

		result := &importexport.ImportResult{
			TotalRows: 1,
			Succeeded: 1,
			Failed:    0,
			Errors:    []importexport.ImportError{},
		}

		mockSvc.On("Import", mock.Anything, setup.WorkspaceID, importexport.EntityTypeItem, importexport.FormatCSV, []byte(csvData)).
			Return(result, nil).Once()

		body := `{
			"format": "csv",
			"data": "` + encodedData + `"
		}`

		rec := setup.Post("/import/item", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("imports items from JSON successfully", func(t *testing.T) {
		jsonData := `[{"sku":"SKU-001","name":"Test Item"}]`
		encodedData := base64.StdEncoding.EncodeToString([]byte(jsonData))

		result := &importexport.ImportResult{
			TotalRows: 1,
			Succeeded: 1,
			Failed:    0,
			Errors:    []importexport.ImportError{},
		}

		mockSvc.On("Import", mock.Anything, setup.WorkspaceID, importexport.EntityTypeItem, importexport.FormatJSON, []byte(jsonData)).
			Return(result, nil).Once()

		body := `{
			"format": "json",
			"data": "` + encodedData + `"
		}`

		rec := setup.Post("/import/item", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles import with errors", func(t *testing.T) {
		csvData := "name\nTest Item\n\n"
		encodedData := base64.StdEncoding.EncodeToString([]byte(csvData))

		result := &importexport.ImportResult{
			TotalRows: 2,
			Succeeded: 1,
			Failed:    1,
			Errors: []importexport.ImportError{
				{
					Row:     2,
					Message: "name is required",
					Code:    "VALIDATION_ERROR",
				},
			},
		}

		mockSvc.On("Import", mock.Anything, setup.WorkspaceID, importexport.EntityTypeItem, importexport.FormatCSV, []byte(csvData)).
			Return(result, nil).Once()

		body := `{
			"format": "csv",
			"data": "` + encodedData + `"
		}`

		rec := setup.Post("/import/item", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("imports locations successfully", func(t *testing.T) {
		csvData := "name,zone\nWarehouse A,Zone 1\n"
		encodedData := base64.StdEncoding.EncodeToString([]byte(csvData))

		result := &importexport.ImportResult{
			TotalRows: 1,
			Succeeded: 1,
			Failed:    0,
			Errors:    []importexport.ImportError{},
		}

		mockSvc.On("Import", mock.Anything, setup.WorkspaceID, importexport.EntityTypeLocation, importexport.FormatCSV, []byte(csvData)).
			Return(result, nil).Once()

		body := `{
			"format": "csv",
			"data": "` + encodedData + `"
		}`

		rec := setup.Post("/import/location", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("imports categories successfully", func(t *testing.T) {
		csvData := "name,description\nElectronics,Electronic items\n"
		encodedData := base64.StdEncoding.EncodeToString([]byte(csvData))

		result := &importexport.ImportResult{
			TotalRows: 1,
			Succeeded: 1,
			Failed:    0,
			Errors:    []importexport.ImportError{},
		}

		mockSvc.On("Import", mock.Anything, setup.WorkspaceID, importexport.EntityTypeCategory, importexport.FormatCSV, []byte(csvData)).
			Return(result, nil).Once()

		body := `{
			"format": "csv",
			"data": "` + encodedData + `"
		}`

		rec := setup.Post("/import/category", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid entity type", func(t *testing.T) {
		body := `{
			"format": "csv",
			"data": "dGVzdA=="
		}`

		rec := setup.Post("/import/invalid_type", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns 400 for invalid format", func(t *testing.T) {
		body := `{
			"format": "xml",
			"data": "dGVzdA=="
		}`

		rec := setup.Post("/import/item", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns 400 for invalid base64 encoding", func(t *testing.T) {
		body := `{
			"format": "csv",
			"data": "invalid-base64!!!"
		}`

		rec := setup.Post("/import/item", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns 400 for empty data", func(t *testing.T) {
		encodedData := base64.StdEncoding.EncodeToString([]byte(""))

		body := `{
			"format": "csv",
			"data": "` + encodedData + `"
		}`

		rec := setup.Post("/import/item", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("handles service error", func(t *testing.T) {
		csvData := "sku,name\nSKU-001,Test Item\n"
		encodedData := base64.StdEncoding.EncodeToString([]byte(csvData))

		mockSvc.On("Import", mock.Anything, setup.WorkspaceID, importexport.EntityTypeItem, importexport.FormatCSV, []byte(csvData)).
			Return(nil, fmt.Errorf("test error")).Once()

		body := `{
			"format": "csv",
			"data": "` + encodedData + `"
		}`

		rec := setup.Post("/import/item", body)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}
