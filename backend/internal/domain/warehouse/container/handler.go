package container

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers container routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List containers
	huma.Get(api, "/containers", func(ctx context.Context, input *ListContainersInput) (*ListContainersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
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
	})

	// Get container by ID
	huma.Get(api, "/containers/{id}", func(ctx context.Context, input *GetContainerInput) (*GetContainerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		container, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || container == nil {
			return nil, huma.Error404NotFound("container not found")
		}

		return &GetContainerOutput{
			Body: toContainerResponse(container),
		}, nil
	})

	// Create container
	huma.Post(api, "/containers", func(ctx context.Context, input *CreateContainerInput) (*CreateContainerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		shortCode := ""
		if input.Body.ShortCode != nil {
			shortCode = *input.Body.ShortCode
		}

		container, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			LocationID:  input.Body.LocationID,
			Name:        input.Body.Name,
			Description: input.Body.Description,
			Capacity:    input.Body.Capacity,
			ShortCode:   shortCode,
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
				Type:       "container.created",
				EntityID:   container.ID().String(),
				EntityType: "container",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":   container.ID(),
					"name": container.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateContainerOutput{
			Body: toContainerResponse(container),
		}, nil
	})

	// Update container
	huma.Patch(api, "/containers/{id}", func(ctx context.Context, input *UpdateContainerInput) (*UpdateContainerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
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
			return nil, huma.Error400BadRequest(err.Error())
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
					"id":   container.ID(),
					"name": container.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateContainerOutput{
			Body: toContainerResponse(container),
		}, nil
	})

	// Archive container
	huma.Post(api, "/containers/{id}/archive", func(ctx context.Context, input *GetContainerInput) (*struct{}, error) {
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
				Type:       "container.deleted",
				EntityID:   input.ID.String(),
				EntityType: "container",
				UserID:     authUser.ID,
			Data: map[string]any{
				"user_name": userName,
			},
			})
		}

		return nil, nil
	})

	// Restore container
	huma.Post(api, "/containers/{id}/restore", func(ctx context.Context, input *GetContainerInput) (*struct{}, error) {
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
				Type:       "container.created",
				EntityID:   input.ID.String(),
				EntityType: "container",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})

	// Delete container
	huma.Delete(api, "/containers/{id}", func(ctx context.Context, input *GetContainerInput) (*struct{}, error) {
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
				Type:       "container.deleted",
				EntityID:   input.ID.String(),
				EntityType: "container",
				UserID:     authUser.ID,
			Data: map[string]any{
				"user_name": userName,
			},
			})
		}

		return nil, nil
	})

	// Search containers
	huma.Get(api, "/containers/search", func(ctx context.Context, input *SearchContainersInput) (*SearchContainersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
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
	})
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
	Body struct {
		Name        string    `json:"name" minLength:"1" maxLength:"255" doc:"Container name"`
		LocationID  uuid.UUID `json:"location_id" doc:"Location ID where the container is stored"`
		Description *string   `json:"description,omitempty" doc:"Container description"`
		Capacity    *string   `json:"capacity,omitempty" doc:"Container capacity or size information"`
		ShortCode   *string   `json:"short_code,omitempty" maxLength:"20" doc:"Short code for QR labels"`
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
