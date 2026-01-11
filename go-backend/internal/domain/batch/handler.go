package batch

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

type contextKey string

const WorkspaceContextKey contextKey = "workspace"

// BatchInput represents the request for batch operations.
type BatchInput struct {
	WorkspaceID uuid.UUID    `path:"workspace_id" format:"uuid" doc:"Workspace ID"`
	Body        BatchRequest `json:"body"`
}

// BatchOutput represents the response from batch operations.
type BatchOutput struct {
	Body BatchResponse `json:"body"`
}

// RegisterRoutes registers batch operation routes.
func RegisterRoutes(api huma.API, svc *Service) {
	// Process batch operations
	huma.Post(api, "/workspaces/{workspace_id}/sync/batch", func(ctx context.Context, input *BatchInput) (*BatchOutput, error) {
		// Validate workspace access from context
		ctxWorkspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Ensure workspace ID matches
		if ctxWorkspaceID != input.WorkspaceID {
			return nil, huma.Error403Forbidden("workspace mismatch")
		}

		// Validate request
		if len(input.Body.Operations) == 0 {
			return nil, huma.Error400BadRequest("no operations provided")
		}

		if len(input.Body.Operations) > 100 {
			return nil, huma.Error400BadRequest("maximum 100 operations per batch")
		}

		// Process the batch
		response, err := svc.ProcessBatch(ctx, input.WorkspaceID, input.Body)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to process batch")
		}

		return &BatchOutput{Body: *response}, nil
	})
}
