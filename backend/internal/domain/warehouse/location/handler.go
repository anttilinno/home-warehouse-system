package location

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers location routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List locations
	huma.Get(api, "/locations", func(ctx context.Context, input *ListLocationsInput) (*ListLocationsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		result, err := svc.ListByWorkspace(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list locations")
		}

		items := make([]LocationResponse, len(result.Items))
		for i, loc := range result.Items {
			items[i] = toLocationResponse(loc)
		}

		return &ListLocationsOutput{
			Body: LocationListResponse{
				Items:      items,
				Total:      result.Total,
				Page:       result.Page,
				TotalPages: result.TotalPages,
			},
		}, nil
	})

	// Get location by ID
	huma.Get(api, "/locations/{id}", func(ctx context.Context, input *GetLocationInput) (*GetLocationOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		location, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || location == nil {
			return nil, huma.Error404NotFound("location not found")
		}

		return &GetLocationOutput{
			Body: toLocationResponse(location),
		}, nil
	})

	// Create location
	huma.Post(api, "/locations", func(ctx context.Context, input *CreateLocationInput) (*CreateLocationOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		location, err := svc.Create(ctx, CreateInput{
			WorkspaceID:    workspaceID,
			Name:           input.Body.Name,
			ParentLocation: input.Body.ParentLocation,
			Zone:           input.Body.Zone,
			Shelf:          input.Body.Shelf,
			Bin:            input.Body.Bin,
			Description:    input.Body.Description,
			ShortCode:      input.Body.ShortCode,
		})
		if err != nil {
			if err == ErrShortCodeTaken {
				return nil, huma.Error400BadRequest("short code already exists")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "location.created",
				EntityID:   location.ID().String(),
				EntityType: "location",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":   location.ID(),
					"name": location.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateLocationOutput{
			Body: toLocationResponse(location),
		}, nil
	})

	// Update location
	huma.Patch(api, "/locations/{id}", func(ctx context.Context, input *UpdateLocationInput) (*UpdateLocationOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		// Get existing location to preserve unchanged fields
		existing, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error404NotFound("location not found")
		}

		name := existing.Name()
		if input.Body.Name != nil {
			name = *input.Body.Name
		}

		location, err := svc.Update(ctx, input.ID, workspaceID, UpdateInput{
			Name:           name,
			ParentLocation: input.Body.ParentLocation,
			Zone:           input.Body.Zone,
			Shelf:          input.Body.Shelf,
			Bin:            input.Body.Bin,
			Description:    input.Body.Description,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "location.updated",
				EntityID:   location.ID().String(),
				EntityType: "location",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":   location.ID(),
					"name": location.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateLocationOutput{
			Body: toLocationResponse(location),
		}, nil
	})

	// Archive location
	huma.Post(api, "/locations/{id}/archive", func(ctx context.Context, input *GetLocationInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event (treat archive as delete event)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "location.deleted",
				EntityID:   input.ID.String(),
				EntityType: "location",
				UserID:     authUser.ID,
			Data: map[string]any{
				"user_name": userName,
			},
			})
		}

		return nil, nil
	})

	// Restore location
	huma.Post(api, "/locations/{id}/restore", func(ctx context.Context, input *GetLocationInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event (treat restore as create event)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "location.created",
				EntityID:   input.ID.String(),
				EntityType: "location",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})

	// Delete location
	huma.Delete(api, "/locations/{id}", func(ctx context.Context, input *GetLocationInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Delete(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "location.deleted",
				EntityID:   input.ID.String(),
				EntityType: "location",
				UserID:     authUser.ID,
			Data: map[string]any{
				"user_name": userName,
			},
			})
		}

		return nil, nil
	})

	// Get location breadcrumb
	huma.Get(api, "/locations/{id}/breadcrumb", func(ctx context.Context, input *GetLocationInput) (*GetBreadcrumbOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		breadcrumb, err := svc.GetBreadcrumb(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get breadcrumb")
		}

		items := make([]BreadcrumbResponse, len(breadcrumb))
		for i, item := range breadcrumb {
			items[i] = BreadcrumbResponse{
				ID:        item.ID,
				Name:      item.Name,
				ShortCode: item.ShortCode,
			}
		}

		return &GetBreadcrumbOutput{
			Body: BreadcrumbListResponse{
				Breadcrumb: items,
			},
		}, nil
	})

	// Search locations
	huma.Get(api, "/locations/search", func(ctx context.Context, input *SearchLocationsInput) (*SearchLocationsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		locations, err := svc.Search(ctx, workspaceID, input.Query, input.Limit)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to search locations")
		}

		responses := make([]LocationResponse, len(locations))
		for i, loc := range locations {
			responses[i] = toLocationResponse(loc)
		}

		return &SearchLocationsOutput{
			Body: LocationListResponse{
				Items: responses,
			},
		}, nil
	})
}

func toLocationResponse(l *Location) LocationResponse {
	return LocationResponse{
		ID:             l.ID(),
		WorkspaceID:    l.WorkspaceID(),
		Name:           l.Name(),
		ParentLocation: l.ParentLocation(),
		Zone:           l.Zone(),
		Shelf:          l.Shelf(),
		Bin:            l.Bin(),
		Description:    l.Description(),
		ShortCode:      l.ShortCode(),
		IsArchived:     l.IsArchived(),
		CreatedAt:      l.CreatedAt(),
		UpdatedAt:      l.UpdatedAt(),
	}
}

// Request/Response types

type ListLocationsInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListLocationsOutput struct {
	Body LocationListResponse
}

type LocationListResponse struct {
	Items      []LocationResponse `json:"items"`
	Total      int                `json:"total"`
	Page       int                `json:"page"`
	TotalPages int                `json:"total_pages"`
}

type GetLocationInput struct {
	ID uuid.UUID `path:"id"`
}

type GetLocationOutput struct {
	Body LocationResponse
}

type CreateLocationInput struct {
	Body struct {
		Name           string     `json:"name" minLength:"1" maxLength:"255" doc:"Location name"`
		ParentLocation *uuid.UUID `json:"parent_location,omitempty" doc:"Parent location ID for hierarchical locations"`
		Zone           *string    `json:"zone,omitempty" maxLength:"100" doc:"Zone identifier"`
		Shelf          *string    `json:"shelf,omitempty" maxLength:"100" doc:"Shelf identifier"`
		Bin            *string    `json:"bin,omitempty" maxLength:"100" doc:"Bin identifier"`
		Description    *string    `json:"description,omitempty" doc:"Location description"`
		ShortCode      *string    `json:"short_code,omitempty" maxLength:"20" doc:"Short code for QR labels"`
	}
}

type CreateLocationOutput struct {
	Body LocationResponse
}

type UpdateLocationInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name           *string    `json:"name,omitempty" minLength:"1" maxLength:"255" doc:"Location name"`
		ParentLocation *uuid.UUID `json:"parent_location,omitempty" doc:"Parent location ID for hierarchical locations"`
		Zone           *string    `json:"zone,omitempty" maxLength:"100" doc:"Zone identifier"`
		Shelf          *string    `json:"shelf,omitempty" maxLength:"100" doc:"Shelf identifier"`
		Bin            *string    `json:"bin,omitempty" maxLength:"100" doc:"Bin identifier"`
		Description    *string    `json:"description,omitempty" doc:"Location description"`
	}
}

type UpdateLocationOutput struct {
	Body LocationResponse
}

type LocationResponse struct {
	ID             uuid.UUID  `json:"id"`
	WorkspaceID    uuid.UUID  `json:"workspace_id"`
	Name           string     `json:"name"`
	ParentLocation *uuid.UUID `json:"parent_location,omitempty"`
	Zone           *string    `json:"zone,omitempty"`
	Shelf          *string    `json:"shelf,omitempty"`
	Bin            *string    `json:"bin,omitempty"`
	Description    *string    `json:"description,omitempty"`
	ShortCode      *string    `json:"short_code,omitempty"`
	IsArchived     bool       `json:"is_archived"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type GetBreadcrumbOutput struct {
	Body BreadcrumbListResponse
}

type BreadcrumbListResponse struct {
	Breadcrumb []BreadcrumbResponse `json:"breadcrumb"`
}

type BreadcrumbResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	ShortCode *string   `json:"short_code,omitempty"`
}

type SearchLocationsInput struct {
	Query string `query:"q" minLength:"1" doc:"Search query"`
	Limit int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type SearchLocationsOutput struct {
	Body LocationListResponse
}
