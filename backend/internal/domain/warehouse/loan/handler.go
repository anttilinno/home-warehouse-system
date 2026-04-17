package loan

import (
	"context"
	"log"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ===== Decoration types (plan 62-01 D-03/D-04) =====

// LoanEmbeddedItem is the item slice surfaced on every LoanResponse.
// Name is the human-readable label (joined from warehouse.items via
// inventory.item_id); PrimaryPhotoThumbnailURL is a nil-safe convenience for
// list-row thumbnails. ID is the canonical item ID (NOT the inventory ID).
type LoanEmbeddedItem struct {
	ID                       uuid.UUID `json:"id"`
	Name                     string    `json:"name"`
	PrimaryPhotoThumbnailURL *string   `json:"primary_photo_thumbnail_url,omitempty"`
}

// LoanEmbeddedBorrower is the borrower slice surfaced on every LoanResponse.
type LoanEmbeddedBorrower struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

// DecorationLookup abstracts the item + photo + borrower batch reads required
// for loan-response embedding. Keeping this interface in the loan package (not
// taking a direct dependency on item / itemphoto / borrower packages) avoids
// any potential import cycle and keeps the handler test surface small.
//
// All methods MUST scope reads by workspace_id — the loan-provided inventory_id
// and borrower_id must not be trusted as authorization signals (plan 62-01
// T-62-02 / T-62-05).
type DecorationLookup interface {
	// ItemsByInventoryIDs returns {inventoryID -> (itemID, itemName)} for the
	// given inventory rows. Missing rows are omitted from the map; callers
	// fall back to "" + inventory_id.
	ItemsByInventoryIDs(ctx context.Context, workspaceID uuid.UUID, inventoryIDs []uuid.UUID) (map[uuid.UUID]ItemLookupRow, error)
	// PrimaryPhotoThumbnailURLsByItemIDs returns {itemID -> thumbnailURL} for
	// items that have a primary photo. Missing or absent primaries leave the
	// map entry unset.
	PrimaryPhotoThumbnailURLsByItemIDs(ctx context.Context, workspaceID uuid.UUID, itemIDs []uuid.UUID) (map[uuid.UUID]string, error)
	// BorrowersByIDs returns {borrowerID -> name}; missing rows omitted.
	BorrowersByIDs(ctx context.Context, workspaceID uuid.UUID, borrowerIDs []uuid.UUID) (map[uuid.UUID]string, error)
}

// ItemLookupRow is the minimal shape returned by ItemsByInventoryIDs. Kept
// here so DecorationLookup implementers don't need to reach into the loan
// package for a struct definition.
type ItemLookupRow struct {
	ItemID   uuid.UUID
	ItemName string
}

// lookupLoanDecorations dedups IDs from the loan slice and issues exactly
// three batch reads (items by inventory_id, primary-photo URLs by item_id,
// borrowers by borrower_id). Returns empty maps on nil lookup or zero input
// (decoration degrades to zero-value embedding rather than erroring).
func lookupLoanDecorations(
	ctx context.Context,
	lookup DecorationLookup,
	workspaceID uuid.UUID,
	loans []*Loan,
) (map[uuid.UUID]LoanEmbeddedItem, map[uuid.UUID]LoanEmbeddedBorrower, error) {
	itemMap := map[uuid.UUID]LoanEmbeddedItem{}
	borrowerMap := map[uuid.UUID]LoanEmbeddedBorrower{}
	if lookup == nil || len(loans) == 0 {
		return itemMap, borrowerMap, nil
	}

	invIDs := make([]uuid.UUID, 0, len(loans))
	borIDs := make([]uuid.UUID, 0, len(loans))
	seenInv := map[uuid.UUID]struct{}{}
	seenBor := map[uuid.UUID]struct{}{}
	for _, l := range loans {
		if _, ok := seenInv[l.InventoryID()]; !ok {
			invIDs = append(invIDs, l.InventoryID())
			seenInv[l.InventoryID()] = struct{}{}
		}
		if _, ok := seenBor[l.BorrowerID()]; !ok {
			borIDs = append(borIDs, l.BorrowerID())
			seenBor[l.BorrowerID()] = struct{}{}
		}
	}

	itemsByInv, err := lookup.ItemsByInventoryIDs(ctx, workspaceID, invIDs)
	if err != nil {
		return nil, nil, err
	}

	// Collect unique item IDs from the inventory lookup for the primary-photo batch.
	itemIDs := make([]uuid.UUID, 0, len(itemsByInv))
	seenItem := map[uuid.UUID]struct{}{}
	for _, row := range itemsByInv {
		if _, ok := seenItem[row.ItemID]; !ok {
			itemIDs = append(itemIDs, row.ItemID)
			seenItem[row.ItemID] = struct{}{}
		}
	}

	thumbsByItem, err := lookup.PrimaryPhotoThumbnailURLsByItemIDs(ctx, workspaceID, itemIDs)
	if err != nil {
		// Thumbnails are decorative; degrade rather than error the list.
		log.Printf("loan decoration: primary-photo thumbnail batch failed for workspace %s: %v", workspaceID, err)
		thumbsByItem = map[uuid.UUID]string{}
	}

	borrowersByID, err := lookup.BorrowersByIDs(ctx, workspaceID, borIDs)
	if err != nil {
		return nil, nil, err
	}

	for invID, row := range itemsByInv {
		var thumb *string
		if url, ok := thumbsByItem[row.ItemID]; ok && url != "" {
			s := url
			thumb = &s
		}
		itemMap[invID] = LoanEmbeddedItem{
			ID:                       row.ItemID,
			Name:                     row.ItemName,
			PrimaryPhotoThumbnailURL: thumb,
		}
	}
	for id, name := range borrowersByID {
		borrowerMap[id] = LoanEmbeddedBorrower{ID: id, Name: name}
	}
	return itemMap, borrowerMap, nil
}

// decorateOneLoan builds the two decoration maps for a single loan and returns
// a fully-embedded LoanResponse.
func decorateOneLoan(ctx context.Context, lookup DecorationLookup, workspaceID uuid.UUID, l *Loan) (LoanResponse, error) {
	itemMap, borrowerMap, err := lookupLoanDecorations(ctx, lookup, workspaceID, []*Loan{l})
	if err != nil {
		return LoanResponse{}, err
	}
	return toLoanResponse(l, itemMap, borrowerMap), nil
}

// decorateLoans builds decoration maps ONCE for a slice of loans and returns
// parallel LoanResponse slice. Issues 3 SQL round-trips total regardless of
// list length (plan 62-01 T-62-08).
func decorateLoans(ctx context.Context, lookup DecorationLookup, workspaceID uuid.UUID, loans []*Loan) ([]LoanResponse, error) {
	itemMap, borrowerMap, err := lookupLoanDecorations(ctx, lookup, workspaceID, loans)
	if err != nil {
		return nil, err
	}
	out := make([]LoanResponse, len(loans))
	for i, l := range loans {
		out[i] = toLoanResponse(l, itemMap, borrowerMap)
	}
	return out, nil
}

// RegisterRoutes registers loan routes.
//
// lookup (DecorationLookup) is optional — when non-nil, every loan-returning
// handler embeds item + borrower decoration in the response (plan 62-01
// D-03/D-04). Pass nil to skip decoration (tests without photo integration).
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster, lookup DecorationLookup) {
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

		items, err := decorateLoans(ctx, lookup, workspaceID, loans)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loans")
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

		items, err := decorateLoans(ctx, lookup, workspaceID, loans)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loans")
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

		items, err := decorateLoans(ctx, lookup, workspaceID, loans)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loans")
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

		decorated, err := decorateOneLoan(ctx, lookup, workspaceID, loan)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loan")
		}

		return &GetLoanOutput{
			Body: decorated,
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

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "loan.created",
				EntityID:   loan.ID().String(),
				EntityType: "loan",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":          loan.ID(),
					"borrower_id": loan.BorrowerID(),
					"due_date":    loan.DueDate(),
					"user_name":   userName,
				},
			})
		}

		decorated, err := decorateOneLoan(ctx, lookup, workspaceID, loan)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loan")
		}

		return &CreateLoanOutput{
			Body: decorated,
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

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "loan.returned",
				EntityID:   input.ID.String(),
				EntityType: "loan",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		decorated, err := decorateOneLoan(ctx, lookup, workspaceID, loan)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loan")
		}

		return &ReturnLoanOutput{
			Body: decorated,
		}, nil
	})

	// Extend due date (legacy single-purpose endpoint; retained for back-compat
	// — the Phase 62 edit flow uses PATCH /loans/{id} instead, per D-01).
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

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "loan.updated",
				EntityID:   loan.ID().String(),
				EntityType: "loan",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        loan.ID(),
					"due_date":  loan.DueDate(),
					"user_name": userName,
				},
			})
		}

		decorated, err := decorateOneLoan(ctx, lookup, workspaceID, loan)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loan")
		}

		return &ExtendLoanOutput{
			Body: decorated,
		}, nil
	})

	// Update loan (due_date and/or notes) — supersedes /extend for the edit
	// flow per plan 62-01 D-01.
	huma.Patch(api, "/loans/{id}", func(ctx context.Context, input *UpdateLoanInput) (*UpdateLoanOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loan, err := svc.Update(ctx, input.ID, workspaceID, input.Body.DueDate, input.Body.Notes)
		if err != nil {
			if err == ErrLoanNotFound {
				return nil, huma.Error404NotFound("loan not found")
			}
			if err == ErrAlreadyReturned {
				return nil, huma.Error400BadRequest("cannot edit returned loan")
			}
			if err == ErrInvalidDueDate {
				return nil, huma.Error400BadRequest("due date must be after loaned date")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Publish SSE event
		authUser, _ := appMiddleware.GetAuthUser(ctx)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "loan.updated",
				EntityID:   loan.ID().String(),
				EntityType: "loan",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        loan.ID(),
					"due_date":  loan.DueDate(),
					"notes":     loan.Notes(),
					"user_name": userName,
				},
			})
		}

		decorated, err := decorateOneLoan(ctx, lookup, workspaceID, loan)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loan")
		}
		return &UpdateLoanOutput{Body: decorated}, nil
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

		items, err := decorateLoans(ctx, lookup, workspaceID, loans)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loans")
		}

		return &ListLoansOutput{
			Body: LoanListResponse{Items: items},
		}, nil
	})

	// List loans by item definition (joins through inventory)
	huma.Get(api, "/items/{item_id}/loans", func(ctx context.Context, input *ListItemLoansInput) (*ListLoansOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		loans, err := svc.ListByItem(ctx, workspaceID, input.ItemID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list loans")
		}

		items, err := decorateLoans(ctx, lookup, workspaceID, loans)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loans")
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

		items, err := decorateLoans(ctx, lookup, workspaceID, loans)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to decorate loans")
		}

		return &ListLoansOutput{
			Body: LoanListResponse{Items: items},
		}, nil
	})
}

// toLoanResponse populates a LoanResponse, filling in item + borrower
// decoration from the provided maps. Missing map entries fall back to
// zero-name embeddings rather than failing the request (T-62-05).
func toLoanResponse(
	l *Loan,
	itemMap map[uuid.UUID]LoanEmbeddedItem,
	borrowerMap map[uuid.UUID]LoanEmbeddedBorrower,
) LoanResponse {
	item, ok := itemMap[l.InventoryID()]
	if !ok {
		item = LoanEmbeddedItem{ID: l.InventoryID()}
	}
	borrower, ok := borrowerMap[l.BorrowerID()]
	if !ok {
		borrower = LoanEmbeddedBorrower{ID: l.BorrowerID()}
	}
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
		Item:        item,
		Borrower:    borrower,
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
		Notes       *string    `json:"notes,omitempty" maxLength:"1000"`
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

type UpdateLoanInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		DueDate *time.Time `json:"due_date,omitempty" doc:"New due date for the loan"`
		Notes   *string    `json:"notes,omitempty" doc:"Updated notes" maxLength:"1000"`
	}
}

type UpdateLoanOutput struct {
	Body LoanResponse
}

type ListBorrowerLoansInput struct {
	BorrowerID uuid.UUID `path:"borrower_id"`
	Page       int       `query:"page" default:"1" minimum:"1"`
	Limit      int       `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListItemLoansInput struct {
	ItemID uuid.UUID `path:"item_id"`
}

type ListInventoryLoansInput struct {
	InventoryID uuid.UUID `path:"inventory_id"`
}

type LoanResponse struct {
	ID          uuid.UUID            `json:"id"`
	WorkspaceID uuid.UUID            `json:"workspace_id"`
	InventoryID uuid.UUID            `json:"inventory_id"`
	BorrowerID  uuid.UUID            `json:"borrower_id"`
	Quantity    int                  `json:"quantity"`
	LoanedAt    time.Time            `json:"loaned_at"`
	DueDate     *time.Time           `json:"due_date,omitempty"`
	ReturnedAt  *time.Time           `json:"returned_at,omitempty"`
	Notes       *string              `json:"notes,omitempty"`
	IsActive    bool                 `json:"is_active" doc:"True if loan has not been returned"`
	IsOverdue   bool                 `json:"is_overdue" doc:"True if loan is past due date and not returned"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
	Item        LoanEmbeddedItem     `json:"item"`
	Borrower    LoanEmbeddedBorrower `json:"borrower"`
}
