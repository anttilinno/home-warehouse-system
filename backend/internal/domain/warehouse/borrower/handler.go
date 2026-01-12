package borrower

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers borrower routes.
func RegisterRoutes(api huma.API, svc *Service) {
	// List borrowers
	huma.Get(api, "/borrowers", func(ctx context.Context, input *ListBorrowersInput) (*ListBorrowersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		borrowers, _, err := svc.List(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list borrowers")
		}

		items := make([]BorrowerResponse, len(borrowers))
		for i, b := range borrowers {
			items[i] = toBorrowerResponse(b)
		}

		return &ListBorrowersOutput{
			Body: BorrowerListResponse{Items: items},
		}, nil
	})

	// Get borrower by ID
	huma.Get(api, "/borrowers/{id}", func(ctx context.Context, input *GetBorrowerInput) (*GetBorrowerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		borrower, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || borrower == nil {
			return nil, huma.Error404NotFound("borrower not found")
		}

		return &GetBorrowerOutput{
			Body: toBorrowerResponse(borrower),
		}, nil
	})

	// Create borrower
	huma.Post(api, "/borrowers", func(ctx context.Context, input *CreateBorrowerInput) (*CreateBorrowerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		borrower, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			Name:        input.Body.Name,
			Email:       input.Body.Email,
			Phone:       input.Body.Phone,
			Notes:       input.Body.Notes,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &CreateBorrowerOutput{
			Body: toBorrowerResponse(borrower),
		}, nil
	})

	// Update borrower
	huma.Patch(api, "/borrowers/{id}", func(ctx context.Context, input *UpdateBorrowerInput) (*UpdateBorrowerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		updateInput := UpdateInput{
			Email: input.Body.Email,
			Phone: input.Body.Phone,
			Notes: input.Body.Notes,
		}
		if input.Body.Name != nil {
			updateInput.Name = *input.Body.Name
		}

		borrower, err := svc.Update(ctx, input.ID, workspaceID, updateInput)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdateBorrowerOutput{
			Body: toBorrowerResponse(borrower),
		}, nil
	})

	// Archive borrower
	huma.Delete(api, "/borrowers/{id}", func(ctx context.Context, input *DeleteBorrowerInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.Archive(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrHasActiveLoans {
				return nil, huma.Error400BadRequest("cannot delete borrower with active loans")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})
}

func toBorrowerResponse(b *Borrower) BorrowerResponse {
	return BorrowerResponse{
		ID:          b.ID(),
		WorkspaceID: b.WorkspaceID(),
		Name:        b.Name(),
		Email:       b.Email(),
		Phone:       b.Phone(),
		Notes:       b.Notes(),
		IsArchived:  b.IsArchived(),
		CreatedAt:   b.CreatedAt(),
		UpdatedAt:   b.UpdatedAt(),
	}
}

// Request/Response types

type ListBorrowersInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListBorrowersOutput struct {
	Body BorrowerListResponse
}

type BorrowerListResponse struct {
	Items []BorrowerResponse `json:"items"`
}

type GetBorrowerInput struct {
	ID uuid.UUID `path:"id"`
}

type GetBorrowerOutput struct {
	Body BorrowerResponse
}

type CreateBorrowerInput struct {
	Body struct {
		Name  string  `json:"name" minLength:"1" maxLength:"255"`
		Email *string `json:"email,omitempty" format:"email"`
		Phone *string `json:"phone,omitempty"`
		Notes *string `json:"notes,omitempty"`
	}
}

type CreateBorrowerOutput struct {
	Body BorrowerResponse
}

type UpdateBorrowerInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Name  *string `json:"name,omitempty" minLength:"1" maxLength:"255"`
		Email *string `json:"email,omitempty" format:"email"`
		Phone *string `json:"phone,omitempty"`
		Notes *string `json:"notes,omitempty"`
	}
}

type UpdateBorrowerOutput struct {
	Body BorrowerResponse
}

type DeleteBorrowerInput struct {
	ID uuid.UUID `path:"id"`
}

type BorrowerResponse struct {
	ID          uuid.UUID  `json:"id"`
	WorkspaceID uuid.UUID  `json:"workspace_id"`
	Name        string     `json:"name"`
	Email       *string    `json:"email,omitempty"`
	Phone       *string    `json:"phone,omitempty"`
	Notes       *string    `json:"notes,omitempty"`
	IsArchived  bool       `json:"is_archived"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
