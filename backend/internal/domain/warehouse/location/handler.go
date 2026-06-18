package location

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
	routeLocationByID           = "/locations/{id}"
)

// RegisterRoutes registers location routes. Each handler is a package factory
// func (see below) so this stays a flat list of registrations rather than a
// single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/locations", listLocations(svc))
	huma.Get(api, routeLocationByID, getLocation(svc))
	huma.Post(api, "/locations", createLocation(svc, broadcaster))
	huma.Patch(api, routeLocationByID, updateLocation(svc, broadcaster))
	huma.Post(api, "/locations/{id}/archive", archiveLocation(svc, broadcaster))
	huma.Post(api, "/locations/{id}/restore", restoreLocation(svc, broadcaster))
	huma.Delete(api, routeLocationByID, deleteLocation(svc, broadcaster))
	huma.Get(api, "/locations/{id}/breadcrumb", getBreadcrumb(svc))
	huma.Get(api, "/locations/search", searchLocations(svc))
}

// listLocations lists locations in the workspace.
func listLocations(svc ServiceInterface) func(context.Context, *ListLocationsInput) (*ListLocationsOutput, error) {
	return func(ctx context.Context, input *ListLocationsInput) (*ListLocationsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
	}
}

// getLocation returns a single location by ID.
func getLocation(svc ServiceInterface) func(context.Context, *GetLocationInput) (*GetLocationOutput, error) {
	return func(ctx context.Context, input *GetLocationInput) (*GetLocationOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		location, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || location == nil {
			return nil, huma.Error404NotFound("location not found")
		}

		return &GetLocationOutput{
			Body: toLocationResponse(location),
		}, nil
	}
}

// createLocation creates a location.
func createLocation(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateLocationInput) (*CreateLocationOutput, error) {
	return func(ctx context.Context, input *CreateLocationInput) (*CreateLocationOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		shortCode := ""
		if input.Body.ShortCode != nil {
			shortCode = *input.Body.ShortCode
		}

		location, err := svc.Create(ctx, CreateInput{
			WorkspaceID:    workspaceID,
			Name:           input.Body.Name,
			ParentLocation: input.Body.ParentLocation,
			Description:    input.Body.Description,
			ShortCode:      shortCode,
		})
		if err != nil {
			if errors.Is(err, ErrShortCodeTaken) {
				return nil, huma.Error400BadRequest("short code already exists")
			}
			return nil, appMiddleware.MapDomainError(err)
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
					"id":        location.ID(),
					"name":      location.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateLocationOutput{
			Body: toLocationResponse(location),
		}, nil
	}
}

// updateLocation updates a location.
func updateLocation(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateLocationInput) (*UpdateLocationOutput, error) {
	return func(ctx context.Context, input *UpdateLocationInput) (*UpdateLocationOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
			Description:    input.Body.Description,
		})
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
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
					"id":        location.ID(),
					"name":      location.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateLocationOutput{
			Body: toLocationResponse(location),
		}, nil
	}
}

// archiveLocation archives a location.
func archiveLocation(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetLocationInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetLocationInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event (treat archive as delete event)
		publishLocationLifecycleEvent(ctx, broadcaster, workspaceID, "location.deleted", input.ID)

		return nil, nil
	}
}

// restoreLocation restores an archived location.
func restoreLocation(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetLocationInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetLocationInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event (treat restore as create event)
		publishLocationLifecycleEvent(ctx, broadcaster, workspaceID, "location.created", input.ID)

		return nil, nil
	}
}

// deleteLocation deletes a location.
func deleteLocation(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetLocationInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetLocationInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		err := svc.Delete(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		publishLocationLifecycleEvent(ctx, broadcaster, workspaceID, "location.deleted", input.ID)

		return nil, nil
	}
}

// publishLocationLifecycleEvent publishes a lifecycle event (archive/restore/
// delete) carrying only the acting user's display name, matching the original
// per-handler publish blocks verbatim.
func publishLocationLifecycleEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, eventType string, locationID uuid.UUID) {
	authUser, _ := appMiddleware.GetAuthUser(ctx)
	if broadcaster == nil || authUser == nil {
		return
	}
	userName := appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   locationID.String(),
		EntityType: "location",
		UserID:     authUser.ID,
		Data: map[string]any{
			"user_name": userName,
		},
	})
}

// getBreadcrumb returns the ancestor breadcrumb trail for a location.
func getBreadcrumb(svc ServiceInterface) func(context.Context, *GetLocationInput) (*GetBreadcrumbOutput, error) {
	return func(ctx context.Context, input *GetLocationInput) (*GetBreadcrumbOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
	}
}

// searchLocations searches locations by query within the workspace.
func searchLocations(svc ServiceInterface) func(context.Context, *SearchLocationsInput) (*SearchLocationsOutput, error) {
	return func(ctx context.Context, input *SearchLocationsInput) (*SearchLocationsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
	}
}

func toLocationResponse(l *Location) LocationResponse {
	return LocationResponse{
		ID:             l.ID(),
		WorkspaceID:    l.WorkspaceID(),
		Name:           l.Name(),
		ParentLocation: l.ParentLocation(),
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
		Description    *string    `json:"description,omitempty" doc:"Location description"`
		ShortCode      *string    `json:"short_code,omitempty" minLength:"4" maxLength:"8" pattern:"^[A-Za-z0-9]+$" doc:"Short code for QR labels (alphanumeric; globally unique; auto-generated if empty)"`
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
	Description    *string    `json:"description,omitempty"`
	ShortCode      string     `json:"short_code"`
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
	ShortCode string    `json:"short_code"`
}

type SearchLocationsInput struct {
	Query string `query:"q" minLength:"1" doc:"Search query"`
	Limit int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type SearchLocationsOutput struct {
	Body LocationListResponse
}
