package importexport

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

// Handler handles import/export HTTP requests
type Handler struct {
	svc *Service
}

// NewHandler creates a new import/export handler
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// ExportRequest is the input for export
type ExportRequest struct {
	WorkspaceID     uuid.UUID `path:"workspace_id" doc:"Workspace ID"`
	EntityType      string    `path:"entity_type" doc:"Entity type to export (item, location, container, category, label, company, borrower)"`
	Format          string    `query:"format" default:"csv" doc:"Export format (csv, json)"`
	IncludeArchived bool      `query:"include_archived" default:"false" doc:"Include archived records"`
}

// ExportResponse is the response for export
type ExportResponse struct {
	ContentType        string `header:"Content-Type"`
	ContentDisposition string `header:"Content-Disposition"`
	Body               []byte
}

// ImportRequest is the input for import
type ImportRequest struct {
	WorkspaceID uuid.UUID `path:"workspace_id" doc:"Workspace ID"`
	EntityType  string    `path:"entity_type" doc:"Entity type to import (item, location, container, category, label, company, borrower)"`
	Body        struct {
		Format string `json:"format" doc:"Import format (csv, json)"`
		Data   string `json:"data" doc:"Base64 encoded file content"`
	}
}

// ImportResponse is the response for import
type ImportResponse struct {
	Body ImportResult
}

// RegisterRoutes registers import/export routes with the Huma API
func (h *Handler) RegisterRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "export-entities",
		Method:      http.MethodGet,
		Path:        "/workspaces/{workspace_id}/export/{entity_type}",
		Summary:     "Export entities",
		Description: "Exports entities of the specified type to CSV or JSON format.",
		Tags:        []string{"Import/Export"},
	}, h.Export)

	huma.Register(api, huma.Operation{
		OperationID:   "import-entities",
		Method:        http.MethodPost,
		Path:          "/workspaces/{workspace_id}/import/{entity_type}",
		Summary:       "Import entities",
		Description:   "Imports entities of the specified type from CSV or JSON data. Data should be base64 encoded.",
		Tags:          []string{"Import/Export"},
		DefaultStatus: http.StatusOK,
	}, h.Import)
}

// Export handles the export request
func (h *Handler) Export(ctx context.Context, input *ExportRequest) (*ExportResponse, error) {
	// Validate entity type
	entityType := EntityType(input.EntityType)
	if !entityType.IsValid() {
		return nil, huma.Error400BadRequest(fmt.Sprintf("invalid entity type: %s. Supported types: item, location, container, category, label, company, borrower", input.EntityType))
	}

	// Validate format
	format := Format(input.Format)
	if !format.IsValid() {
		return nil, huma.Error400BadRequest(fmt.Sprintf("invalid format: %s. Supported formats: csv, json", input.Format))
	}

	// Perform export
	data, metadata, err := h.svc.Export(ctx, ExportOptions{
		WorkspaceID:     input.WorkspaceID,
		EntityType:      entityType,
		Format:          format,
		IncludeArchived: input.IncludeArchived,
	})
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to export data", err)
	}

	// Set content type and disposition
	contentType := "text/csv"
	extension := "csv"
	if format == FormatJSON {
		contentType = "application/json"
		extension = "json"
	}

	filename := fmt.Sprintf("%s_export_%d.%s", input.EntityType, metadata.TotalRecords, extension)

	return &ExportResponse{
		ContentType:        contentType,
		ContentDisposition: fmt.Sprintf("attachment; filename=%s", filename),
		Body:               data,
	}, nil
}

// Import handles the import request
func (h *Handler) Import(ctx context.Context, input *ImportRequest) (*ImportResponse, error) {
	// Validate entity type
	entityType := EntityType(input.EntityType)
	if !entityType.IsValid() {
		return nil, huma.Error400BadRequest(fmt.Sprintf("invalid entity type: %s. Supported types: item, location, container, category, label, company, borrower", input.EntityType))
	}

	// Validate format
	format := Format(input.Body.Format)
	if !format.IsValid() {
		return nil, huma.Error400BadRequest(fmt.Sprintf("invalid format: %s. Supported formats: csv, json", input.Body.Format))
	}

	// Decode base64 data
	data, err := base64.StdEncoding.DecodeString(input.Body.Data)
	if err != nil {
		return nil, huma.Error400BadRequest("invalid base64 encoding in data field")
	}

	if len(data) == 0 {
		return nil, huma.Error400BadRequest("data field is empty")
	}

	// Perform import
	result, err := h.svc.Import(ctx, input.WorkspaceID, entityType, format, data)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to import data", err)
	}

	return &ImportResponse{Body: *result}, nil
}
