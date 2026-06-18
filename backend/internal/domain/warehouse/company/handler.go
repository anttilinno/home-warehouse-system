package company

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
	routeCompanyByID            = "/companies/{id}"
	msgCompanyNotFound          = "company not found"
)

// RegisterRoutes registers company routes.
//
// Each handler is a package factory func (see below) so this stays a flat list
// of registrations rather than a single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/companies", listCompanies(svc))
	huma.Get(api, routeCompanyByID, getCompany(svc))
	huma.Post(api, "/companies", createCompany(svc, broadcaster))
	huma.Patch(api, routeCompanyByID, updateCompany(svc, broadcaster))
	huma.Post(api, "/companies/{id}/archive", archiveCompany(svc, broadcaster))
	huma.Post(api, "/companies/{id}/restore", restoreCompany(svc, broadcaster))
	huma.Delete(api, routeCompanyByID, deleteCompany(svc, broadcaster))
}

// listCompanies lists companies in the workspace.
func listCompanies(svc ServiceInterface) func(context.Context, *ListCompaniesInput) (*ListCompaniesOutput, error) {
	return func(ctx context.Context, input *ListCompaniesInput) (*ListCompaniesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		result, err := svc.ListByWorkspace(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list companies")
		}

		items := make([]CompanyResponse, len(result.Items))
		for i, comp := range result.Items {
			items[i] = toCompanyResponse(comp)
		}

		return &ListCompaniesOutput{
			Body: CompanyListResponse{
				Items:      items,
				Total:      result.Total,
				Page:       result.Page,
				TotalPages: result.TotalPages,
			},
		}, nil
	}
}

// getCompany returns a single company by ID.
func getCompany(svc ServiceInterface) func(context.Context, *GetCompanyInput) (*GetCompanyOutput, error) {
	return func(ctx context.Context, input *GetCompanyInput) (*GetCompanyOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		company, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrCompanyNotFound) {
				return nil, huma.Error404NotFound(msgCompanyNotFound)
			}
			return nil, huma.Error500InternalServerError("failed to get company")
		}

		return &GetCompanyOutput{
			Body: toCompanyResponse(company),
		}, nil
	}
}

// createCompany creates a company.
func createCompany(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateCompanyInput) (*CreateCompanyOutput, error) {
	return func(ctx context.Context, input *CreateCompanyInput) (*CreateCompanyOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		company, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			Name:        input.Body.Name,
			Website:     input.Body.Website,
			Notes:       input.Body.Notes,
		})
		if err != nil {
			if errors.Is(err, ErrNameTaken) {
				return nil, huma.Error400BadRequest("company name already exists")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "company.created",
				EntityID:   company.ID().String(),
				EntityType: "company",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        company.ID(),
					"name":      company.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateCompanyOutput{
			Body: toCompanyResponse(company),
		}, nil
	}
}

// updateCompany updates a company.
func updateCompany(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateCompanyInput) (*UpdateCompanyOutput, error) {
	return func(ctx context.Context, input *UpdateCompanyInput) (*UpdateCompanyOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		existing, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrCompanyNotFound) {
				return nil, huma.Error404NotFound(msgCompanyNotFound)
			}
			return nil, huma.Error500InternalServerError("failed to get company")
		}

		name := existing.Name()
		if input.Body.Name != nil {
			name = *input.Body.Name
		}

		company, err := svc.Update(ctx, input.ID, workspaceID, UpdateInput{
			Name:    name,
			Website: input.Body.Website,
			Notes:   input.Body.Notes,
		})
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "company.updated",
				EntityID:   company.ID().String(),
				EntityType: "company",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        company.ID(),
					"name":      company.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateCompanyOutput{
			Body: toCompanyResponse(company),
		}, nil
	}
}

// lifecycleAction builds a handler that runs a single-target lifecycle action
// (archive/restore/delete) and publishes eventType on success. Extracted so the
// three otherwise-identical factories don't duplicate the workspace check, error
// mapping, and event-publish block.
func lifecycleAction(
	broadcaster *events.Broadcaster,
	eventType string,
	action func(ctx context.Context, id, workspaceID uuid.UUID) error,
) func(context.Context, *GetCompanyInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetCompanyInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := action(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrCompanyNotFound) {
				return nil, huma.Error404NotFound(msgCompanyNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       eventType,
				EntityID:   input.ID.String(),
				EntityType: "company",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	}
}

// archiveCompany archives a company (treat archive as a delete event).
func archiveCompany(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetCompanyInput) (*struct{}, error) {
	return lifecycleAction(broadcaster, "company.deleted", svc.Archive)
}

// restoreCompany restores an archived company (treat restore as a create event).
func restoreCompany(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetCompanyInput) (*struct{}, error) {
	return lifecycleAction(broadcaster, "company.created", svc.Restore)
}

// deleteCompany deletes a company.
func deleteCompany(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetCompanyInput) (*struct{}, error) {
	return lifecycleAction(broadcaster, "company.deleted", svc.Delete)
}

func toCompanyResponse(c *Company) CompanyResponse {
	return CompanyResponse{
		ID:          c.ID(),
		WorkspaceID: c.WorkspaceID(),
		Name:        c.Name(),
		Website:     c.Website(),
		Notes:       c.Notes(),
		IsArchived:  c.IsArchived(),
		CreatedAt:   c.CreatedAt(),
		UpdatedAt:   c.UpdatedAt(),
	}
}

// Request/Response types

type ListCompaniesInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListCompaniesOutput struct {
	Body CompanyListResponse
}

type CompanyListResponse struct {
	Items      []CompanyResponse `json:"items"`
	Total      int               `json:"total"`
	Page       int               `json:"page"`
	TotalPages int               `json:"total_pages"`
}

type GetCompanyInput struct {
	ID uuid.UUID `path:"id"`
}

type GetCompanyOutput struct {
	Body CompanyResponse
}

type CreateCompanyInput struct {
	Body struct {
		Name    string  `json:"name" minLength:"1" maxLength:"255" doc:"Company name"`
		Website *string `json:"website,omitempty" doc:"Company website URL"`
		Notes   *string `json:"notes,omitempty" doc:"Additional notes"`
	}
}

type CreateCompanyOutput struct {
	Body CompanyResponse
}

type UpdateCompanyInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name    *string `json:"name,omitempty" minLength:"1" maxLength:"255" doc:"Company name"`
		Website *string `json:"website,omitempty" doc:"Company website URL"`
		Notes   *string `json:"notes,omitempty" doc:"Additional notes"`
	}
}

type UpdateCompanyOutput struct {
	Body CompanyResponse
}

type CompanyResponse struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	Website     *string   `json:"website,omitempty"`
	Notes       *string   `json:"notes,omitempty"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
