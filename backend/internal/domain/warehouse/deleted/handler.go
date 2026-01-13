package deleted

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// RegisterRoutes registers deleted records routes (for PWA sync).
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	// Get deleted records since timestamp (for PWA offline sync)
	huma.Get(api, "/sync/deleted", func(ctx context.Context, input *GetDeletedSinceInput) (*GetDeletedSinceOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Default to last 7 days if no since parameter provided
		since := time.Now().Add(-7 * 24 * time.Hour)
		if input.Since != "" {
			parsedTime, err := time.Parse(time.RFC3339, input.Since)
			if err != nil {
				return nil, huma.Error400BadRequest("invalid since format, use RFC3339")
			}
			since = parsedTime
		}

		records, err := svc.GetDeletedSince(ctx, workspaceID, since)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get deleted records")
		}

		items := make([]DeletedRecordResponse, len(records))
		for i, record := range records {
			items[i] = toDeletedRecordResponse(record)
		}

		return &GetDeletedSinceOutput{
			Body: DeletedListResponse{
				Items: items,
				Since: since,
			},
		}, nil
	})
}

func toDeletedRecordResponse(record *DeletedRecord) DeletedRecordResponse {
	return DeletedRecordResponse{
		ID:          record.ID(),
		WorkspaceID: record.WorkspaceID(),
		EntityType:  string(record.EntityType()),
		EntityID:    record.EntityID(),
		DeletedAt:   record.DeletedAt(),
		DeletedBy:   record.DeletedBy(),
	}
}

// Request/Response types

type GetDeletedSinceInput struct {
	Since string `query:"since" doc:"Get deleted records since this timestamp (RFC3339 format)"`
}

type GetDeletedSinceOutput struct {
	Body DeletedListResponse
}

type DeletedListResponse struct {
	Items []DeletedRecordResponse `json:"items"`
	Since time.Time               `json:"since" doc:"The timestamp used for the query"`
}

type DeletedRecordResponse struct {
	ID          uuid.UUID  `json:"id"`
	WorkspaceID uuid.UUID  `json:"workspace_id"`
	EntityType  string     `json:"entity_type" doc:"Type of entity: ITEM, INVENTORY, LOCATION, etc"`
	EntityID    uuid.UUID  `json:"entity_id" doc:"ID of the deleted entity"`
	DeletedAt   time.Time  `json:"deleted_at"`
	DeletedBy   *uuid.UUID `json:"deleted_by,omitempty"`
}
