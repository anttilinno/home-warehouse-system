package sync

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

// Handler handles sync-related HTTP requests
type Handler struct {
	svc *Service
}

// NewHandler creates a new sync handler
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// DeltaSyncRequest is the input for delta sync
type DeltaSyncRequest struct {
	WorkspaceID   uuid.UUID  `path:"workspace_id" doc:"Workspace ID"`
	ModifiedSince *time.Time `query:"modified_since" doc:"ISO 8601 timestamp for incremental sync. If omitted, performs full sync."`
	EntityTypes   string     `query:"entity_types" doc:"Comma-separated entity types to sync (item,location,container,inventory,category,label,company,borrower,loan). If omitted, syncs all types."`
	Limit         int        `query:"limit" default:"500" minimum:"1" maximum:"1000" doc:"Maximum number of records per entity type"`
}

// DeltaSyncResponse is the response for delta sync
type DeltaSyncResponse struct {
	Body SyncResult
}

// RegisterRoutes registers sync routes with the Huma API
func (h *Handler) RegisterRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-delta-sync",
		Method:      http.MethodGet,
		Path:        "/workspaces/{workspace_id}/sync/delta",
		Summary:     "Get delta sync data",
		Description: "Retrieves all entities modified since the given timestamp for offline PWA synchronization. Returns entities that have been created, updated, or deleted.",
		Tags:        []string{"Sync"},
	}, h.GetDelta)
}

// GetDelta handles the delta sync request
func (h *Handler) GetDelta(ctx context.Context, input *DeltaSyncRequest) (*DeltaSyncResponse, error) {
	entityTypes := ParseEntityTypes(input.EntityTypes)

	result, err := h.svc.GetDelta(ctx, DeltaSyncInput{
		WorkspaceID:   input.WorkspaceID,
		ModifiedSince: input.ModifiedSince,
		EntityTypes:   entityTypes,
		Limit:         int32(input.Limit),
	})
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch sync data", err)
	}

	return &DeltaSyncResponse{Body: *result}, nil
}
