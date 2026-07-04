package container

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
	routeContainerByID          = "/containers/{id}"
)

// RegisterRoutes registers container routes. Each handler is a package factory
// func (see below) so this stays a flat list of registrations rather than a
// single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/containers", listContainers(svc))
	huma.Get(api, routeContainerByID, getContainer(svc))
	huma.Post(api, "/containers", createContainer(svc, broadcaster))
	huma.Patch(api, routeContainerByID, updateContainer(svc, broadcaster))
	huma.Post(api, "/containers/{id}/archive", archiveContainer(svc, broadcaster))
	huma.Post(api, "/containers/{id}/restore", restoreContainer(svc, broadcaster))
	huma.Delete(api, routeContainerByID, deleteContainer(svc, broadcaster))
	huma.Get(api, "/containers/search", searchContainers(svc))
}

// listContainers lists containers in the workspace.
func listContainers(svc ServiceInterface) func(context.Context, *ListContainersInput) (*ListContainersOutput, error) {
	return func(ctx context.Context, input *ListContainersInput) (*ListContainersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		result, err := svc.ListByWorkspace(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list containers")
		}

		items := make([]ContainerResponse, len(result.Items))
		for i, container := range result.Items {
			items[i] = toContainerResponse(container)
		}

		return &ListContainersOutput{
			Body: ContainerListResponse{
				Items:      items,
				Total:      result.Total,
				Page:       result.Page,
				TotalPages: result.TotalPages,
			},
		}, nil
	}
}

// getContainer returns a single container by ID.
func getContainer(svc ServiceInterface) func(context.Context, *GetContainerInput) (*GetContainerOutput, error) {
	return func(ctx context.Context, input *GetContainerInput) (*GetContainerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		container, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || container == nil {
			return nil, huma.Error404NotFound("container not found")
		}

		return &GetContainerOutput{
			Body: toContainerResponse(container),
		}, nil
	}
}

// createContainer creates a container.
func createContainer(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateContainerInput) (*CreateContainerOutput, error) {
	return func(ctx context.Context, input *CreateContainerInput) (*CreateContainerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		shortCode := ""
		if input.Body.ShortCode != nil {
			shortCode = *input.Body.ShortCode
		}

		container, err := svc.Create(ctx, CreateInput{
			WorkspaceID:    workspaceID,
			LocationID:     input.Body.LocationID,
			Name:           input.Body.Name,
			Description:    input.Body.Description,
			Capacity:       input.Body.Capacity,
			ShortCode:      shortCode,
			IdempotencyKey: input.IdempotencyKey,
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
				Type:       "container.created",
				EntityID:   container.ID().String(),
				EntityType: "container",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        container.ID(),
					"name":      container.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateContainerOutput{
			Body: toContainerResponse(container),
		}, nil
	}
}

// updateContainer updates a container.
func updateContainer(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateContainerInput) (*UpdateContainerOutput, error) {
	return func(ctx context.Context, input *UpdateContainerInput) (*UpdateContainerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		container, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error404NotFound("container not found")
		}

		name := container.Name()
		if input.Body.Name != nil {
			name = *input.Body.Name
		}

		locationID := container.LocationID()
		if input.Body.LocationID != nil {
			locationID = *input.Body.LocationID
		}

		container, err = svc.Update(ctx, input.ID, workspaceID, UpdateInput{
			Name:        name,
			LocationID:  locationID,
			Description: input.Body.Description,
			Capacity:    input.Body.Capacity,
		})
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "container.updated",
				EntityID:   container.ID().String(),
				EntityType: "container",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        container.ID(),
					"name":      container.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateContainerOutput{
			Body: toContainerResponse(container),
		}, nil
	}
}

// archiveContainer archives a container.
func archiveContainer(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetContainerInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetContainerInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event (treat archive as delete event)
		publishContainerLifecycleEvent(ctx, broadcaster, workspaceID, "container.deleted", input.ID)

		return nil, nil
	}
}

// restoreContainer restores an archived container.
func restoreContainer(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetContainerInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetContainerInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event (treat restore as create event)
		publishContainerLifecycleEvent(ctx, broadcaster, workspaceID, "container.created", input.ID)

		return nil, nil
	}
}

// deleteContainer deletes a container.
func deleteContainer(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetContainerInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetContainerInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		err := svc.Delete(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		publishContainerLifecycleEvent(ctx, broadcaster, workspaceID, "container.deleted", input.ID)

		return nil, nil
	}
}

// publishContainerLifecycleEvent publishes a lifecycle event (archive/restore/
// delete) for a container, keyed by ID with only the acting user's name.
func publishContainerLifecycleEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, eventType string, containerID uuid.UUID) {
	authUser, _ := appMiddleware.GetAuthUser(ctx)
	if broadcaster == nil || authUser == nil {
		return
	}
	userName := appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   containerID.String(),
		EntityType: "container",
		UserID:     authUser.ID,
		Data: map[string]any{
			"user_name": userName,
		},
	})
}

// searchContainers searches containers in the workspace.
func searchContainers(svc ServiceInterface) func(context.Context, *SearchContainersInput) (*SearchContainersOutput, error) {
	return func(ctx context.Context, input *SearchContainersInput) (*SearchContainersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		containers, err := svc.Search(ctx, workspaceID, input.Query, input.Limit)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to search containers")
		}

		responses := make([]ContainerResponse, len(containers))
		for i, c := range containers {
			responses[i] = toContainerResponse(c)
		}

		return &SearchContainersOutput{
			Body: ContainerListResponse{
				Items: responses,
			},
		}, nil
	}
}

func toContainerResponse(c *Container) ContainerResponse {
	return ContainerResponse{
		ID:          c.ID(),
		WorkspaceID: c.WorkspaceID(),
		Name:        c.Name(),
		LocationID:  c.LocationID(),
		Description: c.Description(),
		Capacity:    c.Capacity(),
		ShortCode:   c.ShortCode(),
		IsArchived:  c.IsArchived(),
		CreatedAt:   c.CreatedAt(),
		UpdatedAt:   c.UpdatedAt(),
	}
}

// Request/Response types

type ListContainersInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListContainersOutput struct {
	Body ContainerListResponse
}

type ContainerListResponse struct {
	Items      []ContainerResponse `json:"items"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	TotalPages int                 `json:"total_pages"`
}

type GetContainerInput struct {
	ID uuid.UUID `path:"id"`
}

type GetContainerOutput struct {
	Body ContainerResponse
}

type CreateContainerInput struct {
	// IdempotencyKey lets a replayed create (offline-queued PWA write whose
	// original response was lost) return the ORIGINAL container instead of a
	// duplicate. Optional — a request without it always creates.
	IdempotencyKey string `header:"Idempotency-Key" doc:"Client-generated key; a repeated create with the same key returns the original entity instead of creating a duplicate"`
	Body           struct {
		Name        string    `json:"name" minLength:"1" maxLength:"255" doc:"Container name"`
		LocationID  uuid.UUID `json:"location_id" doc:"Location ID where the container is stored"`
		Description *string   `json:"description,omitempty" doc:"Container description"`
		Capacity    *string   `json:"capacity,omitempty" doc:"Container capacity or size information"`
		ShortCode   *string   `json:"short_code,omitempty" minLength:"4" maxLength:"8" pattern:"^[A-Za-z0-9]+$" doc:"Short code for QR labels (alphanumeric; globally unique; auto-generated if empty)"`
	}
}

type CreateContainerOutput struct {
	Body ContainerResponse
}

type UpdateContainerInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name        *string    `json:"name,omitempty" minLength:"1" maxLength:"255" doc:"Container name"`
		LocationID  *uuid.UUID `json:"location_id,omitempty" doc:"Location ID where the container is stored"`
		Description *string    `json:"description,omitempty" doc:"Container description"`
		Capacity    *string    `json:"capacity,omitempty" doc:"Container capacity or size information"`
	}
}

type UpdateContainerOutput struct {
	Body ContainerResponse
}

type ContainerResponse struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	LocationID  uuid.UUID `json:"location_id"`
	Description *string   `json:"description,omitempty"`
	Capacity    *string   `json:"capacity,omitempty"`
	ShortCode   string    `json:"short_code"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SearchContainersInput struct {
	Query string `query:"q" minLength:"1" doc:"Search query"`
	Limit int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type SearchContainersOutput struct {
	Body ContainerListResponse
}
