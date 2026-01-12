package category

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// RegisterRoutes registers category routes.
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	// List all categories
	huma.Get(api, "/categories", func(ctx context.Context, input *struct{}) (*ListCategoriesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		categories, err := svc.ListByWorkspace(ctx, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list categories")
		}

		items := make([]CategoryResponse, len(categories))
		for i, cat := range categories {
			items[i] = toCategoryResponse(cat)
		}

		return &ListCategoriesOutput{
			Body: CategoryListResponse{Items: items},
		}, nil
	})

	// List root categories
	huma.Get(api, "/categories/root", func(ctx context.Context, input *struct{}) (*ListCategoriesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		categories, err := svc.ListRootCategories(ctx, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list root categories")
		}

		items := make([]CategoryResponse, len(categories))
		for i, cat := range categories {
			items[i] = toCategoryResponse(cat)
		}

		return &ListCategoriesOutput{
			Body: CategoryListResponse{Items: items},
		}, nil
	})

	// Get category by ID
	huma.Get(api, "/categories/{id}", func(ctx context.Context, input *GetCategoryInput) (*GetCategoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		category, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || category == nil {
			return nil, huma.Error404NotFound("category not found")
		}

		return &GetCategoryOutput{
			Body: toCategoryResponse(category),
		}, nil
	})

	// List category children
	huma.Get(api, "/categories/{id}/children", func(ctx context.Context, input *GetCategoryInput) (*ListCategoriesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		categories, err := svc.ListByParent(ctx, workspaceID, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list child categories")
		}

		items := make([]CategoryResponse, len(categories))
		for i, cat := range categories {
			items[i] = toCategoryResponse(cat)
		}

		return &ListCategoriesOutput{
			Body: CategoryListResponse{Items: items},
		}, nil
	})

	// Create category
	huma.Post(api, "/categories", func(ctx context.Context, input *CreateCategoryInput) (*CreateCategoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		category, err := svc.Create(ctx, CreateInput{
			WorkspaceID:      workspaceID,
			Name:             input.Body.Name,
			ParentCategoryID: input.Body.ParentCategoryID,
			Description:      input.Body.Description,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &CreateCategoryOutput{
			Status: 201,
			Body:   toCategoryResponse(category),
		}, nil
	})

	// Update category
	huma.Patch(api, "/categories/{id}", func(ctx context.Context, input *UpdateCategoryInput) (*UpdateCategoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		updateInput := UpdateInput{
			ParentCategoryID: input.Body.ParentCategoryID,
			Description:      input.Body.Description,
		}
		if input.Body.Name != nil {
			updateInput.Name = *input.Body.Name
		}

		category, err := svc.Update(ctx, input.ID, workspaceID, updateInput)
		if err != nil {
			if err == ErrCyclicParent {
				return nil, huma.Error400BadRequest("cyclic parent reference not allowed")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdateCategoryOutput{
			Body: toCategoryResponse(category),
		}, nil
	})

	// Archive category
	huma.Post(api, "/categories/{id}/archive", func(ctx context.Context, input *GetCategoryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Restore category
	huma.Post(api, "/categories/{id}/restore", func(ctx context.Context, input *GetCategoryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Delete category
	huma.Delete(api, "/categories/{id}", func(ctx context.Context, input *GetCategoryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Delete(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrHasChildren {
				return nil, huma.Error409Conflict("cannot delete category with child categories")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Get breadcrumb trail for a category
	huma.Get(api, "/categories/{id}/breadcrumb", func(ctx context.Context, input *GetCategoryInput) (*BreadcrumbOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		breadcrumb, err := svc.GetBreadcrumb(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get breadcrumb")
		}

		return &BreadcrumbOutput{
			Body: breadcrumb,
		}, nil
	})
}

func toCategoryResponse(c *Category) CategoryResponse {
	return CategoryResponse{
		ID:               c.ID(),
		WorkspaceID:      c.WorkspaceID(),
		Name:             c.Name(),
		ParentCategoryID: c.ParentCategoryID(),
		Description:      c.Description(),
		IsArchived:       c.IsArchived(),
		CreatedAt:        c.CreatedAt(),
		UpdatedAt:        c.UpdatedAt(),
	}
}

// Request/Response types

type GetCategoryInput struct {
	ID uuid.UUID `path:"id"`
}

type ListCategoriesOutput struct {
	Body CategoryListResponse
}

type CategoryListResponse struct {
	Items []CategoryResponse `json:"items"`
}

type GetCategoryOutput struct {
	Body CategoryResponse
}

type CreateCategoryInput struct {
	Body struct {
		Name             string     `json:"name" minLength:"1" maxLength:"255" doc:"Category name"`
		ParentCategoryID *uuid.UUID `json:"parent_category_id,omitempty" doc:"Parent category ID for hierarchical categories"`
		Description      *string    `json:"description,omitempty" doc:"Category description"`
	}
}

type CreateCategoryOutput struct {
	Status int              `json:"-"`
	Body   CategoryResponse
}

type UpdateCategoryInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name             *string    `json:"name,omitempty" minLength:"1" maxLength:"255" doc:"Category name"`
		ParentCategoryID *uuid.UUID `json:"parent_category_id,omitempty" doc:"Parent category ID for hierarchical categories"`
		Description      *string    `json:"description,omitempty" doc:"Category description"`
	}
}

type UpdateCategoryOutput struct {
	Body CategoryResponse
}

type BreadcrumbOutput struct {
	Body []BreadcrumbItem `json:"breadcrumb"`
}

type CategoryResponse struct {
	ID               uuid.UUID  `json:"id"`
	WorkspaceID      uuid.UUID  `json:"workspace_id"`
	Name             string     `json:"name"`
	ParentCategoryID *uuid.UUID `json:"parent_category_id,omitempty"`
	Description      *string    `json:"description,omitempty"`
	IsArchived       bool       `json:"is_archived"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}
