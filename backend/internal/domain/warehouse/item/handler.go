package item

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// PrimaryPhotoLookup is the narrow interface the item handler needs from the
// itemphoto service to decorate ItemResponse with thumbnail URLs. Defined here
// so RegisterRoutes can accept nil (degrades gracefully) and tests don't need
// to mock the full itemphoto.ServiceInterface.
type PrimaryPhotoLookup interface {
	GetPrimary(ctx context.Context, itemID, workspaceID uuid.UUID) (*itemphoto.ItemPhoto, error)
	ListPrimaryByItemIDs(ctx context.Context, workspaceID uuid.UUID, itemIDs []uuid.UUID) (map[uuid.UUID]*itemphoto.ItemPhoto, error)
}

// PrimaryPhotoURLGenerator mirrors itemphoto.PhotoURLGenerator so the item
// handler can emit the same URL shape when decorating ItemResponse.
type PrimaryPhotoURLGenerator func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string

// stringPtrOrNil returns a pointer to s, or nil if s is empty.
func stringPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func derefInt(p *int, fallback int) int {
	if p != nil {
		return *p
	}
	return fallback
}

// RegisterRoutes registers item routes.
//
// photos (PrimaryPhotoLookup) is optional — when non-nil, list/detail handlers
// decorate ItemResponse with primary photo thumbnail/URL fields. Pass nil to
// skip decoration (e.g., in tests that don't exercise photo integration).
//
// photoURLGen is optional — required only when photos is non-nil. Generates the
// same URL shape as itemphoto.RegisterRoutes for consistent URLs across endpoints.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster, photos PrimaryPhotoLookup, photoURLGen PrimaryPhotoURLGenerator) {
	// List items
	huma.Get(api, "/items", func(ctx context.Context, input *ListItemsInput) (*ListItemsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}

		var items []*Item
		var total int
		var err error

		switch {
		case input.NeedsReview:
			// Preserve legacy needs-review listing (orthogonal to filtered list).
			items, total, err = svc.ListNeedingReview(ctx, workspaceID, pagination)
		default:
			// Parse CategoryID — malformed UUID is silently treated as no filter
			// (Pitfall 10 adjacent — defense in depth against malformed input).
			var categoryID *uuid.UUID
			if input.CategoryID != "" {
				if id, perr := uuid.Parse(input.CategoryID); perr == nil {
					categoryID = &id
				}
			}

			filters := ListFilters{
				// Empty search normalized to "no filter" by both SQL and repo
				// (Pitfall 2 — defense in depth).
				Search:          input.Search,
				CategoryID:      categoryID,
				IncludeArchived: input.Archived,
				Sort:            input.Sort,
				SortDir:         input.SortDir,
			}

			items, total, err = svc.ListFiltered(ctx, workspaceID, filters, pagination)
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list items")
		}

		primaryByItem := lookupPrimaryPhotos(ctx, photos, workspaceID, items)

		responses := make([]ItemResponse, len(items))
		for i, item := range items {
			responses[i] = toItemResponse(item, primaryByItem[item.ID()], photoURLGen)
		}

		totalPages := 1
		if total > 0 && input.Limit > 0 {
			totalPages = (total + input.Limit - 1) / input.Limit
		}

		return &ListItemsOutput{
			Body: ItemListResponse{
				Items:      responses,
				Total:      total,
				Page:       input.Page,
				TotalPages: totalPages,
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

		// Search results omit primary-photo decoration — autocomplete/search
		// callers don't render thumbnails.
		responses := make([]ItemResponse, len(items))
		for i, item := range items {
			responses[i] = toItemResponse(item, nil, photoURLGen)
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

		// Decorate detail view with primary photo (best-effort — failures log and
		// degrade to no thumbnail rather than failing the whole request).
		var primary *itemphoto.ItemPhoto
		if photos != nil {
			p, perr := photos.GetPrimary(ctx, input.ID, workspaceID)
			if perr != nil {
				log.Printf("item detail: primary photo lookup failed for item %s: %v", input.ID, perr)
			} else {
				primary = p
			}
		}

		return &GetItemOutput{
			Body: toItemResponse(item, primary, photoURLGen),
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

		primaryByItem := lookupPrimaryPhotos(ctx, photos, workspaceID, items)

		responses := make([]ItemResponse, len(items))
		for i, item := range items {
			responses[i] = toItemResponse(item, primaryByItem[item.ID()], photoURLGen)
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
			MinStockLevel:     derefInt(input.Body.MinStockLevel, 0),
			ShortCode:         shortCode,
			ObsidianVaultPath: input.Body.ObsidianVaultPath,
			ObsidianNotePath:  input.Body.ObsidianNotePath,
			NeedsReview:       input.Body.NeedsReview,
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

		// Newly-created items have no photos yet — pass nil primary.
		return &CreateItemOutput{
			Body: toItemResponse(item, nil, photoURLGen),
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
			NeedsReview:       input.Body.NeedsReview,
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

		// Update response: look up primary photo to keep thumbnail URL fresh for
		// callers that re-render the detail view after PATCH.
		var primary *itemphoto.ItemPhoto
		if photos != nil {
			p, perr := photos.GetPrimary(ctx, input.ID, workspaceID)
			if perr != nil {
				log.Printf("item update: primary photo lookup failed for item %s: %v", input.ID, perr)
			} else {
				primary = p
			}
		}

		return &UpdateItemOutput{
			Body: toItemResponse(item, primary, photoURLGen),
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

	// Delete item (hard delete; archive endpoint is separate)
	huma.Delete(api, "/items/{id}", func(ctx context.Context, input *GetItemInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
			if errors.Is(err, ErrItemNotFound) {
				return nil, huma.Error404NotFound("item not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

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

// lookupPrimaryPhotos wraps the batched primary-photo fetch with graceful
// degradation: nil photos source or zero items returns empty map; errors log
// but do not fail the caller (primary photos are decorative on list pages).
func lookupPrimaryPhotos(ctx context.Context, photos PrimaryPhotoLookup, workspaceID uuid.UUID, items []*Item) map[uuid.UUID]*itemphoto.ItemPhoto {
	if photos == nil || len(items) == 0 {
		return nil
	}
	itemIDs := make([]uuid.UUID, 0, len(items))
	for _, it := range items {
		itemIDs = append(itemIDs, it.ID())
	}
	primaryByItem, err := photos.ListPrimaryByItemIDs(ctx, workspaceID, itemIDs)
	if err != nil {
		log.Printf("item list: primary photo batch lookup failed for workspace %s: %v", workspaceID, err)
		return nil
	}
	return primaryByItem
}

func toItemResponse(i *Item, primary *itemphoto.ItemPhoto, photoURLGen PrimaryPhotoURLGenerator) ItemResponse {
	resp := ItemResponse{
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
		NeedsReview:       i.NeedsReview(),
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

	if primary != nil && photoURLGen != nil {
		thumbnailURL := photoURLGen(primary.WorkspaceID, primary.ItemID, primary.ID, true)
		fullURL := photoURLGen(primary.WorkspaceID, primary.ItemID, primary.ID, false)
		resp.PrimaryPhotoThumbnailURL = stringPtrOrNil(thumbnailURL)
		resp.PrimaryPhotoURL = stringPtrOrNil(fullURL)
	}

	return resp
}

// Request/Response types

type ListItemsInput struct {
	Page        int    `query:"page" default:"1" minimum:"1"`
	Limit       int    `query:"limit" default:"25" minimum:"1" maximum:"100"`
	Search      string `query:"search,omitempty" maxLength:"200" doc:"Full-text search over name, SKU, and barcode"`
	CategoryID  string `query:"category_id,omitempty" doc:"Filter by category UUID"`
	Archived    bool   `query:"archived" default:"false" doc:"When true, include archived items in the list"`
	Sort        string `query:"sort" default:"name" enum:"name,sku,created_at,updated_at" doc:"Sort field"`
	SortDir     string `query:"sort_dir" default:"asc" enum:"asc,desc" doc:"Sort direction"`
	NeedsReview bool   `query:"needs_review,omitempty" doc:"Filter by needs_review status (orthogonal to filtered list)"`
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
		MinStockLevel     *int       `json:"min_stock_level,omitempty" default:"0" minimum:"0" doc:"Minimum stock level"`
		ShortCode         *string    `json:"short_code,omitempty" maxLength:"20" doc:"Short code for QR labels"`
		ObsidianVaultPath *string    `json:"obsidian_vault_path,omitempty" doc:"Obsidian vault path"`
		ObsidianNotePath  *string    `json:"obsidian_note_path,omitempty" doc:"Obsidian note path"`
		NeedsReview       *bool      `json:"needs_review,omitempty" doc:"Whether the item needs review"`
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
		NeedsReview       *bool      `json:"needs_review,omitempty" doc:"Whether the item needs review"`
	}
}

type UpdateItemOutput struct {
	Body ItemResponse
}

type ItemResponse struct {
	ID                       uuid.UUID  `json:"id"`
	WorkspaceID              uuid.UUID  `json:"workspace_id"`
	SKU                      string     `json:"sku"`
	Name                     string     `json:"name"`
	Description              *string    `json:"description,omitempty"`
	CategoryID               *uuid.UUID `json:"category_id,omitempty"`
	Brand                    *string    `json:"brand,omitempty"`
	Model                    *string    `json:"model,omitempty"`
	ImageURL                 *string    `json:"image_url,omitempty"`
	SerialNumber             *string    `json:"serial_number,omitempty"`
	Manufacturer             *string    `json:"manufacturer,omitempty"`
	Barcode                  *string    `json:"barcode,omitempty"`
	IsInsured                *bool      `json:"is_insured,omitempty"`
	IsArchived               *bool      `json:"is_archived,omitempty"`
	LifetimeWarranty         *bool      `json:"lifetime_warranty,omitempty"`
	NeedsReview              *bool      `json:"needs_review,omitempty"`
	WarrantyDetails          *string    `json:"warranty_details,omitempty"`
	PurchasedFrom            *uuid.UUID `json:"purchased_from,omitempty"`
	MinStockLevel            int        `json:"min_stock_level"`
	ShortCode                string     `json:"short_code"`
	ObsidianVaultPath        *string    `json:"obsidian_vault_path,omitempty"`
	ObsidianNotePath         *string    `json:"obsidian_note_path,omitempty"`
	ObsidianURI              *string    `json:"obsidian_uri,omitempty" doc:"Generated Obsidian deep link URI"`
	PrimaryPhotoThumbnailURL *string    `json:"primary_photo_thumbnail_url,omitempty" doc:"Thumbnail URL of the primary photo (omitted when no primary exists)"`
	PrimaryPhotoURL          *string    `json:"primary_photo_url,omitempty" doc:"Full-size URL of the primary photo (omitted when no primary exists)"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`
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
