package category

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

const (
	msgWorkspaceContextRequired = "workspace context required"
	routeCategoryByID           = "/categories/{id}"
)

// RegisterRoutes registers category routes.
// Each handler is a package factory func (see below) so this stays a flat list
// of registrations rather than a single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/categories", listCategories(svc))
	huma.Get(api, "/categories/root", listRootCategories(svc))
	huma.Get(api, routeCategoryByID, getCategory(svc))
	huma.Get(api, "/categories/{id}/children", listChildCategories(svc))
	huma.Post(api, "/categories", createCategory(svc, broadcaster))
	huma.Patch(api, routeCategoryByID, updateCategory(svc, broadcaster))
	huma.Post(api, "/categories/{id}/archive", archiveCategory(svc, broadcaster))
	huma.Post(api, "/categories/{id}/restore", restoreCategory(svc, broadcaster))
	huma.Delete(api, routeCategoryByID, deleteCategory(svc, broadcaster))
	huma.Get(api, "/categories/{id}/breadcrumb", getCategoryBreadcrumb(svc))
}

// listCategories lists all categories in the workspace.
func listCategories(svc ServiceInterface) func(context.Context, *struct{}) (*ListCategoriesOutput, error) {
	return func(ctx context.Context, input *struct{}) (*ListCategoriesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
	}
}

// listRootCategories lists root categories in the workspace.
func listRootCategories(svc ServiceInterface) func(context.Context, *struct{}) (*ListCategoriesOutput, error) {
	return func(ctx context.Context, input *struct{}) (*ListCategoriesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
	}
}

// getCategory returns a single category by ID.
func getCategory(svc ServiceInterface) func(context.Context, *GetCategoryInput) (*GetCategoryOutput, error) {
	return func(ctx context.Context, input *GetCategoryInput) (*GetCategoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		category, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || category == nil {
			return nil, huma.Error404NotFound("category not found")
		}

		return &GetCategoryOutput{
			Body: toCategoryResponse(category),
		}, nil
	}
}

// listChildCategories lists the children of a category.
func listChildCategories(svc ServiceInterface) func(context.Context, *GetCategoryInput) (*ListCategoriesOutput, error) {
	return func(ctx context.Context, input *GetCategoryInput) (*ListCategoriesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
	}
}

// createCategory creates a category.
func createCategory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateCategoryInput) (*CreateCategoryOutput, error) {
	return func(ctx context.Context, input *CreateCategoryInput) (*CreateCategoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		category, err := svc.Create(ctx, CreateInput{
			WorkspaceID:      workspaceID,
			Name:             input.Body.Name,
			ParentCategoryID: input.Body.ParentCategoryID,
			Description:      input.Body.Description,
		})
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "category.created",
				EntityID:   category.ID().String(),
				EntityType: "category",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        category.ID(),
					"name":      category.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateCategoryOutput{
			Status: 201,
			Body:   toCategoryResponse(category),
		}, nil
	}
}

// updateCategory updates a category.
func updateCategory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateCategoryInput) (*UpdateCategoryOutput, error) {
	return func(ctx context.Context, input *UpdateCategoryInput) (*UpdateCategoryOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		updateInput := UpdateInput{
			ParentCategoryID: input.Body.ParentCategoryID,
			Description:      input.Body.Description,
		}
		if input.Body.Name != nil {
			updateInput.Name = *input.Body.Name
		}

		category, err := svc.Update(ctx, input.ID, workspaceID, updateInput)
		if err != nil {
			if errors.Is(err, ErrCyclicParent) {
				return nil, huma.Error400BadRequest("cyclic parent reference not allowed")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "category.updated",
				EntityID:   category.ID().String(),
				EntityType: "category",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        category.ID(),
					"name":      category.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateCategoryOutput{
			Body: toCategoryResponse(category),
		}, nil
	}
}

// archiveCategory archives a category.
func archiveCategory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetCategoryInput) (*struct{}, error) {
	// Publish event (treat archive as delete event)
	return categoryLifecycleHandler(broadcaster, svc.Archive, "category.deleted")
}

// restoreCategory restores an archived category.
func restoreCategory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetCategoryInput) (*struct{}, error) {
	// Publish event (treat restore as create event)
	return categoryLifecycleHandler(broadcaster, svc.Restore, "category.created")
}

// categoryLifecycleHandler builds a handler that runs a workspace-scoped action
// (archive/restore) on a category and publishes the given lifecycle event.
func categoryLifecycleHandler(
	broadcaster *events.Broadcaster,
	action func(ctx context.Context, id, workspaceID uuid.UUID) error,
	eventType string,
) func(context.Context, *GetCategoryInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetCategoryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := action(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       eventType,
				EntityID:   input.ID.String(),
				EntityType: "category",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	}
}

// deleteCategory deletes a category.
func deleteCategory(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetCategoryInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetCategoryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.Delete(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrHasChildren) {
				return nil, huma.Error409Conflict("cannot delete category with child categories")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "category.deleted",
				EntityID:   input.ID.String(),
				EntityType: "category",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	}
}

// getCategoryBreadcrumb returns the breadcrumb trail for a category.
func getCategoryBreadcrumb(svc ServiceInterface) func(context.Context, *GetCategoryInput) (*BreadcrumbOutput, error) {
	return func(ctx context.Context, input *GetCategoryInput) (*BreadcrumbOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		breadcrumb, err := svc.GetBreadcrumb(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get breadcrumb")
		}

		return &BreadcrumbOutput{
			Body: breadcrumb,
		}, nil
	}
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
	Status int `json:"-"`
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
