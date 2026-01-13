package sync

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// Handler handles sync-related HTTP requests
type Handler struct {
	svc ServiceInterface
}

// NewHandler creates a new sync handler
func NewHandler(svc ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// DeltaSyncRequest is the input for delta sync
type DeltaSyncRequest struct {
	ModifiedSince string `query:"modified_since" doc:"ISO 8601 timestamp for incremental sync. If omitted, performs full sync."`
	EntityTypes   string `query:"entity_types" doc:"Comma-separated entity types to sync (item,location,container,inventory,category,label,company,borrower,loan). If omitted, syncs all types."`
	Limit         int    `query:"limit" default:"500" minimum:"1" maximum:"1000" doc:"Maximum number of records per entity type"`
}

// DeltaSyncResponse is the response for delta sync
type DeltaSyncResponse struct {
	Body SyncResult
}

// RegisterRoutes registers sync routes with the Huma API.
// Note: These routes are registered within a workspace-scoped router group,
// so paths are relative to /workspaces/{workspace_id}.
func (h *Handler) RegisterRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-delta-sync",
		Method:      http.MethodGet,
		Path:        "/sync/delta",
		Summary:     "Get delta sync data",
		Description: "Retrieves all entities modified since the given timestamp for offline PWA synchronization. Returns entities that have been created, updated, or deleted.",
		Tags:        []string{"Sync"},
	}, h.GetDelta)
}

// GetDelta handles the delta sync request
func (h *Handler) GetDelta(ctx context.Context, input *DeltaSyncRequest) (*DeltaSyncResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}

	entityTypes := ParseEntityTypes(input.EntityTypes)

	var modifiedSince *time.Time
	if input.ModifiedSince != "" {
		parsedTime, err := time.Parse(time.RFC3339, input.ModifiedSince)
		if err != nil {
			return nil, huma.Error400BadRequest("invalid modified_since format, use RFC3339")
		}
		modifiedSince = &parsedTime
	}

	result, err := h.svc.GetDelta(ctx, DeltaSyncInput{
		WorkspaceID:   workspaceID,
		ModifiedSince: modifiedSince,
		EntityTypes:   entityTypes,
		Limit:         int32(input.Limit),
	})
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch sync data", err)
	}

	return &DeltaSyncResponse{Body: *result}, nil
}
