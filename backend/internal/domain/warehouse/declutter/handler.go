package declutter

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// RegisterRoutes registers declutter routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List unused inventory
	huma.Get(api, "/declutter", func(ctx context.Context, input *ListInput) (*ListOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Build params from input
		params := ListParams{
			WorkspaceID:   workspaceID,
			ThresholdDays: input.ThresholdDays,
			GroupBy:       GroupBy(input.GroupBy),
			Page:          input.Page,
			PageSize:      input.Limit,
		}

		result, err := svc.ListUnused(ctx, params)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list unused inventory")
		}

		items := make([]DeclutterItemResponse, len(result.Items))
		for i, item := range result.Items {
			items[i] = toDeclutterItemResponse(item)
		}

		return &ListOutput{
			Body: DeclutterListResponse{
				Items: items,
				Total: result.Total,
			},
		}, nil
	})

	// Get unused inventory counts
	huma.Get(api, "/declutter/counts", func(ctx context.Context, input *struct{}) (*CountsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		counts, err := svc.GetCounts(ctx, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get unused counts")
		}

		return &CountsOutput{
			Body: DeclutterCountsResponse{
				Unused90:  counts.Unused90,
				Unused180: counts.Unused180,
				Unused365: counts.Unused365,
				Value90:   counts.Value90,
				Value180:  counts.Value180,
				Value365:  counts.Value365,
			},
		}, nil
	})

	// Mark inventory as used
	huma.Post(api, "/inventory/{inventory_id}/mark-used", func(ctx context.Context, input *MarkUsedInput) (*MarkUsedOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.MarkUsed(ctx, input.InventoryID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark inventory as used")
		}

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "inventory.marked_used",
				EntityID:   input.InventoryID.String(),
				EntityType: "inventory",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        input.InventoryID,
					"user_name": userName,
				},
			})
		}

		return &MarkUsedOutput{
			Body: MarkUsedResponse{
				Success: true,
				Message: "Inventory marked as used",
			},
		}, nil
	})
}

func toDeclutterItemResponse(item DeclutterItem) DeclutterItemResponse {
	var lastUsedAt *string
	if item.LastUsedAt != nil {
		s := item.LastUsedAt.Format(time.RFC3339)
		lastUsedAt = &s
	}

	return DeclutterItemResponse{
		ID:            item.ID,
		WorkspaceID:   item.WorkspaceID,
		ItemID:        item.ItemID,
		LocationID:    item.LocationID,
		ContainerID:   item.ContainerID,
		Quantity:      item.Quantity,
		Condition:     item.Condition,
		Status:        item.Status,
		PurchasePrice: item.PurchasePrice,
		CurrencyCode:  item.CurrencyCode,
		LastUsedAt:    lastUsedAt,
		CreatedAt:     item.CreatedAt,
		UpdatedAt:     item.UpdatedAt,
		ItemName:      item.ItemName,
		ItemSKU:       item.ItemSKU,
		LocationName:  item.LocationName,
		CategoryID:    item.CategoryID,
		CategoryName:  item.CategoryName,
		DaysUnused:    item.DaysUnused,
		Score:         item.Score,
	}
}

// Request/Response types

// ListInput contains query parameters for listing unused inventory.
type ListInput struct {
	ThresholdDays int    `query:"threshold_days" default:"90" minimum:"1" doc:"Minimum days since last use"`
	GroupBy       string `query:"group_by" default:"none" enum:"none,category,location" doc:"Group results by category or location"`
	Page          int    `query:"page" default:"1" minimum:"1" doc:"Page number"`
	Limit         int    `query:"limit" default:"50" minimum:"1" maximum:"100" doc:"Items per page"`
}

// ListOutput is the response for listing unused inventory.
type ListOutput struct {
	Body DeclutterListResponse
}

// DeclutterListResponse contains the list of unused items.
type DeclutterListResponse struct {
	Items []DeclutterItemResponse `json:"items"`
	Total int                     `json:"total"`
}

// DeclutterItemResponse represents a single unused inventory item in the response.
type DeclutterItemResponse struct {
	ID            uuid.UUID  `json:"id"`
	WorkspaceID   uuid.UUID  `json:"workspace_id"`
	ItemID        uuid.UUID  `json:"item_id"`
	LocationID    uuid.UUID  `json:"location_id"`
	ContainerID   *uuid.UUID `json:"container_id,omitempty"`
	Quantity      int        `json:"quantity"`
	Condition     *string    `json:"condition,omitempty"`
	Status        *string    `json:"status,omitempty"`
	PurchasePrice *int       `json:"purchase_price,omitempty"`
	CurrencyCode  *string    `json:"currency_code,omitempty"`
	LastUsedAt    *string    `json:"last_used_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	ItemName      string     `json:"item_name"`
	ItemSKU       string     `json:"item_sku"`
	LocationName  string     `json:"location_name"`
	CategoryID    *uuid.UUID `json:"category_id,omitempty"`
	CategoryName  *string    `json:"category_name,omitempty"`
	DaysUnused    int        `json:"days_unused"`
	Score         int        `json:"score" doc:"Declutter priority score (higher = should declutter sooner)"`
}

// CountsOutput is the response for getting unused inventory counts.
type CountsOutput struct {
	Body DeclutterCountsResponse
}

// DeclutterCountsResponse contains summary counts at different thresholds.
type DeclutterCountsResponse struct {
	Unused90  int   `json:"unused_90" doc:"Count of items unused for 90+ days"`
	Unused180 int   `json:"unused_180" doc:"Count of items unused for 180+ days"`
	Unused365 int   `json:"unused_365" doc:"Count of items unused for 365+ days"`
	Value90   int64 `json:"value_90" doc:"Total value (cents) of items unused 90+ days"`
	Value180  int64 `json:"value_180" doc:"Total value (cents) of items unused 180+ days"`
	Value365  int64 `json:"value_365" doc:"Total value (cents) of items unused 365+ days"`
}

// MarkUsedInput contains the inventory ID to mark as used.
type MarkUsedInput struct {
	InventoryID uuid.UUID `path:"inventory_id"`
}

// MarkUsedOutput is the response for marking inventory as used.
type MarkUsedOutput struct {
	Body MarkUsedResponse
}

// MarkUsedResponse indicates success of the mark-used operation.
type MarkUsedResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}
