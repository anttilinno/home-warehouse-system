package workspace

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// RegisterRoutes registers workspace routes at user-level (list, create, get by slug).
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	// List user's workspaces
	huma.Get(api, "/workspaces", func(ctx context.Context, input *struct{}) (*ListWorkspacesOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		workspaces, err := svc.GetUserWorkspaces(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list workspaces")
		}

		items := make([]WorkspaceResponse, len(workspaces))
		for i, ws := range workspaces {
			items[i] = toWorkspaceResponse(ws)
		}

		return &ListWorkspacesOutput{
			Body: WorkspaceListResponse{Items: items},
		}, nil
	})

	// Get workspace by slug
	huma.Get(api, "/workspaces/by-slug/{slug}", func(ctx context.Context, input *GetWorkspaceBySlugInput) (*GetWorkspaceOutput, error) {
		_, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		workspace, err := svc.GetBySlug(ctx, input.Slug)
		if err != nil || workspace == nil {
			return nil, huma.Error404NotFound("workspace not found")
		}

		return &GetWorkspaceOutput{
			Body: toWorkspaceResponse(workspace),
		}, nil
	})

	// Create workspace
	huma.Post(api, "/workspaces", func(ctx context.Context, input *CreateWorkspaceRequest) (*CreateWorkspaceOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		workspace, err := svc.Create(ctx, CreateWorkspaceInput{
			Name:        input.Body.Name,
			Slug:        input.Body.Slug,
			Description: input.Body.Description,
			IsPersonal:  input.Body.IsPersonal,
			CreatedBy:   authUser.ID,
		})
		if err != nil {
			if err == ErrSlugTaken {
				return nil, huma.Error400BadRequest("workspace slug is already taken")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &CreateWorkspaceOutput{
			Body: toWorkspaceResponse(workspace),
		}, nil
	})
}

// RegisterWorkspaceScopedRoutes registers routes for single workspace operations
// (get, update, delete). These are registered on the workspace-scoped API.
func RegisterWorkspaceScopedRoutes(api huma.API, svc ServiceInterface) {
	// Get workspace (handles /workspaces/{workspace_id} as root "/" on subrouter)
	huma.Get(api, "/", func(ctx context.Context, input *struct{}) (*GetWorkspaceOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		workspace, err := svc.GetByID(ctx, workspaceID)
		if err != nil || workspace == nil {
			return nil, huma.Error404NotFound("workspace not found")
		}

		return &GetWorkspaceOutput{
			Body: toWorkspaceResponse(workspace),
		}, nil
	})

	// Update workspace
	huma.Patch(api, "/", func(ctx context.Context, input *UpdateWorkspaceBodyInput) (*UpdateWorkspaceOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		updateInput := UpdateWorkspaceInput{
			Description: input.Body.Description,
		}
		if input.Body.Name != nil {
			updateInput.Name = *input.Body.Name
		}

		workspace, err := svc.Update(ctx, workspaceID, updateInput)
		if err != nil {
			if err == ErrWorkspaceNotFound {
				return nil, huma.Error404NotFound("workspace not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdateWorkspaceOutput{
			Body: toWorkspaceResponse(workspace),
		}, nil
	})

	// Delete workspace
	huma.Delete(api, "/", func(ctx context.Context, input *struct{}) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Delete(ctx, workspaceID)
		if err != nil {
			if err == ErrWorkspaceNotFound {
				return nil, huma.Error404NotFound("workspace not found")
			}
			if err == ErrCannotDeletePersonal {
				return nil, huma.Error400BadRequest("cannot delete personal workspace")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})
}

func toWorkspaceResponse(w *Workspace) WorkspaceResponse {
	return WorkspaceResponse{
		ID:          w.ID(),
		Name:        w.Name(),
		Slug:        w.Slug(),
		Description: w.Description(),
		IsPersonal:  w.IsPersonal(),
		CreatedAt:   w.CreatedAt(),
		UpdatedAt:   w.UpdatedAt(),
	}
}

// Request/Response types

type ListWorkspacesOutput struct {
	Body WorkspaceListResponse
}

type WorkspaceListResponse struct {
	Items []WorkspaceResponse `json:"items"`
}

type GetWorkspaceInput struct {
	ID uuid.UUID `path:"id"`
}

type GetWorkspaceBySlugInput struct {
	Slug string `path:"slug"`
}

type GetWorkspaceOutput struct {
	Body WorkspaceResponse
}

type CreateWorkspaceRequest struct {
	Body struct {
		Name        string  `json:"name" minLength:"1" maxLength:"255" doc:"Workspace name"`
		Slug        string  `json:"slug" minLength:"1" maxLength:"100" pattern:"^[a-z0-9-]+$" doc:"Workspace slug (URL-safe identifier)"`
		Description *string `json:"description,omitempty" doc:"Workspace description"`
		IsPersonal  bool    `json:"is_personal" doc:"Whether this is a personal workspace"`
	}
}

type CreateWorkspaceOutput struct {
	Body WorkspaceResponse
}

type UpdateWorkspaceRequest struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name        *string `json:"name,omitempty" minLength:"1" maxLength:"255" doc:"Workspace name"`
		Description *string `json:"description,omitempty" doc:"Workspace description"`
	}
}

// UpdateWorkspaceBodyInput is for workspace-scoped update (no path param needed)
type UpdateWorkspaceBodyInput struct {
	Body struct {
		Name        *string `json:"name,omitempty" minLength:"1" maxLength:"255" doc:"Workspace name"`
		Description *string `json:"description,omitempty" doc:"Workspace description"`
	}
}

type UpdateWorkspaceOutput struct {
	Body WorkspaceResponse
}

type WorkspaceResponse struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description *string   `json:"description,omitempty"`
	IsPersonal  bool      `json:"is_personal"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
