package pendingchange

import (
	"context"
	"encoding/json"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
)

// ServiceInterface defines the interface for pending change operations
type ServiceInterface interface {
	ListPendingForWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*PendingChange, error)
	ApproveChange(ctx context.Context, changeID uuid.UUID, reviewerID uuid.UUID) error
	RejectChange(ctx context.Context, changeID uuid.UUID, reviewerID uuid.UUID, reason string) error
}

// RegisterRoutes registers pending change management routes
func RegisterRoutes(api huma.API, svc *Service, userRepo user.Repository) {
	// List all pending changes (owner/admin only)
	huma.Get(api, "/pending-changes", func(ctx context.Context, input *ListPendingChangesInput) (*ListPendingChangesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Check authorization (owner/admin only)
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		canReview, err := svc.canReviewChanges(ctx, authUser.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to check permissions")
		}
		if !canReview {
			return nil, huma.Error403Forbidden("only owners and admins can view all pending changes")
		}

		// Parse status filter if provided
		var statusFilter *Status
		if input.Status != "" {
			status, err := ParseStatus(input.Status)
			if err != nil {
				return nil, huma.Error400BadRequest("invalid status filter")
			}
			statusFilter = &status
		}

		// Fetch pending changes
		changes, err := svc.repo.FindByWorkspace(ctx, workspaceID, statusFilter)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list pending changes")
		}

		// Enrich with user details
		responses := make([]PendingChangeResponse, len(changes))
		for i, change := range changes {
			resp, err := toPendingChangeResponse(ctx, change, userRepo)
			if err != nil {
				return nil, huma.Error500InternalServerError("failed to fetch user details")
			}
			responses[i] = resp
		}

		return &ListPendingChangesOutput{
			Body: PendingChangeListResponse{
				Changes: responses,
				Total:   len(responses),
			},
		}, nil
	})

	// Get single pending change by ID
	huma.Get(api, "/pending-changes/{id}", func(ctx context.Context, input *GetPendingChangeInput) (*GetPendingChangeOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		// Fetch the pending change
		change, err := svc.repo.FindByID(ctx, input.ID)
		if err != nil {
			return nil, huma.Error404NotFound("pending change not found")
		}

		// Verify it belongs to the same workspace
		if change.WorkspaceID() != workspaceID {
			return nil, huma.Error404NotFound("pending change not found")
		}

		// Check authorization: either the requester or an owner/admin
		canReview, err := svc.canReviewChanges(ctx, authUser.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to check permissions")
		}
		isRequester := change.RequesterID() == authUser.ID

		if !canReview && !isRequester {
			return nil, huma.Error403Forbidden("you can only view your own pending changes or must be an owner/admin")
		}

		// Enrich with user details
		resp, err := toPendingChangeResponse(ctx, change, userRepo)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch user details")
		}

		return &GetPendingChangeOutput{
			Body: resp,
		}, nil
	})

	// List requester's own pending changes
	huma.Get(api, "/my-pending-changes", func(ctx context.Context, input *ListMyPendingChangesInput) (*ListPendingChangesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		// Parse status filter if provided
		var statusFilter *Status
		if input.Status != "" {
			status, err := ParseStatus(input.Status)
			if err != nil {
				return nil, huma.Error400BadRequest("invalid status filter")
			}
			statusFilter = &status
		}

		// Fetch requester's pending changes
		changes, err := svc.repo.FindByRequester(ctx, authUser.ID, statusFilter)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list pending changes")
		}

		// Filter by workspace
		filteredChanges := make([]*PendingChange, 0)
		for _, change := range changes {
			if change.WorkspaceID() == workspaceID {
				filteredChanges = append(filteredChanges, change)
			}
		}

		// Enrich with user details
		responses := make([]PendingChangeResponse, len(filteredChanges))
		for i, change := range filteredChanges {
			resp, err := toPendingChangeResponse(ctx, change, userRepo)
			if err != nil {
				return nil, huma.Error500InternalServerError("failed to fetch user details")
			}
			responses[i] = resp
		}

		return &ListPendingChangesOutput{
			Body: PendingChangeListResponse{
				Changes: responses,
				Total:   len(responses),
			},
		}, nil
	})

	// Approve pending change (owner/admin only)
	huma.Post(api, "/pending-changes/{id}/approve", func(ctx context.Context, input *ApprovePendingChangeInput) (*ApprovePendingChangeOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		// Check authorization (owner/admin only)
		canReview, err := svc.canReviewChanges(ctx, authUser.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to check permissions")
		}
		if !canReview {
			return nil, huma.Error403Forbidden("only owners and admins can approve changes")
		}

		// Verify the change belongs to this workspace
		change, err := svc.repo.FindByID(ctx, input.ID)
		if err != nil {
			return nil, huma.Error404NotFound("pending change not found")
		}
		if change.WorkspaceID() != workspaceID {
			return nil, huma.Error404NotFound("pending change not found")
		}

		// Approve the change
		if err := svc.ApproveChange(ctx, input.ID, authUser.ID); err != nil {
			if err == ErrChangeAlreadyReviewed {
				return nil, huma.Error400BadRequest("change has already been reviewed")
			}
			if err == ErrUnauthorized {
				return nil, huma.Error403Forbidden("insufficient permissions")
			}
			return nil, huma.Error500InternalServerError("failed to approve change")
		}

		// Fetch the updated change with applied entity details
		updatedChange, err := svc.repo.FindByID(ctx, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch updated change")
		}

		// Enrich with user details
		resp, err := toPendingChangeResponse(ctx, updatedChange, userRepo)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch user details")
		}

		return &ApprovePendingChangeOutput{
			Body: resp,
		}, nil
	})

	// Reject pending change (owner/admin only)
	huma.Post(api, "/pending-changes/{id}/reject", func(ctx context.Context, input *RejectPendingChangeInput) (*RejectPendingChangeOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		// Check authorization (owner/admin only)
		canReview, err := svc.canReviewChanges(ctx, authUser.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to check permissions")
		}
		if !canReview {
			return nil, huma.Error403Forbidden("only owners and admins can reject changes")
		}

		// Verify the change belongs to this workspace
		change, err := svc.repo.FindByID(ctx, input.ID)
		if err != nil {
			return nil, huma.Error404NotFound("pending change not found")
		}
		if change.WorkspaceID() != workspaceID {
			return nil, huma.Error404NotFound("pending change not found")
		}

		// Reject the change
		if err := svc.RejectChange(ctx, input.ID, authUser.ID, input.Body.Reason); err != nil {
			if err == ErrChangeAlreadyReviewed {
				return nil, huma.Error400BadRequest("change has already been reviewed")
			}
			if err == ErrUnauthorized {
				return nil, huma.Error403Forbidden("insufficient permissions")
			}
			return nil, huma.Error500InternalServerError("failed to reject change")
		}

		// Fetch the updated change
		updatedChange, err := svc.repo.FindByID(ctx, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch updated change")
		}

		// Enrich with user details
		resp, err := toPendingChangeResponse(ctx, updatedChange, userRepo)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch user details")
		}

		return &RejectPendingChangeOutput{
			Body: resp,
		}, nil
	})
}

// Helper function to convert PendingChange to response with user details
func toPendingChangeResponse(ctx context.Context, change *PendingChange, userRepo user.Repository) (PendingChangeResponse, error) {
	// Fetch requester details
	requester, err := userRepo.FindByID(ctx, change.RequesterID())
	if err != nil {
		return PendingChangeResponse{}, err
	}

	// Fetch reviewer details if available
	var reviewerName *string
	var reviewerEmail *string
	if change.ReviewedBy() != nil {
		reviewer, err := userRepo.FindByID(ctx, *change.ReviewedBy())
		if err == nil {
			name := reviewer.FullName()
			email := reviewer.Email()
			reviewerName = &name
			reviewerEmail = &email
		}
	}

	return PendingChangeResponse{
		ID:              change.ID(),
		WorkspaceID:     change.WorkspaceID(),
		RequesterID:     change.RequesterID(),
		RequesterName:   requester.FullName(),
		RequesterEmail:  requester.Email(),
		EntityType:      change.EntityType(),
		EntityID:        change.EntityID(),
		Action:          string(change.Action()),
		Payload:         change.Payload(),
		Status:          string(change.Status()),
		ReviewedBy:      change.ReviewedBy(),
		ReviewerName:    reviewerName,
		ReviewerEmail:   reviewerEmail,
		ReviewedAt:      change.ReviewedAt(),
		RejectionReason: change.RejectionReason(),
		CreatedAt:       change.CreatedAt(),
		UpdatedAt:       change.UpdatedAt(),
	}, nil
}

// Request/Response types

type ListPendingChangesInput struct {
	Status     string `query:"status" enum:"pending,approved,rejected" doc:"Filter by status (pending/approved/rejected)"`
	EntityType string `query:"entity_type" doc:"Filter by entity type (item/category/location/etc)"`
}

type ListPendingChangesOutput struct {
	Body PendingChangeListResponse
}

type PendingChangeListResponse struct {
	Changes []PendingChangeResponse `json:"changes"`
	Total   int                     `json:"total"`
}

type GetPendingChangeInput struct {
	ID uuid.UUID `path:"id" doc:"Pending change ID"`
}

type GetPendingChangeOutput struct {
	Body PendingChangeResponse
}

type ListMyPendingChangesInput struct {
	Status string `query:"status" enum:"pending,approved,rejected" doc:"Filter by status (pending/approved/rejected)"`
}

type ApprovePendingChangeInput struct {
	ID uuid.UUID `path:"id" doc:"Pending change ID"`
}

type ApprovePendingChangeOutput struct {
	Body PendingChangeResponse
}

type RejectPendingChangeInput struct {
	ID   uuid.UUID `path:"id" doc:"Pending change ID"`
	Body struct {
		Reason string `json:"reason" minLength:"1" doc:"Reason for rejection"`
	}
}

type RejectPendingChangeOutput struct {
	Body PendingChangeResponse
}

type PendingChangeResponse struct {
	ID              uuid.UUID       `json:"id"`
	WorkspaceID     uuid.UUID       `json:"workspace_id"`
	RequesterID     uuid.UUID       `json:"requester_id"`
	RequesterName   string          `json:"requester_name" doc:"Full name of the requester"`
	RequesterEmail  string          `json:"requester_email" doc:"Email of the requester"`
	EntityType      string          `json:"entity_type" doc:"Type of entity being changed (item/category/location/etc)"`
	EntityID        *uuid.UUID      `json:"entity_id,omitempty" doc:"ID of the entity (null for create operations)"`
	Action          string          `json:"action" enum:"create,update,delete" doc:"Type of change requested"`
	Payload         json.RawMessage `json:"payload" doc:"JSON payload of the requested change"`
	Status          string          `json:"status" enum:"pending,approved,rejected" doc:"Current status of the change"`
	ReviewedBy      *uuid.UUID      `json:"reviewed_by,omitempty" doc:"ID of the reviewer (owner/admin)"`
	ReviewerName    *string         `json:"reviewer_name,omitempty" doc:"Full name of the reviewer"`
	ReviewerEmail   *string         `json:"reviewer_email,omitempty" doc:"Email of the reviewer"`
	ReviewedAt      *time.Time      `json:"reviewed_at,omitempty" doc:"When the change was reviewed"`
	RejectionReason *string         `json:"rejection_reason,omitempty" doc:"Reason for rejection (if rejected)"`
	CreatedAt       time.Time       `json:"created_at" doc:"When the change was requested"`
	UpdatedAt       time.Time       `json:"updated_at" doc:"When the change was last updated"`
}
