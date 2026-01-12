package batch

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// BatchInput represents the request for batch operations.
type BatchInput struct {
	Body BatchRequest `json:"body"`
}

// BatchOutput represents the response from batch operations.
type BatchOutput struct {
	Body BatchResponse `json:"body"`
}

// RegisterRoutes registers batch operation routes.
// Note: These routes are registered within a workspace-scoped router group,
// so paths are relative to /workspaces/{workspace_id}.
func RegisterRoutes(api huma.API, svc *Service) {
	// Process batch operations
	huma.Post(api, "/sync/batch", func(ctx context.Context, input *BatchInput) (*BatchOutput, error) {
		// Validate workspace access from context
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Validate request
		if len(input.Body.Operations) == 0 {
			return nil, huma.Error400BadRequest("no operations provided")
		}

		if len(input.Body.Operations) > 100 {
			return nil, huma.Error400BadRequest("maximum 100 operations per batch")
		}

		// Process the batch
		response, err := svc.ProcessBatch(ctx, workspaceID, input.Body)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to process batch")
		}

		return &BatchOutput{Body: *response}, nil
	})
}
