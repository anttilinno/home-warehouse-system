package loan

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers loan routes.
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	// List all loans
	huma.Get(api, "/loans", func(ctx context.Context, input *ListLoansInput) (*ListLoansOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		loans, _, err := svc.List(ctx, workspaceID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list loans")
		}

		items := make([]LoanResponse, len(loans))
		for i, l := range loans {
			items[i] = toLoanResponse(l)
		}

		return &ListLoansOutput{
			Body: LoanListResponse{Items: items},
		}, nil
	})

	// Get active loans
	huma.Get(api, "/loans/active", func(ctx context.Context, input *struct{}) (*ListLoansOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loans, err := svc.GetActiveLoans(ctx, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get active loans")
		}

		items := make([]LoanResponse, len(loans))
		for i, l := range loans {
			items[i] = toLoanResponse(l)
		}

		return &ListLoansOutput{
			Body: LoanListResponse{Items: items},
		}, nil
	})

	// Get overdue loans
	huma.Get(api, "/loans/overdue", func(ctx context.Context, input *struct{}) (*ListLoansOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loans, err := svc.GetOverdueLoans(ctx, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get overdue loans")
		}

		items := make([]LoanResponse, len(loans))
		for i, l := range loans {
			items[i] = toLoanResponse(l)
		}

		return &ListLoansOutput{
			Body: LoanListResponse{Items: items},
		}, nil
	})

	// Get loan by ID
	huma.Get(api, "/loans/{id}", func(ctx context.Context, input *GetLoanInput) (*GetLoanOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loan, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || loan == nil {
			return nil, huma.Error404NotFound("loan not found")
		}

		return &GetLoanOutput{
			Body: toLoanResponse(loan),
		}, nil
	})

	// Create loan
	huma.Post(api, "/loans", func(ctx context.Context, input *CreateLoanInput) (*CreateLoanOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loanedAt := time.Now()
		if input.Body.LoanedAt != nil {
			loanedAt = *input.Body.LoanedAt
		}

		loan, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			InventoryID: input.Body.InventoryID,
			BorrowerID:  input.Body.BorrowerID,
			Quantity:    input.Body.Quantity,
			LoanedAt:    loanedAt,
			DueDate:     input.Body.DueDate,
			Notes:       input.Body.Notes,
		})
		if err != nil {
			if err == ErrInventoryNotAvailable {
				return nil, huma.Error400BadRequest("inventory is not available for loan")
			}
			if err == ErrQuantityExceedsAvailable {
				return nil, huma.Error400BadRequest("requested quantity exceeds available quantity")
			}
			if err == ErrInventoryOnLoan {
				return nil, huma.Error400BadRequest("inventory already has an active loan")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &CreateLoanOutput{
			Body: toLoanResponse(loan),
		}, nil
	})

	// Return loan
	huma.Post(api, "/loans/{id}/return", func(ctx context.Context, input *ReturnLoanInput) (*ReturnLoanOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loan, err := svc.Return(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrLoanNotFound {
				return nil, huma.Error404NotFound("loan not found")
			}
			if err == ErrAlreadyReturned {
				return nil, huma.Error400BadRequest("loan has already been returned")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &ReturnLoanOutput{
			Body: toLoanResponse(loan),
		}, nil
	})

	// Extend due date
	huma.Patch(api, "/loans/{id}/extend", func(ctx context.Context, input *ExtendLoanInput) (*ExtendLoanOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loan, err := svc.ExtendDueDate(ctx, input.ID, workspaceID, input.Body.NewDueDate)
		if err != nil {
			if err == ErrLoanNotFound {
				return nil, huma.Error404NotFound("loan not found")
			}
			if err == ErrAlreadyReturned {
				return nil, huma.Error400BadRequest("cannot extend due date for returned loan")
			}
			if err == ErrInvalidDueDate {
				return nil, huma.Error400BadRequest("new due date must be after loaned date")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &ExtendLoanOutput{
			Body: toLoanResponse(loan),
		}, nil
	})

	// List loans by borrower
	huma.Get(api, "/borrowers/{borrower_id}/loans", func(ctx context.Context, input *ListBorrowerLoansInput) (*ListLoansOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		loans, err := svc.ListByBorrower(ctx, workspaceID, input.BorrowerID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list loans")
		}

		items := make([]LoanResponse, len(loans))
		for i, l := range loans {
			items[i] = toLoanResponse(l)
		}

		return &ListLoansOutput{
			Body: LoanListResponse{Items: items},
		}, nil
	})

	// List loans by inventory
	huma.Get(api, "/inventory/{inventory_id}/loans", func(ctx context.Context, input *ListInventoryLoansInput) (*ListLoansOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loans, err := svc.ListByInventory(ctx, workspaceID, input.InventoryID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list loans")
		}

		items := make([]LoanResponse, len(loans))
		for i, l := range loans {
			items[i] = toLoanResponse(l)
		}

		return &ListLoansOutput{
			Body: LoanListResponse{Items: items},
		}, nil
	})
}

func toLoanResponse(l *Loan) LoanResponse {
	return LoanResponse{
		ID:          l.ID(),
		WorkspaceID: l.WorkspaceID(),
		InventoryID: l.InventoryID(),
		BorrowerID:  l.BorrowerID(),
		Quantity:    l.Quantity(),
		LoanedAt:    l.LoanedAt(),
		DueDate:     l.DueDate(),
		ReturnedAt:  l.ReturnedAt(),
		Notes:       l.Notes(),
		IsActive:    l.IsActive(),
		IsOverdue:   l.IsOverdue(),
		CreatedAt:   l.CreatedAt(),
		UpdatedAt:   l.UpdatedAt(),
	}
}

// Request/Response types

type ListLoansInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListLoansOutput struct {
	Body LoanListResponse
}

type LoanListResponse struct {
	Items []LoanResponse `json:"items"`
}

type GetLoanInput struct {
	ID uuid.UUID `path:"id"`
}

type GetLoanOutput struct {
	Body LoanResponse
}

type CreateLoanInput struct {
	Body struct {
		InventoryID uuid.UUID  `json:"inventory_id" doc:"ID of the inventory item to loan"`
		BorrowerID  uuid.UUID  `json:"borrower_id" doc:"ID of the borrower"`
		Quantity    int        `json:"quantity" minimum:"1" doc:"Quantity to loan"`
		LoanedAt    *time.Time `json:"loaned_at,omitempty" doc:"Loan date (defaults to now)"`
		DueDate     *time.Time `json:"due_date,omitempty" doc:"Due date for return"`
		Notes       *string    `json:"notes,omitempty"`
	}
}

type CreateLoanOutput struct {
	Body LoanResponse
}

type ReturnLoanInput struct {
	ID uuid.UUID `path:"id"`
}

type ReturnLoanOutput struct {
	Body LoanResponse
}

type ExtendLoanInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		NewDueDate time.Time `json:"new_due_date" doc:"New due date for the loan"`
	}
}

type ExtendLoanOutput struct {
	Body LoanResponse
}

type ListBorrowerLoansInput struct {
	BorrowerID uuid.UUID `path:"borrower_id"`
	Page       int       `query:"page" default:"1" minimum:"1"`
	Limit      int       `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListInventoryLoansInput struct {
	InventoryID uuid.UUID `path:"inventory_id"`
}

type LoanResponse struct {
	ID          uuid.UUID  `json:"id"`
	WorkspaceID uuid.UUID  `json:"workspace_id"`
	InventoryID uuid.UUID  `json:"inventory_id"`
	BorrowerID  uuid.UUID  `json:"borrower_id"`
	Quantity    int        `json:"quantity"`
	LoanedAt    time.Time  `json:"loaned_at"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	ReturnedAt  *time.Time `json:"returned_at,omitempty"`
	Notes       *string    `json:"notes,omitempty"`
	IsActive    bool       `json:"is_active" doc:"True if loan has not been returned"`
	IsOverdue   bool       `json:"is_overdue" doc:"True if loan is past due date and not returned"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
