package movement

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers movement routes (read-only, movements are created via inventory service).
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	// List all movements in workspace
	huma.Get(api, "/movements", func(ctx context.Context, input *ListWorkspaceMovementsInput) (*ListMovementsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		movements, err := svc.ListByWorkspace(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list movements")
		}

		items := make([]MovementResponse, len(movements))
		for i, m := range movements {
			items[i] = toMovementResponse(m)
		}

		return &ListMovementsOutput{
			Body: MovementListResponse{Items: items},
		}, nil
	})

	// List movements for an inventory item
	huma.Get(api, "/inventory/{inventory_id}/movements", func(ctx context.Context, input *ListMovementsInput) (*ListMovementsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		movements, err := svc.ListByInventory(ctx, input.InventoryID, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list movements")
		}

		items := make([]MovementResponse, len(movements))
		for i, m := range movements {
			items[i] = toMovementResponse(m)
		}

		return &ListMovementsOutput{
			Body: MovementListResponse{Items: items},
		}, nil
	})

	// List movements for a location
	huma.Get(api, "/locations/{location_id}/movements", func(ctx context.Context, input *ListLocationMovementsInput) (*ListMovementsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		movements, err := svc.ListByLocation(ctx, input.LocationID, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list movements")
		}

		items := make([]MovementResponse, len(movements))
		for i, m := range movements {
			items[i] = toMovementResponse(m)
		}

		return &ListMovementsOutput{
			Body: MovementListResponse{Items: items},
		}, nil
	})
}

func toMovementResponse(m *InventoryMovement) MovementResponse {
	return MovementResponse{
		ID:              m.ID(),
		WorkspaceID:     m.WorkspaceID(),
		InventoryID:     m.InventoryID(),
		FromLocationID:  m.FromLocationID(),
		FromContainerID: m.FromContainerID(),
		ToLocationID:    m.ToLocationID(),
		ToContainerID:   m.ToContainerID(),
		Quantity:        m.Quantity(),
		MovedBy:         m.MovedBy(),
		Reason:          m.Reason(),
		CreatedAt:       m.CreatedAt(),
	}
}

// Request/Response types

type ListMovementsInput struct {
	InventoryID uuid.UUID `path:"inventory_id"`
	Page        int       `query:"page" default:"1" minimum:"1"`
	Limit       int       `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListLocationMovementsInput struct {
	LocationID uuid.UUID `path:"location_id"`
	Page       int       `query:"page" default:"1" minimum:"1"`
	Limit      int       `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListWorkspaceMovementsInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListMovementsOutput struct {
	Body MovementListResponse
}

type MovementListResponse struct {
	Items []MovementResponse `json:"items"`
}

type MovementResponse struct {
	ID              uuid.UUID  `json:"id"`
	WorkspaceID     uuid.UUID  `json:"workspace_id"`
	InventoryID     uuid.UUID  `json:"inventory_id"`
	FromLocationID  *uuid.UUID `json:"from_location_id,omitempty"`
	FromContainerID *uuid.UUID `json:"from_container_id,omitempty"`
	ToLocationID    *uuid.UUID `json:"to_location_id,omitempty"`
	ToContainerID   *uuid.UUID `json:"to_container_id,omitempty"`
	Quantity        int        `json:"quantity"`
	MovedBy         *uuid.UUID `json:"moved_by,omitempty"`
	Reason          *string    `json:"reason,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}
