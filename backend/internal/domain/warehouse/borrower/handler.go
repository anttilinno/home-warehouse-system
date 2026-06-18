package borrower

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
	routeBorrowerByID           = "/borrowers/{id}"
)

// RegisterRoutes registers borrower routes.
//
// Each handler is a package factory func (see below) so this stays a flat list
// of registrations rather than a single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/borrowers", listBorrowers(svc))
	huma.Get(api, routeBorrowerByID, getBorrower(svc))
	huma.Post(api, "/borrowers", createBorrower(svc, broadcaster))
	huma.Patch(api, routeBorrowerByID, updateBorrower(svc, broadcaster))
	huma.Delete(api, routeBorrowerByID, deleteBorrower(svc, broadcaster))
	huma.Post(api, "/borrowers/{id}/archive", archiveBorrower(svc, broadcaster))
	huma.Post(api, "/borrowers/{id}/restore", restoreBorrower(svc, broadcaster))
	huma.Get(api, "/borrowers/search", searchBorrowers(svc))
}

// listBorrowers lists borrowers in the workspace (optionally including archived).
func listBorrowers(svc ServiceInterface) func(context.Context, *ListBorrowersInput) (*ListBorrowersOutput, error) {
	return func(ctx context.Context, input *ListBorrowersInput) (*ListBorrowersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		borrowers, _, err := svc.List(ctx, workspaceID, pagination, input.Archived)
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
	}
}

// getBorrower returns a single borrower by ID.
func getBorrower(svc ServiceInterface) func(context.Context, *GetBorrowerInput) (*GetBorrowerOutput, error) {
	return func(ctx context.Context, input *GetBorrowerInput) (*GetBorrowerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		borrower, err := svc.GetByID(ctx, input.ID, workspaceID)
		if err != nil || borrower == nil {
			return nil, huma.Error404NotFound("borrower not found")
		}

		return &GetBorrowerOutput{
			Body: toBorrowerResponse(borrower),
		}, nil
	}
}

// createBorrower creates a borrower.
func createBorrower(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *CreateBorrowerInput) (*CreateBorrowerOutput, error) {
	return func(ctx context.Context, input *CreateBorrowerInput) (*CreateBorrowerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		borrower, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			Name:        input.Body.Name,
			Email:       input.Body.Email,
			Phone:       input.Body.Phone,
			Notes:       input.Body.Notes,
		})
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "borrower.created",
				EntityID:   borrower.ID().String(),
				EntityType: "borrower",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        borrower.ID(),
					"name":      borrower.Name(),
					"user_name": userName,
				},
			})
		}

		return &CreateBorrowerOutput{
			Body: toBorrowerResponse(borrower),
		}, nil
	}
}

// updateBorrower updates a borrower.
func updateBorrower(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *UpdateBorrowerInput) (*UpdateBorrowerOutput, error) {
	return func(ctx context.Context, input *UpdateBorrowerInput) (*UpdateBorrowerOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

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
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "borrower.updated",
				EntityID:   borrower.ID().String(),
				EntityType: "borrower",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        borrower.ID(),
					"name":      borrower.Name(),
					"user_name": userName,
				},
			})
		}

		return &UpdateBorrowerOutput{
			Body: toBorrowerResponse(borrower),
		}, nil
	}
}

// deleteBorrower hard-deletes a borrower (the archive endpoint is separate).
func deleteBorrower(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *DeleteBorrowerInput) (*struct{}, error) {
	return func(ctx context.Context, input *DeleteBorrowerInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
			if errors.Is(err, ErrHasActiveLoans) {
				return nil, huma.Error400BadRequest("cannot delete borrower with active loans")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		publishBorrowerLifecycleEvent(ctx, broadcaster, workspaceID, "borrower.deleted", input.ID)

		return nil, nil
	}
}

// archiveBorrower soft-archives a borrower (always succeeds regardless of
// active loans per D-02).
func archiveBorrower(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetBorrowerInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetBorrowerInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		if err := svc.Archive(ctx, input.ID, workspaceID); err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		publishBorrowerLifecycleEvent(ctx, broadcaster, workspaceID, "borrower.archived", input.ID)

		return nil, nil
	}
}

// restoreBorrower restores (unarchives) a borrower.
func restoreBorrower(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *GetBorrowerInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetBorrowerInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		if err := svc.Restore(ctx, input.ID, workspaceID); err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		publishBorrowerLifecycleEvent(ctx, broadcaster, workspaceID, "borrower.restored", input.ID)

		return nil, nil
	}
}

// searchBorrowers searches borrowers by query string.
func searchBorrowers(svc ServiceInterface) func(context.Context, *SearchBorrowersInput) (*SearchBorrowersOutput, error) {
	return func(ctx context.Context, input *SearchBorrowersInput) (*SearchBorrowersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		borrowers, err := svc.Search(ctx, workspaceID, input.Query, input.Limit)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to search borrowers")
		}

		responses := make([]BorrowerResponse, len(borrowers))
		for i, b := range borrowers {
			responses[i] = toBorrowerResponse(b)
		}

		return &SearchBorrowersOutput{
			Body: BorrowerListResponse{
				Items: responses,
			},
		}, nil
	}
}

// publishBorrowerLifecycleEvent publishes a borrower lifecycle event (delete,
// archive, restore) carrying only the acting user's display name.
func publishBorrowerLifecycleEvent(ctx context.Context, broadcaster *events.Broadcaster, workspaceID uuid.UUID, eventType string, borrowerID uuid.UUID) {
	authUser, _ := appMiddleware.GetAuthUser(ctx)
	if broadcaster == nil || authUser == nil {
		return
	}
	userName := appMiddleware.GetUserDisplayName(ctx)
	broadcaster.Publish(workspaceID, events.Event{
		Type:       eventType,
		EntityID:   borrowerID.String(),
		EntityType: "borrower",
		UserID:     authUser.ID,
		Data: map[string]any{
			"user_name": userName,
		},
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
	Page     int  `query:"page" default:"1" minimum:"1"`
	Limit    int  `query:"limit" default:"50" minimum:"1" maximum:"100"`
	Archived bool `query:"archived" default:"false" doc:"When true, include archived borrowers in the list"`
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
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	Email       *string   `json:"email,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	Notes       *string   `json:"notes,omitempty"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SearchBorrowersInput struct {
	Query string `query:"q" minLength:"1" doc:"Search query"`
	Limit int    `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type SearchBorrowersOutput struct {
	Body BorrowerListResponse
}
