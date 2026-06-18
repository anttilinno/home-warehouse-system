package workspace

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

const (
	msgAuthenticationRequired   = "authentication required"
	msgWorkspaceNotFound        = "workspace not found"
	msgWorkspaceContextRequired = "workspace context required"
)

// RegisterRoutes registers workspace routes at user-level (list, create, get by slug).
// Each handler is a package factory func (see below) so this stays a flat list
// of registrations rather than a single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	huma.Get(api, "/workspaces", listWorkspaces(svc))
	huma.Get(api, "/workspaces/by-slug/{slug}", getWorkspaceBySlug(svc))
	huma.Post(api, "/workspaces", createWorkspace(svc))
}

// RegisterWorkspaceScopedRoutes registers routes for single workspace operations
// (get, update, delete). These are registered on the workspace-scoped API.
func RegisterWorkspaceScopedRoutes(api huma.API, svc ServiceInterface) {
	huma.Get(api, "/", getWorkspace(svc))
	huma.Patch(api, "/", updateWorkspace(svc))
	huma.Delete(api, "/", deleteWorkspace(svc))
}

// listWorkspaces lists the authenticated user's workspaces.
func listWorkspaces(svc ServiceInterface) func(context.Context, *struct{}) (*ListWorkspacesOutput, error) {
	return func(ctx context.Context, input *struct{}) (*ListWorkspacesOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgAuthenticationRequired)
		}

		workspaces, err := svc.GetUserWorkspaces(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list workspaces")
		}

		items := make([]WorkspaceResponse, len(workspaces))
		for i, ws := range workspaces {
			items[i] = toWorkspaceWithRoleResponse(ws)
		}

		return &ListWorkspacesOutput{
			Body: WorkspaceListResponse{Items: items},
		}, nil
	}
}

// getWorkspaceBySlug returns a workspace by its slug.
func getWorkspaceBySlug(svc ServiceInterface) func(context.Context, *GetWorkspaceBySlugInput) (*GetWorkspaceOutput, error) {
	return func(ctx context.Context, input *GetWorkspaceBySlugInput) (*GetWorkspaceOutput, error) {
		_, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgAuthenticationRequired)
		}

		workspace, err := svc.GetBySlug(ctx, input.Slug)
		if err != nil || workspace == nil {
			return nil, huma.Error404NotFound(msgWorkspaceNotFound)
		}

		return &GetWorkspaceOutput{
			Body: toWorkspaceResponse(workspace),
		}, nil
	}
}

// createWorkspace creates a workspace owned by the authenticated user.
func createWorkspace(svc ServiceInterface) func(context.Context, *CreateWorkspaceRequest) (*CreateWorkspaceOutput, error) {
	return func(ctx context.Context, input *CreateWorkspaceRequest) (*CreateWorkspaceOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgAuthenticationRequired)
		}

		workspace, err := svc.Create(ctx, CreateWorkspaceInput{
			Name:        input.Body.Name,
			Slug:        input.Body.Slug,
			Description: input.Body.Description,
			IsPersonal:  input.Body.IsPersonal,
			CreatedBy:   authUser.ID,
		})
		if err != nil {
			if errors.Is(err, ErrSlugTaken) {
				return nil, huma.Error400BadRequest("workspace slug is already taken")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		return &CreateWorkspaceOutput{
			Body: toWorkspaceResponse(workspace),
		}, nil
	}
}

// getWorkspace returns the current workspace-scoped workspace.
func getWorkspace(svc ServiceInterface) func(context.Context, *struct{}) (*GetWorkspaceOutput, error) {
	return func(ctx context.Context, input *struct{}) (*GetWorkspaceOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		workspace, err := svc.GetByID(ctx, workspaceID)
		if err != nil || workspace == nil {
			return nil, huma.Error404NotFound(msgWorkspaceNotFound)
		}

		return &GetWorkspaceOutput{
			Body: toWorkspaceResponse(workspace),
		}, nil
	}
}

// updateWorkspace updates the current workspace-scoped workspace.
func updateWorkspace(svc ServiceInterface) func(context.Context, *UpdateWorkspaceBodyInput) (*UpdateWorkspaceOutput, error) {
	return func(ctx context.Context, input *UpdateWorkspaceBodyInput) (*UpdateWorkspaceOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		updateInput := UpdateWorkspaceInput{
			Description: input.Body.Description,
		}
		if input.Body.Name != nil {
			updateInput.Name = *input.Body.Name
		}

		workspace, err := svc.Update(ctx, workspaceID, updateInput)
		if err != nil {
			if errors.Is(err, ErrWorkspaceNotFound) {
				return nil, huma.Error404NotFound(msgWorkspaceNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		return &UpdateWorkspaceOutput{
			Body: toWorkspaceResponse(workspace),
		}, nil
	}
}

// deleteWorkspace deletes the current workspace-scoped workspace.
func deleteWorkspace(svc ServiceInterface) func(context.Context, *struct{}) (*struct{}, error) {
	return func(ctx context.Context, input *struct{}) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		err := svc.Delete(ctx, workspaceID)
		if err != nil {
			if errors.Is(err, ErrWorkspaceNotFound) {
				return nil, huma.Error404NotFound(msgWorkspaceNotFound)
			}
			if errors.Is(err, ErrCannotDeletePersonal) {
				return nil, huma.Error400BadRequest("cannot delete personal workspace")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		return nil, nil
	}
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

func toWorkspaceWithRoleResponse(w *WorkspaceWithRole) WorkspaceResponse {
	return WorkspaceResponse{
		ID:          w.ID(),
		Name:        w.Name(),
		Slug:        w.Slug(),
		Description: w.Description(),
		IsPersonal:  w.IsPersonal(),
		Role:        w.Role,
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
	Role        string    `json:"role,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
