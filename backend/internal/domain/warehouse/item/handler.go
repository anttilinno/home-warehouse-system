package item

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers item routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List items
	huma.Get(api, "/items", func(ctx context.Context, input *ListItemsInput) (*ListItemsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		items, total, err := svc.List(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list items")
		}

		responses := make([]ItemResponse, len(items))
		for i, item := range items {
			responses[i] = toItemResponse(item)
		}

		return &ListItemsOutput{
			Body: ItemListResponse{
				Items:      responses,
				Total:      total,
				Page:       input.Page,
				TotalPages: (total + input.Limit - 1) / input.Limit,
			},
		}, nil
	})

	// Search items
	huma.Get(api, "/items/search", func(ctx context.Context, input *SearchItemsInput) (*SearchItemsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		items, err := svc.Search(ctx, workspaceID, input.Query, input.Limit)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to search items")
		}

		responses := make([]ItemResponse, len(items))
		for i, item := range items {
			responses[i] = toItemResponse(item)
		}

		return &SearchItemsOutput{
			Body: ItemListResponse{
				Items: responses,
			},
		}, nil
	})

	// Get item by ID
	huma.Get(api, "/items/{id}", func(ctx context.Context, input *GetItemInput) (*GetItemOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		item, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrItemNotFound {
				return nil, huma.Error404NotFound("item not found")
			}
			return nil, huma.Error500InternalServerError("failed to get item")
		}

		return &GetItemOutput{
			Body: toItemResponse(item),
		}, nil
	})

	// List items by category
	huma.Get(api, "/items/by-category/{category_id}", func(ctx context.Context, input *ListItemsByCategoryInput) (*ListItemsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		items, err := svc.ListByCategory(ctx, workspaceID, input.CategoryID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list items by category")
		}

		responses := make([]ItemResponse, len(items))
		for i, item := range items {
			responses[i] = toItemResponse(item)
		}

		return &ListItemsOutput{
			Body: ItemListResponse{
				Items: responses,
			},
		}, nil
	})

	// Create item
	huma.Post(api, "/items", func(ctx context.Context, input *CreateItemInput) (*CreateItemOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		shortCode := ""
		if input.Body.ShortCode != nil {
			shortCode = *input.Body.ShortCode
		}

		item, err := svc.Create(ctx, CreateInput{
			WorkspaceID:       workspaceID,
			SKU:               input.Body.SKU,
			Name:              input.Body.Name,
			Description:       input.Body.Description,
			CategoryID:        input.Body.CategoryID,
			Brand:             input.Body.Brand,
			Model:             input.Body.Model,
			ImageURL:          input.Body.ImageURL,
			SerialNumber:      input.Body.SerialNumber,
			Manufacturer:      input.Body.Manufacturer,
			Barcode:           input.Body.Barcode,
			IsInsured:         input.Body.IsInsured,
			LifetimeWarranty:  input.Body.LifetimeWarranty,
			WarrantyDetails:   input.Body.WarrantyDetails,
			PurchasedFrom:     input.Body.PurchasedFrom,
			MinStockLevel:     input.Body.MinStockLevel,
			ShortCode:         shortCode,
			ObsidianVaultPath: input.Body.ObsidianVaultPath,
			ObsidianNotePath:  input.Body.ObsidianNotePath,
		})
		if err != nil {
			if err == ErrSKUTaken {
				return nil, huma.Error400BadRequest("SKU already exists in workspace")
			}
			if err == ErrShortCodeTaken {
				return nil, huma.Error400BadRequest("short code already exists in workspace")
			}
			if err == ErrInvalidMinStock {
				return nil, huma.Error400BadRequest("minimum stock level must be non-negative")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "item.created",
				EntityID:   item.ID().String(),
				EntityType: "item",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        item.ID(),
					"sku":       item.SKU(),
					"name":      item.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateItemOutput{
			Body: toItemResponse(item),
		}, nil
	})

	// Update item
	huma.Patch(api, "/items/{id}", func(ctx context.Context, input *UpdateItemInput) (*UpdateItemOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		// Get the current item to use defaults for fields not provided
		currentItem, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrItemNotFound {
				return nil, huma.Error404NotFound("item not found")
			}
			return nil, huma.Error500InternalServerError("failed to get item")
		}

		// Build update input with current values as defaults
		updateInput := UpdateInput{
			Name:              currentItem.Name(),
			Description:       input.Body.Description,
			CategoryID:        input.Body.CategoryID,
			Brand:             input.Body.Brand,
			Model:             input.Body.Model,
			ImageURL:          input.Body.ImageURL,
			SerialNumber:      input.Body.SerialNumber,
			Manufacturer:      input.Body.Manufacturer,
			Barcode:           input.Body.Barcode,
			IsInsured:         input.Body.IsInsured,
			LifetimeWarranty:  input.Body.LifetimeWarranty,
			WarrantyDetails:   input.Body.WarrantyDetails,
			PurchasedFrom:     input.Body.PurchasedFrom,
			MinStockLevel:     currentItem.MinStockLevel(),
			ObsidianVaultPath: input.Body.ObsidianVaultPath,
			ObsidianNotePath:  input.Body.ObsidianNotePath,
		}

		if input.Body.Name != nil {
			updateInput.Name = *input.Body.Name
		}
		if input.Body.MinStockLevel != nil {
			updateInput.MinStockLevel = *input.Body.MinStockLevel
		}

		item, err := svc.Update(ctx, input.ID, workspaceID, updateInput)
		if err != nil {
			if err == ErrInvalidMinStock {
				return nil, huma.Error400BadRequest("minimum stock level must be non-negative")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "item.updated",
				EntityID:   item.ID().String(),
				EntityType: "item",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        item.ID(),
					"name":      item.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateItemOutput{
			Body: toItemResponse(item),
		}, nil
	})

	// Archive item
	huma.Post(api, "/items/{id}/archive", func(ctx context.Context, input *GetItemInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrItemNotFound {
				return nil, huma.Error404NotFound("item not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event (treat archive as delete event)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "item.deleted",
				EntityID:   input.ID.String(),
				EntityType: "item",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})

	// Restore item
	huma.Post(api, "/items/{id}/restore", func(ctx context.Context, input *GetItemInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrItemNotFound {
				return nil, huma.Error404NotFound("item not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event (treat restore as create event)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "item.created",
				EntityID:   input.ID.String(),
				EntityType: "item",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})

	// Get item labels
	huma.Get(api, "/items/{id}/labels", func(ctx context.Context, input *GetItemInput) (*GetItemLabelsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		labelIDs, err := svc.GetItemLabels(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrItemNotFound {
				return nil, huma.Error404NotFound("item not found")
			}
			return nil, huma.Error500InternalServerError("failed to get item labels")
		}

		return &GetItemLabelsOutput{
			Body: ItemLabelsResponse{LabelIDs: labelIDs},
		}, nil
	})

	// Attach label to item
	huma.Post(api, "/items/{id}/labels/{label_id}", func(ctx context.Context, input *ItemLabelInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.AttachLabel(ctx, input.ID, input.LabelID, workspaceID)
		if err != nil {
			if err == ErrItemNotFound {
				return nil, huma.Error404NotFound("item not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Detach label from item
	huma.Delete(api, "/items/{id}/labels/{label_id}", func(ctx context.Context, input *ItemLabelInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.DetachLabel(ctx, input.ID, input.LabelID, workspaceID)
		if err != nil {
			if err == ErrItemNotFound {
				return nil, huma.Error404NotFound("item not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})
}

func toItemResponse(i *Item) ItemResponse {
	return ItemResponse{
		ID:                i.ID(),
		WorkspaceID:       i.WorkspaceID(),
		SKU:               i.SKU(),
		Name:              i.Name(),
		Description:       i.Description(),
		CategoryID:        i.CategoryID(),
		Brand:             i.Brand(),
		Model:             i.Model(),
		ImageURL:          i.ImageURL(),
		SerialNumber:      i.SerialNumber(),
		Manufacturer:      i.Manufacturer(),
		Barcode:           i.Barcode(),
		IsInsured:         i.IsInsured(),
		IsArchived:        i.IsArchived(),
		LifetimeWarranty:  i.LifetimeWarranty(),
		WarrantyDetails:   i.WarrantyDetails(),
		PurchasedFrom:     i.PurchasedFrom(),
		MinStockLevel:     i.MinStockLevel(),
		ShortCode:         i.ShortCode(),
		ObsidianVaultPath: i.ObsidianVaultPath(),
		ObsidianNotePath:  i.ObsidianNotePath(),
		ObsidianURI:       i.ObsidianURI(),
		CreatedAt:         i.CreatedAt(),
		UpdatedAt:         i.UpdatedAt(),
	}
}

// Request/Response types

type ListItemsInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListItemsOutput struct {
	Body ItemListResponse
}

type ItemListResponse struct {
	Items      []ItemResponse `json:"items"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	TotalPages int            `json:"total_pages"`
}

type SearchItemsInput struct {
	Query string `query:"q" minLength:"1" doc:"Search query"`
	Limit int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type SearchItemsOutput struct {
	Body ItemListResponse
}

type GetItemInput struct {
	ID uuid.UUID `path:"id"`
}

type GetItemOutput struct {
	Body ItemResponse
}

type ListItemsByCategoryInput struct {
	CategoryID uuid.UUID `path:"category_id"`
	Page       int       `query:"page" default:"1" minimum:"1"`
	Limit      int       `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type CreateItemInput struct {
	Body struct {
		SKU               string     `json:"sku" minLength:"1" maxLength:"255" doc:"Stock Keeping Unit"`
		Name              string     `json:"name" minLength:"1" maxLength:"255" doc:"Item name"`
		Description       *string    `json:"description,omitempty" doc:"Item description"`
		CategoryID        *uuid.UUID `json:"category_id,omitempty" doc:"Category ID"`
		Brand             *string    `json:"brand,omitempty" maxLength:"255" doc:"Brand name"`
		Model             *string    `json:"model,omitempty" maxLength:"255" doc:"Model name or number"`
		ImageURL          *string    `json:"image_url,omitempty" format:"uri" doc:"Image URL"`
		SerialNumber      *string    `json:"serial_number,omitempty" maxLength:"255" doc:"Serial number"`
		Manufacturer      *string    `json:"manufacturer,omitempty" maxLength:"255" doc:"Manufacturer name"`
		Barcode           *string    `json:"barcode,omitempty" maxLength:"255" doc:"Barcode or UPC"`
		IsInsured         *bool      `json:"is_insured,omitempty" doc:"Whether the item is insured"`
		LifetimeWarranty  *bool      `json:"lifetime_warranty,omitempty" doc:"Whether the item has lifetime warranty"`
		WarrantyDetails   *string    `json:"warranty_details,omitempty" doc:"Warranty details"`
		PurchasedFrom     *uuid.UUID `json:"purchased_from,omitempty" doc:"Company ID where purchased from"`
		MinStockLevel     int        `json:"min_stock_level" default:"0" minimum:"0" doc:"Minimum stock level"`
		ShortCode         *string    `json:"short_code,omitempty" maxLength:"20" doc:"Short code for QR labels"`
		ObsidianVaultPath *string    `json:"obsidian_vault_path,omitempty" doc:"Obsidian vault path"`
		ObsidianNotePath  *string    `json:"obsidian_note_path,omitempty" doc:"Obsidian note path"`
	}
}

type CreateItemOutput struct {
	Body ItemResponse
}

type UpdateItemInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name              *string    `json:"name,omitempty" minLength:"1" maxLength:"255" doc:"Item name"`
		Description       *string    `json:"description,omitempty" doc:"Item description"`
		CategoryID        *uuid.UUID `json:"category_id,omitempty" doc:"Category ID"`
		Brand             *string    `json:"brand,omitempty" maxLength:"255" doc:"Brand name"`
		Model             *string    `json:"model,omitempty" maxLength:"255" doc:"Model name or number"`
		ImageURL          *string    `json:"image_url,omitempty" format:"uri" doc:"Image URL"`
		SerialNumber      *string    `json:"serial_number,omitempty" maxLength:"255" doc:"Serial number"`
		Manufacturer      *string    `json:"manufacturer,omitempty" maxLength:"255" doc:"Manufacturer name"`
		Barcode           *string    `json:"barcode,omitempty" maxLength:"255" doc:"Barcode or UPC"`
		IsInsured         *bool      `json:"is_insured,omitempty" doc:"Whether the item is insured"`
		LifetimeWarranty  *bool      `json:"lifetime_warranty,omitempty" doc:"Whether the item has lifetime warranty"`
		WarrantyDetails   *string    `json:"warranty_details,omitempty" doc:"Warranty details"`
		PurchasedFrom     *uuid.UUID `json:"purchased_from,omitempty" doc:"Company ID where purchased from"`
		MinStockLevel     *int       `json:"min_stock_level,omitempty" minimum:"0" doc:"Minimum stock level"`
		ObsidianVaultPath *string    `json:"obsidian_vault_path,omitempty" doc:"Obsidian vault path"`
		ObsidianNotePath  *string    `json:"obsidian_note_path,omitempty" doc:"Obsidian note path"`
	}
}

type UpdateItemOutput struct {
	Body ItemResponse
}

type ItemResponse struct {
	ID                uuid.UUID  `json:"id"`
	WorkspaceID       uuid.UUID  `json:"workspace_id"`
	SKU               string     `json:"sku"`
	Name              string     `json:"name"`
	Description       *string    `json:"description,omitempty"`
	CategoryID        *uuid.UUID `json:"category_id,omitempty"`
	Brand             *string    `json:"brand,omitempty"`
	Model             *string    `json:"model,omitempty"`
	ImageURL          *string    `json:"image_url,omitempty"`
	SerialNumber      *string    `json:"serial_number,omitempty"`
	Manufacturer      *string    `json:"manufacturer,omitempty"`
	Barcode           *string    `json:"barcode,omitempty"`
	IsInsured         *bool      `json:"is_insured,omitempty"`
	IsArchived        *bool      `json:"is_archived,omitempty"`
	LifetimeWarranty  *bool      `json:"lifetime_warranty,omitempty"`
	WarrantyDetails   *string    `json:"warranty_details,omitempty"`
	PurchasedFrom     *uuid.UUID `json:"purchased_from,omitempty"`
	MinStockLevel     int        `json:"min_stock_level"`
	ShortCode         string     `json:"short_code"`
	ObsidianVaultPath *string    `json:"obsidian_vault_path,omitempty"`
	ObsidianNotePath  *string    `json:"obsidian_note_path,omitempty"`
	ObsidianURI       *string    `json:"obsidian_uri,omitempty" doc:"Generated Obsidian deep link URI"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// Label management types

type ItemLabelInput struct {
	ID      uuid.UUID `path:"id"`
	LabelID uuid.UUID `path:"label_id"`
}

type GetItemLabelsOutput struct {
	Body ItemLabelsResponse
}

type ItemLabelsResponse struct {
	LabelIDs []uuid.UUID `json:"label_ids"`
}
