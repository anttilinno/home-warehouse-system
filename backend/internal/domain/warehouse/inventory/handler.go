package inventory

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
	eventInventoryUpdated = "inventory.updated"
	// A move is audited as a MOVE action rather than a generic UPDATE (see
	// activity.NewEventTap), so it needs its own event name.
	eventInventoryMoved      = "inventory.moved"
	msgFailedToListInventory = "failed to list inventory"
	msgInventoryNotFound     = "inventory not found"
)

// RegisterRoutes registers inventory routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	registerQueryRoutes(api, svc)
	registerMutationRoutes(api, svc, broadcaster)
	registerActionRoutes(api, svc, broadcaster)
}

// registerQueryRoutes registers read-only inventory routes.
func registerQueryRoutes(api huma.API, svc ServiceInterface) {
	huma.Get(api, "/inventory", listInventory(svc))
	huma.Get(api, "/inventory/{id}", getInventory(svc))
	huma.Get(api, "/inventory/by-item/{item_id}", listInventoryByItem(svc))
	huma.Get(api, "/inventory/by-location/{location_id}", listInventoryByLocation(svc))
	huma.Get(api, "/inventory/by-container/{container_id}", listInventoryByContainer(svc))
	huma.Get(api, "/inventory/available/{item_id}", listAvailableInventory(svc))
	huma.Get(api, "/inventory/total-quantity/{item_id}", getTotalQuantity(svc))
	huma.Get(api, "/inventory/expiring", listExpiringInventory(svc))
}

// registerMutationRoutes registers create/update inventory routes.
func registerMutationRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Post(api, "/inventory", createInventory(svc, broadcaster))
	huma.Patch(api, "/inventory/{id}", updateInventory(svc, broadcaster))
	huma.Patch(api, "/inventory/{id}/status", updateInventoryStatus(svc, broadcaster))
	huma.Patch(api, "/inventory/{id}/quantity", updateInventoryQuantity(svc, broadcaster))
}

// registerActionRoutes registers inventory action routes (move, archive, restore).
func registerActionRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Post(api, "/inventory/{id}/move", moveInventory(svc, broadcaster))
	huma.Post(api, "/inventory/{id}/archive", archiveInventory(svc, broadcaster))
	huma.Post(api, "/inventory/{id}/restore", restoreInventory(svc, broadcaster))
}

// publishInventoryEvent emits an SSE event for an inventory mutation, mirroring
// the per-route inline publish blocks: it no-ops when there is no broadcaster or
// no authenticated user, and injects the user display name into the data map.
func publishInventoryEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, eventType, entityID string, data map[string]any) {
	authUser, _ := appMiddleware.GetAuthUser(ctx)
	if broadcaster == nil || authUser == nil {
		return
	}
	data["user_name"] = appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   entityID,
		EntityType: "inventory",
		UserID:     authUser.ID,
		Data:       data,
	})
}

// listInventory lists inventory in the workspace (optionally scoped to a container).
func listInventory(svc ServiceInterface) func(context.Context, *ListInventoryInput) (*ListInventoryOutput, error) {
	return func(ctx context.Context, input *ListInventoryInput) (*ListInventoryOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		// If a valid container filter is supplied, delegate to the container-scoped
		// path. A malformed UUID is silently treated as no filter (mirrors the
		// item handler's category_id parsing).
		if input.ContainerID != "" {
			if containerID, perr := uuid.Parse(input.ContainerID); perr == nil {
				items, err := svc.ListByContainer(ctx, workspaceID, containerID)
				if err != nil {
					return nil, huma.Error500InternalServerError(msgFailedToListInventory)
				}

				responses := toInventoryResponses(items)
				return &ListInventoryOutput{
					Body: InventoryListResponse{
						Items:      responses,
						Total:      len(responses),
						Page:       input.Page,
						TotalPages: 1,
					},
				}, nil
			}
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		inventories, total, err := svc.List(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError(msgFailedToListInventory)
		}

		responses := make([]InventoryResponse, len(inventories))
		for i, inv := range inventories {
			responses[i] = toInventoryResponse(inv)
		}

		return &ListInventoryOutput{
			Body: InventoryListResponse{
				Items:      responses,
				Total:      total,
				Page:       input.Page,
				TotalPages: (total + input.Limit - 1) / input.Limit,
			},
		}, nil
	}
}

// getInventory returns a single inventory entry by ID.
func getInventory(svc ServiceInterface) func(context.Context, *GetInventoryInput) (*GetInventoryOutput, error) {
	return func(ctx context.Context, input *GetInventoryInput) (*GetInventoryOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		inv, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrInventoryNotFound) {
				return nil, huma.Error404NotFound(msgInventoryNotFound)
			}
			return nil, huma.Error500InternalServerError("failed to get inventory")
		}

		return &GetInventoryOutput{Body: toInventoryResponse(inv)}, nil
	}
}

// listInventoryByItem lists inventory entries for an item.
func listInventoryByItem(svc ServiceInterface) func(context.Context, *GetByItemInput) (*ListInventoryOutput, error) {
	return func(ctx context.Context, input *GetByItemInput) (*ListInventoryOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		items, err := svc.ListByItem(ctx, workspaceID, input.ItemID)
		if err != nil {
			return nil, huma.Error500InternalServerError(msgFailedToListInventory)
		}

		return &ListInventoryOutput{Body: InventoryListResponse{Items: toInventoryResponses(items)}}, nil
	}
}

// listInventoryByLocation lists inventory entries for a location.
func listInventoryByLocation(svc ServiceInterface) func(context.Context, *GetByLocationInput) (*ListInventoryOutput, error) {
	return func(ctx context.Context, input *GetByLocationInput) (*ListInventoryOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		items, err := svc.ListByLocation(ctx, workspaceID, input.LocationID)
		if err != nil {
			return nil, huma.Error500InternalServerError(msgFailedToListInventory)
		}

		return &ListInventoryOutput{Body: InventoryListResponse{Items: toInventoryResponses(items)}}, nil
	}
}

// listInventoryByContainer lists inventory entries for a container.
func listInventoryByContainer(svc ServiceInterface) func(context.Context, *GetByContainerInput) (*ListInventoryOutput, error) {
	return func(ctx context.Context, input *GetByContainerInput) (*ListInventoryOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		items, err := svc.ListByContainer(ctx, workspaceID, input.ContainerID)
		if err != nil {
			return nil, huma.Error500InternalServerError(msgFailedToListInventory)
		}

		return &ListInventoryOutput{Body: InventoryListResponse{Items: toInventoryResponses(items)}}, nil
	}
}

// listAvailableInventory lists available inventory entries for an item.
func listAvailableInventory(svc ServiceInterface) func(context.Context, *GetByItemInput) (*ListInventoryOutput, error) {
	return func(ctx context.Context, input *GetByItemInput) (*ListInventoryOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		items, err := svc.GetAvailable(ctx, workspaceID, input.ItemID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get available inventory")
		}

		return &ListInventoryOutput{Body: InventoryListResponse{Items: toInventoryResponses(items)}}, nil
	}
}

// getTotalQuantity returns the total quantity for an item across inventory entries.
func getTotalQuantity(svc ServiceInterface) func(context.Context, *GetByItemInput) (*GetTotalQuantityOutput, error) {
	return func(ctx context.Context, input *GetByItemInput) (*GetTotalQuantityOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		total, err := svc.GetTotalQuantity(ctx, workspaceID, input.ItemID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get total quantity")
		}

		return &GetTotalQuantityOutput{Body: TotalQuantityResponse{ItemID: input.ItemID, TotalQuantity: total}}, nil
	}
}

// listExpiringInventory returns inventory entries expiring within the window.
func listExpiringInventory(svc ServiceInterface) func(context.Context, *ListExpiringInput) (*ListExpiringOutput, error) {
	return func(ctx context.Context, input *ListExpiringInput) (*ListExpiringOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		entries, err := svc.ListExpiring(ctx, workspaceID, input.Days)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list expiring inventory")
		}

		responses := make([]ExpiringInventoryResponse, len(entries))
		for i, e := range entries {
			responses[i] = ExpiringInventoryResponse{
				InventoryID: e.InventoryID,
				ItemID:      e.ItemID,
				ItemName:    e.ItemName,
				Quantity:    e.Quantity,
				Kind:        e.Kind,
				Date:        e.Date.Format("2006-01-02"),
			}
		}

		return &ListExpiringOutput{
			Body: ExpiringInventoryListResponse{Items: responses, Total: len(responses)},
		}, nil
	}
}

// createInventory creates an inventory entry.
func createInventory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateInventoryInput) (*CreateInventoryOutput, error) {
	return func(ctx context.Context, input *CreateInventoryInput) (*CreateInventoryOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		inv, err := svc.Create(ctx, CreateInput{
			WorkspaceID:     workspaceID,
			ItemID:          input.Body.ItemID,
			LocationID:      input.Body.LocationID,
			ContainerID:     input.Body.ContainerID,
			Quantity:        input.Body.Quantity,
			Condition:       input.Body.Condition,
			Status:          input.Body.Status,
			DateAcquired:    input.Body.DateAcquired,
			PurchasePrice:   input.Body.PurchasePrice,
			CurrencyCode:    input.Body.CurrencyCode,
			WarrantyExpires: input.Body.WarrantyExpires,
			ExpirationDate:  input.Body.ExpirationDate,
			Notes:           input.Body.Notes,
			IdempotencyKey:  input.IdempotencyKey,
		})
		if err != nil {
			if errors.Is(err, ErrInventoryNotFound) {
				return nil, huma.Error404NotFound(msgInventoryNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishInventoryEvent(ctx, broadcaster, workspaceID, "inventory.created", inv.ID().String(), map[string]any{
			"id":      inv.ID(),
			"item_id": inv.ItemID(),
			"status":  inv.Status(),
		})

		return &CreateInventoryOutput{Body: toInventoryResponse(inv)}, nil
	}
}

// updateInventory updates an inventory entry.
func updateInventory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateInventoryInput) (*UpdateInventoryOutput, error) {
	return func(ctx context.Context, input *UpdateInventoryInput) (*UpdateInventoryOutput, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		inv, err := svc.Update(ctx, input.ID, workspaceID, UpdateInput{
			LocationID:      input.Body.LocationID,
			ContainerID:     input.Body.ContainerID,
			Quantity:        input.Body.Quantity,
			Condition:       input.Body.Condition,
			DateAcquired:    input.Body.DateAcquired,
			PurchasePrice:   input.Body.PurchasePrice,
			CurrencyCode:    input.Body.CurrencyCode,
			WarrantyExpires: input.Body.WarrantyExpires,
			ExpirationDate:  input.Body.ExpirationDate,
			Notes:           input.Body.Notes,
		})
		if err != nil {
			if errors.Is(err, ErrInventoryNotFound) {
				return nil, huma.Error404NotFound(msgInventoryNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishInventoryEvent(ctx, broadcaster, workspaceID, eventInventoryUpdated, inv.ID().String(), map[string]any{
			"id":     inv.ID(),
			"status": inv.Status(),
		})

		return &UpdateInventoryOutput{Body: toInventoryResponse(inv)}, nil
	}
}

// mutateInventory runs a single-entry mutation that returns the updated entry,
// applies the standard not-found/domain error mapping, publishes eventType as an
// SSE event with the supplied data map, and returns the update output. It
// collapses the otherwise byte-identical bodies of the status/quantity/move
// handlers into one place.
func mutateInventory(
	ctx context.Context,
	broadcaster *events.Broadcaster,
	eventType string,
	mutate func(ctx context.Context, workspaceID uuid.UUID) (*Inventory, error),
	data func(inv *Inventory) map[string]any,
) (*UpdateInventoryOutput, error) {
	workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized(err.Error())
	}

	inv, err := mutate(ctx, workspaceID)
	if err != nil {
		if errors.Is(err, ErrInventoryNotFound) {
			return nil, huma.Error404NotFound(msgInventoryNotFound)
		}
		return nil, appMiddleware.MapDomainError(err)
	}

	publishInventoryEvent(ctx, broadcaster, workspaceID, eventType, inv.ID().String(), data(inv))

	return &UpdateInventoryOutput{Body: toInventoryResponse(inv)}, nil
}

// updateInventoryStatus updates an inventory entry's status.
func updateInventoryStatus(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateStatusInput) (*UpdateInventoryOutput, error) {
	return func(ctx context.Context, input *UpdateStatusInput) (*UpdateInventoryOutput, error) {
		return mutateInventory(ctx, broadcaster, eventInventoryUpdated,
			func(ctx context.Context, workspaceID uuid.UUID) (*Inventory, error) {
				return svc.UpdateStatus(ctx, input.ID, workspaceID, input.Body.Status)
			},
			func(inv *Inventory) map[string]any {
				return map[string]any{"id": inv.ID(), "status": inv.Status()}
			},
		)
	}
}

// updateInventoryQuantity updates an inventory entry's quantity.
func updateInventoryQuantity(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateQuantityInput) (*UpdateInventoryOutput, error) {
	return func(ctx context.Context, input *UpdateQuantityInput) (*UpdateInventoryOutput, error) {
		return mutateInventory(ctx, broadcaster, eventInventoryUpdated,
			func(ctx context.Context, workspaceID uuid.UUID) (*Inventory, error) {
				return svc.UpdateQuantity(ctx, input.ID, workspaceID, input.Body.Quantity)
			},
			func(inv *Inventory) map[string]any {
				return map[string]any{"id": inv.ID(), "quantity": inv.Quantity()}
			},
		)
	}
}

// moveInventory moves an inventory entry to a new location/container.
func moveInventory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *MoveInventoryInput) (*UpdateInventoryOutput, error) {
	return func(ctx context.Context, input *MoveInventoryInput) (*UpdateInventoryOutput, error) {
		return mutateInventory(ctx, broadcaster, eventInventoryMoved,
			func(ctx context.Context, workspaceID uuid.UUID) (*Inventory, error) {
				return svc.Move(ctx, input.ID, workspaceID, input.Body.LocationID, input.Body.ContainerID)
			},
			func(inv *Inventory) map[string]any {
				return map[string]any{"id": inv.ID(), "location_id": inv.LocationID()}
			},
		)
	}
}

// archiveInventory archives an inventory entry.
func archiveInventory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetInventoryInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetInventoryInput) (*struct{}, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		if err := svc.Archive(ctx, input.ID, workspaceID); err != nil {
			if errors.Is(err, ErrInventoryNotFound) {
				return nil, huma.Error404NotFound(msgInventoryNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishInventoryEvent(ctx, broadcaster, workspaceID, "inventory.deleted", input.ID.String(), map[string]any{})

		return nil, nil
	}
}

// restoreInventory restores an archived inventory entry.
func restoreInventory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetInventoryInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetInventoryInput) (*struct{}, error) {
		workspaceID, err := appMiddleware.RequireWorkspaceID(ctx)
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		if err := svc.Restore(ctx, input.ID, workspaceID); err != nil {
			if errors.Is(err, ErrInventoryNotFound) {
				return nil, huma.Error404NotFound(msgInventoryNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishInventoryEvent(ctx, broadcaster, workspaceID, "inventory.created", input.ID.String(), map[string]any{})

		return nil, nil
	}
}

// toInventoryResponses converts a slice of Inventory to InventoryResponse.
func toInventoryResponses(items []*Inventory) []InventoryResponse {
	responses := make([]InventoryResponse, len(items))
	for i, inv := range items {
		responses[i] = toInventoryResponse(inv)
	}
	return responses
}

func toInventoryResponse(inv *Inventory) InventoryResponse {
	return InventoryResponse{
		ID:              inv.ID(),
		WorkspaceID:     inv.WorkspaceID(),
		ItemID:          inv.ItemID(),
		LocationID:      inv.LocationID(),
		ContainerID:     inv.ContainerID(),
		Quantity:        inv.Quantity(),
		Condition:       inv.Condition(),
		Status:          inv.Status(),
		DateAcquired:    inv.DateAcquired(),
		PurchasePrice:   inv.PurchasePrice(),
		CurrencyCode:    inv.CurrencyCode(),
		WarrantyExpires: inv.WarrantyExpires(),
		ExpirationDate:  inv.ExpirationDate(),
		Notes:           inv.Notes(),
		IsArchived:      inv.IsArchived(),
		CreatedAt:       inv.CreatedAt(),
		UpdatedAt:       inv.UpdatedAt(),
	}
}

// Request/Response types

type ListInventoryInput struct {
	Page        int    `query:"page" default:"1" minimum:"1"`
	Limit       int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
	ContainerID string `query:"container_id,omitempty" doc:"Optional: narrow results to inventory in a specific container (UUID)"`
}

type GetInventoryInput struct {
	ID uuid.UUID `path:"id"`
}

type GetInventoryOutput struct {
	Body InventoryResponse
}

type GetByItemInput struct {
	ItemID uuid.UUID `path:"item_id"`
}

type GetByLocationInput struct {
	LocationID uuid.UUID `path:"location_id"`
}

type GetByContainerInput struct {
	ContainerID uuid.UUID `path:"container_id"`
}

type ListInventoryOutput struct {
	Body InventoryListResponse
}

type InventoryListResponse struct {
	Items      []InventoryResponse `json:"items"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	TotalPages int                 `json:"total_pages"`
}

type GetTotalQuantityOutput struct {
	Body TotalQuantityResponse
}

type TotalQuantityResponse struct {
	ItemID        uuid.UUID `json:"item_id"`
	TotalQuantity int       `json:"total_quantity"`
}

type CreateInventoryInput struct {
	// IdempotencyKey lets a replayed create (offline-queued PWA write whose
	// original response was lost) return the ORIGINAL entry instead of a
	// duplicate. Optional — a request without it always creates.
	IdempotencyKey string `header:"Idempotency-Key" doc:"Client-generated key; a repeated create with the same key returns the original entity instead of creating a duplicate"`
	Body           struct {
		ItemID          uuid.UUID  `json:"item_id" doc:"Item ID this inventory represents"`
		LocationID      uuid.UUID  `json:"location_id" doc:"Location where inventory is stored"`
		ContainerID     *uuid.UUID `json:"container_id,omitempty" doc:"Optional container ID"`
		Quantity        int        `json:"quantity" minimum:"1" doc:"Quantity of items"`
		Condition       Condition  `json:"condition" enum:"NEW,EXCELLENT,GOOD,FAIR,POOR,DAMAGED,FOR_REPAIR" doc:"Item condition"`
		Status          Status     `json:"status" enum:"AVAILABLE,IN_USE,RESERVED,ON_LOAN,IN_TRANSIT,DISPOSED,MISSING" doc:"Item status"`
		DateAcquired    *time.Time `json:"date_acquired,omitempty" doc:"Date item was acquired"`
		PurchasePrice   *int       `json:"purchase_price,omitempty" doc:"Purchase price in cents"`
		CurrencyCode    *string    `json:"currency_code,omitempty" maxLength:"3" doc:"ISO currency code (e.g., USD, EUR)"`
		WarrantyExpires *time.Time `json:"warranty_expires,omitempty" doc:"Warranty expiration date"`
		ExpirationDate  *time.Time `json:"expiration_date,omitempty" doc:"Item expiration date"`
		Notes           *string    `json:"notes,omitempty" doc:"Additional notes"`
	}
}

type CreateInventoryOutput struct {
	Body InventoryResponse
}

type UpdateInventoryInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		LocationID      uuid.UUID  `json:"location_id" doc:"Location where inventory is stored"`
		ContainerID     *uuid.UUID `json:"container_id,omitempty" doc:"Optional container ID"`
		Quantity        int        `json:"quantity" minimum:"1" doc:"Quantity of items"`
		Condition       Condition  `json:"condition" enum:"NEW,EXCELLENT,GOOD,FAIR,POOR,DAMAGED,FOR_REPAIR" doc:"Item condition"`
		DateAcquired    *time.Time `json:"date_acquired,omitempty" doc:"Date item was acquired"`
		PurchasePrice   *int       `json:"purchase_price,omitempty" doc:"Purchase price in cents"`
		CurrencyCode    *string    `json:"currency_code,omitempty" maxLength:"3" doc:"ISO currency code (e.g., USD, EUR)"`
		WarrantyExpires *time.Time `json:"warranty_expires,omitempty" doc:"Warranty expiration date"`
		ExpirationDate  *time.Time `json:"expiration_date,omitempty" doc:"Item expiration date"`
		Notes           *string    `json:"notes,omitempty" doc:"Additional notes"`
	}
}

type UpdateInventoryOutput struct {
	Body InventoryResponse
}

type UpdateStatusInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Status Status `json:"status" enum:"AVAILABLE,IN_USE,RESERVED,ON_LOAN,IN_TRANSIT,DISPOSED,MISSING" doc:"New item status"`
	}
}

type UpdateQuantityInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Quantity int `json:"quantity" minimum:"0" doc:"New quantity"`
	}
}

type MoveInventoryInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		LocationID  uuid.UUID  `json:"location_id" doc:"New location ID"`
		ContainerID *uuid.UUID `json:"container_id,omitempty" doc:"Optional new container ID"`
	}
}

type InventoryResponse struct {
	ID              uuid.UUID  `json:"id"`
	WorkspaceID     uuid.UUID  `json:"workspace_id"`
	ItemID          uuid.UUID  `json:"item_id"`
	LocationID      uuid.UUID  `json:"location_id"`
	ContainerID     *uuid.UUID `json:"container_id,omitempty"`
	Quantity        int        `json:"quantity"`
	Condition       Condition  `json:"condition"`
	Status          Status     `json:"status"`
	DateAcquired    *time.Time `json:"date_acquired,omitempty"`
	PurchasePrice   *int       `json:"purchase_price,omitempty"`
	CurrencyCode    *string    `json:"currency_code,omitempty"`
	WarrantyExpires *time.Time `json:"warranty_expires,omitempty"`
	ExpirationDate  *time.Time `json:"expiration_date,omitempty"`
	Notes           *string    `json:"notes,omitempty"`
	IsArchived      bool       `json:"is_archived"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// Types for the expiring inventory endpoint.

type ListExpiringInput struct {
	Days int `query:"days" default:"30" minimum:"1" maximum:"365" doc:"Window in days: include entries expiring between today and today+days"`
}

type ListExpiringOutput struct {
	Body ExpiringInventoryListResponse
}

type ExpiringInventoryListResponse struct {
	Items []ExpiringInventoryResponse `json:"items"`
	Total int                         `json:"total"`
}

type ExpiringInventoryResponse struct {
	InventoryID uuid.UUID `json:"inventory_id"`
	ItemID      uuid.UUID `json:"item_id"`
	ItemName    string    `json:"item_name"`
	Quantity    int       `json:"quantity"`
	Kind        string    `json:"kind" doc:"expiration | warranty"`
	Date        string    `json:"date" doc:"Expiration or warranty end date (YYYY-MM-DD)"`
}
