package wishlist

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

const (
	msgWorkspaceContextRequired = "workspace context required"
	routeWishlistByID           = "/wishlist/{id}"
	msgWishlistItemNotFound     = "wishlist item not found"
)

// RegisterRoutes registers wishlist routes on the workspace tree.
//
// The acquire flow has no dedicated endpoint: "mark acquired" is
// PATCH /wishlist/{id} with {"status":"acquired","acquired_item_id":...}.
// Keeping it on PATCH means member requests route through the approval
// pipeline as a regular update (a bespoke POST sub-action would be
// misclassified as a create by the approval middleware).
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List wishlist items (optionally filtered by status), sorted by priority
	huma.Get(api, "/wishlist", func(ctx context.Context, input *ListWishlistInput) (*ListWishlistOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		var status *Status
		if input.Status != "" {
			s := Status(input.Status)
			status = &s
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		items, total, err := svc.List(ctx, workspaceID, status, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list wishlist items")
		}

		responses := make([]WishlistItemResponse, len(items))
		for i, item := range items {
			responses[i] = toItemResponse(item)
		}

		return &ListWishlistOutput{
			Body: WishlistListResponse{Items: responses, Total: total},
		}, nil
	})

	// Get wishlist item by ID
	huma.Get(api, routeWishlistByID, func(ctx context.Context, input *GetWishlistItemInput) (*GetWishlistItemOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		item, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrItemNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound(msgWishlistItemNotFound)
			}
			return nil, huma.Error500InternalServerError("failed to get wishlist item")
		}

		return &GetWishlistItemOutput{Body: toItemResponse(item)}, nil
	})

	// Create wishlist item
	huma.Post(api, "/wishlist", func(ctx context.Context, input *CreateWishlistItemInput) (*CreateWishlistItemOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		var createdBy *uuid.UUID
		if authUser, ok := appMiddleware.GetAuthUser(ctx); ok && authUser != nil {
			createdBy = &authUser.ID
		}

		priority := PriorityDefault
		if input.Body.Priority != nil {
			priority = *input.Body.Priority
		}

		item, err := svc.Create(ctx, CreateInput{
			WorkspaceID:       workspaceID,
			Name:              input.Body.Name,
			Notes:             input.Body.Notes,
			URL:               input.Body.URL,
			PriceEstimate:     input.Body.PriceEstimate,
			CurrencyCode:      input.Body.CurrencyCode,
			Priority:          priority,
			DesiredCategoryID: input.Body.DesiredCategoryID,
			CreatedBy:         createdBy,
		})
		if err != nil {
			if errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound("category not found")
			}
			if isValidationError(err) {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishEvent(ctx, broadcaster, workspaceID, "wishlist.created", item)

		return &CreateWishlistItemOutput{Body: toItemResponse(item)}, nil
	})

	// Update wishlist item (details and/or lifecycle transition; setting
	// status=acquired with acquired_item_id is the "mark acquired" path)
	huma.Patch(api, routeWishlistByID, func(ctx context.Context, input *UpdateWishlistItemInput) (*UpdateWishlistItemOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		var status *Status
		if input.Body.Status != nil {
			s := Status(*input.Body.Status)
			status = &s
		}

		item, err := svc.Update(ctx, input.ID, workspaceID, UpdateInput{
			Name:              input.Body.Name,
			Notes:             input.Body.Notes,
			URL:               input.Body.URL,
			PriceEstimate:     input.Body.PriceEstimate,
			CurrencyCode:      input.Body.CurrencyCode,
			Priority:          input.Body.Priority,
			DesiredCategoryID: input.Body.DesiredCategoryID,
			Status:            status,
			AcquiredItemID:    input.Body.AcquiredItemID,
		})
		if err != nil {
			if errors.Is(err, ErrItemNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound(msgWishlistItemNotFound)
			}
			if errors.Is(err, ErrInvalidStatusTransition) {
				return nil, huma.Error409Conflict(err.Error())
			}
			if isValidationError(err) {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishEvent(ctx, broadcaster, workspaceID, "wishlist.updated", item)

		return &UpdateWishlistItemOutput{Body: toItemResponse(item)}, nil
	})

	// Delete wishlist item
	huma.Delete(api, routeWishlistByID, func(ctx context.Context, input *GetWishlistItemInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		itemID := input.ID
		if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
			if errors.Is(err, ErrItemNotFound) || errors.Is(err, shared.ErrNotFound) {
				return nil, huma.Error404NotFound(msgWishlistItemNotFound)
			}
			return nil, huma.Error500InternalServerError("failed to delete wishlist item")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "wishlist.deleted",
				EntityID:   itemID.String(),
				EntityType: "wishlist",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        itemID,
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})
}

// isValidationError reports whether err is one of the wishlist domain
// validation errors mapped to 400 Bad Request.
func isValidationError(err error) bool {
	return errors.Is(err, ErrInvalidName) ||
		errors.Is(err, ErrInvalidPrice) ||
		errors.Is(err, ErrInvalidCurrency) ||
		errors.Is(err, ErrInvalidPriority) ||
		errors.Is(err, ErrInvalidStatus)
}

func publishEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, eventType string, item *Item) {
	authUser, _ := appMiddleware.GetAuthUser(ctx)
	if broadcaster == nil || authUser == nil {
		return
	}
	userName := appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   item.ID().String(),
		EntityType: "wishlist",
		UserID:     authUser.ID,
		Data: map[string]any{
			"id":        item.ID(),
			"name":      item.Name(),
			"status":    string(item.Status()),
			"user_name": userName,
		},
	})
}

func toItemResponse(i *Item) WishlistItemResponse {
	return WishlistItemResponse{
		ID:                i.ID(),
		WorkspaceID:       i.WorkspaceID(),
		Name:              i.Name(),
		Notes:             i.Notes(),
		URL:               i.URL(),
		PriceEstimate:     i.PriceEstimate(),
		CurrencyCode:      i.CurrencyCode(),
		Priority:          i.Priority(),
		DesiredCategoryID: i.DesiredCategoryID(),
		Status:            string(i.Status()),
		AcquiredItemID:    i.AcquiredItemID(),
		CreatedBy:         i.CreatedBy(),
		CreatedAt:         i.CreatedAt(),
		UpdatedAt:         i.UpdatedAt(),
	}
}

// Request/Response types

type ListWishlistInput struct {
	Status string `query:"status" enum:"wanted,ordered,acquired" doc:"Filter by lifecycle status (omit = all)"`
	Page   int    `query:"page" default:"1" minimum:"1"`
	Limit  int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListWishlistOutput struct {
	Body WishlistListResponse
}

type WishlistListResponse struct {
	Items []WishlistItemResponse `json:"items"`
	Total int                    `json:"total"`
}

type GetWishlistItemInput struct {
	ID uuid.UUID `path:"id"`
}

type GetWishlistItemOutput struct {
	Body WishlistItemResponse
}

type CreateWishlistItemInput struct {
	Body struct {
		Name              string     `json:"name" minLength:"1" maxLength:"200" doc:"What to acquire"`
		Notes             *string    `json:"notes,omitempty" doc:"Optional free-form notes"`
		URL               *string    `json:"url,omitempty" maxLength:"2000" doc:"Optional product/shop URL"`
		PriceEstimate     *int       `json:"price_estimate,omitempty" minimum:"0" doc:"Estimated price in cents"`
		CurrencyCode      *string    `json:"currency_code,omitempty" pattern:"^[A-Z]{3}$" doc:"ISO 4217 currency code"`
		Priority          *int       `json:"priority,omitempty" minimum:"1" maximum:"5" doc:"1 = highest, 5 = lowest (default 3)"`
		DesiredCategoryID *uuid.UUID `json:"desired_category_id,omitempty" doc:"Category the item should land in once acquired"`
	}
}

type CreateWishlistItemOutput struct {
	Body WishlistItemResponse
}

type UpdateWishlistItemInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name              *string    `json:"name,omitempty" maxLength:"200"`
		Notes             *string    `json:"notes,omitempty"`
		URL               *string    `json:"url,omitempty" maxLength:"2000"`
		PriceEstimate     *int       `json:"price_estimate,omitempty" minimum:"0"`
		CurrencyCode      *string    `json:"currency_code,omitempty" pattern:"^[A-Z]{3}$"`
		Priority          *int       `json:"priority,omitempty" minimum:"1" maximum:"5"`
		DesiredCategoryID *uuid.UUID `json:"desired_category_id,omitempty"`
		Status            *string    `json:"status,omitempty" enum:"wanted,ordered,acquired" doc:"Lifecycle transition; acquired closes the row"`
		AcquiredItemID    *uuid.UUID `json:"acquired_item_id,omitempty" doc:"Item created from this wish; links back and closes the row"`
	}
}

type UpdateWishlistItemOutput struct {
	Body WishlistItemResponse
}

type WishlistItemResponse struct {
	ID                uuid.UUID  `json:"id"`
	WorkspaceID       uuid.UUID  `json:"workspace_id"`
	Name              string     `json:"name"`
	Notes             *string    `json:"notes,omitempty"`
	URL               *string    `json:"url,omitempty"`
	PriceEstimate     *int       `json:"price_estimate,omitempty" doc:"Cents"`
	CurrencyCode      *string    `json:"currency_code,omitempty"`
	Priority          int        `json:"priority"`
	DesiredCategoryID *uuid.UUID `json:"desired_category_id,omitempty"`
	Status            string     `json:"status"`
	AcquiredItemID    *uuid.UUID `json:"acquired_item_id,omitempty"`
	CreatedBy         *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}
