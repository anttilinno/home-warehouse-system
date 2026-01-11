package company

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type contextKey string

const WorkspaceContextKey contextKey = "workspace"

// RegisterRoutes registers company routes.
func RegisterRoutes(api huma.API, svc *Service) {
	// List companies
	huma.Get(api, "/companies", func(ctx context.Context, input *ListCompaniesInput) (*ListCompaniesOutput, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
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
	})

	// Get company by ID
	huma.Get(api, "/companies/{id}", func(ctx context.Context, input *GetCompanyInput) (*GetCompanyOutput, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		company, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrCompanyNotFound {
				return nil, huma.Error404NotFound("company not found")
			}
			return nil, huma.Error500InternalServerError("failed to get company")
		}

		return &GetCompanyOutput{
			Body: toCompanyResponse(company),
		}, nil
	})

	// Create company
	huma.Post(api, "/companies", func(ctx context.Context, input *CreateCompanyInput) (*CreateCompanyOutput, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		company, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			Name:        input.Body.Name,
			Website:     input.Body.Website,
			Notes:       input.Body.Notes,
		})
		if err != nil {
			if err == ErrNameTaken {
				return nil, huma.Error400BadRequest("company name already exists")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &CreateCompanyOutput{
			Body: toCompanyResponse(company),
		}, nil
	})

	// Update company
	huma.Patch(api, "/companies/{id}", func(ctx context.Context, input *UpdateCompanyInput) (*UpdateCompanyOutput, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		existing, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrCompanyNotFound {
				return nil, huma.Error404NotFound("company not found")
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
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdateCompanyOutput{
			Body: toCompanyResponse(company),
		}, nil
	})

	// Archive company
	huma.Post(api, "/companies/{id}/archive", func(ctx context.Context, input *GetCompanyInput) (*struct{}, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrCompanyNotFound {
				return nil, huma.Error404NotFound("company not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Restore company
	huma.Post(api, "/companies/{id}/restore", func(ctx context.Context, input *GetCompanyInput) (*struct{}, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Restore(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrCompanyNotFound {
				return nil, huma.Error404NotFound("company not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Delete company
	huma.Delete(api, "/companies/{id}", func(ctx context.Context, input *GetCompanyInput) (*struct{}, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Delete(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrCompanyNotFound {
				return nil, huma.Error404NotFound("company not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})
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
