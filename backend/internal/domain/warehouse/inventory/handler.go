package inventory

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// RegisterRoutes registers inventory routes.
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	// Get inventory by ID
	huma.Get(api, "/inventory/{id}", func(ctx context.Context, input *GetInventoryInput) (*GetInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		inv, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrInventoryNotFound {
				return nil, huma.Error404NotFound("inventory not found")
			}
			return nil, huma.Error500InternalServerError("failed to get inventory")
		}

		return &GetInventoryOutput{
			Body: toInventoryResponse(inv),
		}, nil
	})

	// List inventory by item
	huma.Get(api, "/inventory/by-item/{item_id}", func(ctx context.Context, input *GetByItemInput) (*ListInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		items, err := svc.ListByItem(ctx, workspaceID, input.ItemID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list inventory")
		}

		responses := make([]InventoryResponse, len(items))
		for i, inv := range items {
			responses[i] = toInventoryResponse(inv)
		}

		return &ListInventoryOutput{
			Body: InventoryListResponse{
				Items: responses,
			},
		}, nil
	})

	// List inventory by location
	huma.Get(api, "/inventory/by-location/{location_id}", func(ctx context.Context, input *GetByLocationInput) (*ListInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		items, err := svc.ListByLocation(ctx, workspaceID, input.LocationID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list inventory")
		}

		responses := make([]InventoryResponse, len(items))
		for i, inv := range items {
			responses[i] = toInventoryResponse(inv)
		}

		return &ListInventoryOutput{
			Body: InventoryListResponse{
				Items: responses,
			},
		}, nil
	})

	// List inventory by container
	huma.Get(api, "/inventory/by-container/{container_id}", func(ctx context.Context, input *GetByContainerInput) (*ListInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		items, err := svc.ListByContainer(ctx, workspaceID, input.ContainerID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list inventory")
		}

		responses := make([]InventoryResponse, len(items))
		for i, inv := range items {
			responses[i] = toInventoryResponse(inv)
		}

		return &ListInventoryOutput{
			Body: InventoryListResponse{
				Items: responses,
			},
		}, nil
	})

	// Get available inventory for an item
	huma.Get(api, "/inventory/available/{item_id}", func(ctx context.Context, input *GetByItemInput) (*ListInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		items, err := svc.GetAvailable(ctx, workspaceID, input.ItemID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get available inventory")
		}

		responses := make([]InventoryResponse, len(items))
		for i, inv := range items {
			responses[i] = toInventoryResponse(inv)
		}

		return &ListInventoryOutput{
			Body: InventoryListResponse{
				Items: responses,
			},
		}, nil
	})

	// Get total quantity for an item
	huma.Get(api, "/inventory/total-quantity/{item_id}", func(ctx context.Context, input *GetByItemInput) (*GetTotalQuantityOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		total, err := svc.GetTotalQuantity(ctx, workspaceID, input.ItemID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get total quantity")
		}

		return &GetTotalQuantityOutput{
			Body: TotalQuantityResponse{
				ItemID:        input.ItemID,
				TotalQuantity: total,
			},
		}, nil
	})

	// Create inventory
	huma.Post(api, "/inventory", func(ctx context.Context, input *CreateInventoryInput) (*CreateInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
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
		})
		if err != nil {
			if err == ErrInvalidCondition || err == ErrInvalidStatus || err == ErrInsufficientQuantity {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, huma.Error500InternalServerError("failed to create inventory")
		}

		return &CreateInventoryOutput{
			Body: toInventoryResponse(inv),
		}, nil
	})

	// Update inventory
	huma.Patch(api, "/inventory/{id}", func(ctx context.Context, input *UpdateInventoryInput) (*UpdateInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
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
			if err == ErrInventoryNotFound {
				return nil, huma.Error404NotFound("inventory not found")
			}
			if err == ErrInvalidCondition || err == ErrInsufficientQuantity {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, huma.Error500InternalServerError("failed to update inventory")
		}

		return &UpdateInventoryOutput{
			Body: toInventoryResponse(inv),
		}, nil
	})

	// Update inventory status
	huma.Patch(api, "/inventory/{id}/status", func(ctx context.Context, input *UpdateStatusInput) (*UpdateInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		inv, err := svc.UpdateStatus(ctx, input.ID, workspaceID, input.Body.Status)
		if err != nil {
			if err == ErrInventoryNotFound {
				return nil, huma.Error404NotFound("inventory not found")
			}
			if err == ErrInvalidStatus {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, huma.Error500InternalServerError("failed to update status")
		}

		return &UpdateInventoryOutput{
			Body: toInventoryResponse(inv),
		}, nil
	})

	// Update inventory quantity
	huma.Patch(api, "/inventory/{id}/quantity", func(ctx context.Context, input *UpdateQuantityInput) (*UpdateInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		inv, err := svc.UpdateQuantity(ctx, input.ID, workspaceID, input.Body.Quantity)
		if err != nil {
			if err == ErrInventoryNotFound {
				return nil, huma.Error404NotFound("inventory not found")
			}
			if err == ErrInsufficientQuantity {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, huma.Error500InternalServerError("failed to update quantity")
		}

		return &UpdateInventoryOutput{
			Body: toInventoryResponse(inv),
		}, nil
	})

	// Move inventory to a different location/container
	huma.Post(api, "/inventory/{id}/move", func(ctx context.Context, input *MoveInventoryInput) (*UpdateInventoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		inv, err := svc.Move(ctx, input.ID, workspaceID, input.Body.LocationID, input.Body.ContainerID)
		if err != nil {
			if err == ErrInventoryNotFound {
				return nil, huma.Error404NotFound("inventory not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdateInventoryOutput{
			Body: toInventoryResponse(inv),
		}, nil
	})

	// Archive inventory
	huma.Post(api, "/inventory/{id}/archive", func(ctx context.Context, input *GetInventoryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrInventoryNotFound {
				return nil, huma.Error404NotFound("inventory not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Restore inventory
	huma.Post(api, "/inventory/{id}/restore", func(ctx context.Context, input *GetInventoryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrInventoryNotFound {
				return nil, huma.Error404NotFound("inventory not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})
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
	Items []InventoryResponse `json:"items"`
}

type GetTotalQuantityOutput struct {
	Body TotalQuantityResponse
}

type TotalQuantityResponse struct {
	ItemID        uuid.UUID `json:"item_id"`
	TotalQuantity int       `json:"total_quantity"`
}

type CreateInventoryInput struct {
	Body struct {
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
