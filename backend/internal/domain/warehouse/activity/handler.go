package activity

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers activity routes.
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	// List workspace activity (optionally filtered by user_id)
	huma.Get(api, "/activity", func(ctx context.Context, input *ListActivityInput) (*ListActivityOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}

		var logs []*ActivityLog
		var err error

		if input.UserID != "" {
			userID, parseErr := uuid.Parse(input.UserID)
			if parseErr != nil {
				return nil, huma.Error400BadRequest("invalid user_id format")
			}
			logs, err = svc.ListByUser(ctx, workspaceID, userID, pagination)
		} else {
			logs, err = svc.ListByWorkspace(ctx, workspaceID, pagination)
		}

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list activity")
		}

		items := make([]ActivityLogResponse, len(logs))
		for i, log := range logs {
			items[i] = toActivityLogResponse(log)
		}

		return &ListActivityOutput{
			Body: ActivityListResponse{Items: items},
		}, nil
	})

	// List activity by entity
	huma.Get(api, "/activity/{entity_type}/{entity_id}", func(ctx context.Context, input *ListByEntityInput) (*ListActivityOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		entityType := EntityType(input.EntityType)
		if !entityType.IsValid() {
			return nil, huma.Error400BadRequest("invalid entity type")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		logs, err := svc.ListByEntity(ctx, workspaceID, entityType, input.EntityID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list activity")
		}

		items := make([]ActivityLogResponse, len(logs))
		for i, log := range logs {
			items[i] = toActivityLogResponse(log)
		}

		return &ListActivityOutput{
			Body: ActivityListResponse{Items: items},
		}, nil
	})

	// Get recent activity since timestamp
	huma.Get(api, "/activity/recent", func(ctx context.Context, input *RecentActivityInput) (*ListActivityOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		since := time.Now().Add(-24 * time.Hour) // Default: last 24 hours
		if input.Since != "" {
			parsedTime, parseErr := time.Parse(time.RFC3339, input.Since)
			if parseErr != nil {
				return nil, huma.Error400BadRequest("invalid since format, use RFC3339")
			}
			since = parsedTime
		}

		logs, err := svc.GetRecentActivity(ctx, workspaceID, since)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get recent activity")
		}

		items := make([]ActivityLogResponse, len(logs))
		for i, log := range logs {
			items[i] = toActivityLogResponse(log)
		}

		return &ListActivityOutput{
			Body: ActivityListResponse{Items: items},
		}, nil
	})
}

func toActivityLogResponse(log *ActivityLog) ActivityLogResponse {
	return ActivityLogResponse{
		ID:          log.ID(),
		WorkspaceID: log.WorkspaceID(),
		UserID:      log.UserID(),
		Action:      string(log.Action()),
		EntityType:  string(log.EntityType()),
		EntityID:    log.EntityID(),
		EntityName:  log.EntityName(),
		Changes:     log.Changes(),
		Metadata:    log.Metadata(),
		OccurredAt:  log.CreatedAt(),
	}
}

// Request/Response types

type ListActivityInput struct {
	Page   int    `query:"page" default:"1" minimum:"1"`
	Limit  int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
	UserID string `query:"user_id" doc:"Optional user ID to filter by"`
}

type ListByEntityInput struct {
	EntityType string    `path:"entity_type"`
	EntityID   uuid.UUID `path:"entity_id"`
	Page       int       `query:"page" default:"1" minimum:"1"`
	Limit      int       `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type RecentActivityInput struct {
	Since string `query:"since" doc:"ISO 8601 timestamp to get activity since"`
}

type ListActivityOutput struct {
	Body ActivityListResponse
}

type ActivityListResponse struct {
	Items []ActivityLogResponse `json:"items"`
}

type ActivityLogResponse struct {
	ID          uuid.UUID              `json:"id"`
	WorkspaceID uuid.UUID              `json:"workspace_id"`
	UserID      *uuid.UUID             `json:"user_id,omitempty"`
	Action      string                 `json:"action"`
	EntityType  string                 `json:"entity_type"`
	EntityID    uuid.UUID              `json:"entity_id"`
	EntityName  string                 `json:"entity_name"`
	Changes     map[string]interface{} `json:"changes,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	OccurredAt  time.Time              `json:"occurred_at"`
}
