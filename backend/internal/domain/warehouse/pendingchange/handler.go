package pendingchange

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
)

const (
	msgWorkspaceContextRequired = "workspace context required"
	msgAuthenticationRequired   = "authentication required"
	msgFailedCheckPermissions   = "failed to check permissions"
	msgFailedFetchUserDetails   = "failed to fetch user details"
	msgPendingChangeNotFound    = "pending change not found"
)

// ServiceInterface defines the interface for pending change operations
type ServiceInterface interface {
	ListPendingForWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*PendingChange, error)
	ApproveChange(ctx context.Context, changeID, workspaceID uuid.UUID, reviewerID uuid.UUID) error
	RejectChange(ctx context.Context, changeID, workspaceID uuid.UUID, reviewerID uuid.UUID, reason string) error
}

// RegisterRoutes registers pending change management routes
func RegisterRoutes(api huma.API, svc *Service, userRepo user.Repository) {
	huma.Get(api, "/pending-changes", listPendingChanges(svc, userRepo))
	huma.Get(api, "/pending-changes/{id}", getPendingChange(svc, userRepo))
	huma.Get(api, "/my-pending-changes", listMyPendingChanges(svc, userRepo))
	huma.Post(api, "/pending-changes/{id}/approve", approvePendingChange(svc, userRepo))
	huma.Post(api, "/pending-changes/{id}/reject", rejectPendingChange(svc, userRepo))
}

// requireWorkspaceAndUser resolves the workspace and authenticated user from
// the request context, returning the matching huma error when either is
// absent. Centralizes the two guards every pending-change handler runs first.
func requireWorkspaceAndUser(ctx context.Context) (uuid.UUID, *appMiddleware.AuthUser, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return uuid.Nil, nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
	}
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return uuid.Nil, nil, huma.Error401Unauthorized(msgAuthenticationRequired)
	}
	return workspaceID, authUser, nil
}

// parseStatusFilter resolves the optional status query param into a *Status,
// returning a 400 huma error for an unparseable value and (nil, nil) when the
// filter is omitted.
func parseStatusFilter(raw string) (*Status, error) {
	if raw == "" {
		return nil, nil
	}
	status, err := ParseStatus(raw)
	if err != nil {
		return nil, huma.Error400BadRequest("invalid status filter")
	}
	return &status, nil
}

// enrichChanges converts a change slice into the list response envelope using
// a memoized user lookup (collapsing the per-change requester/reviewer fetches
// into one query per distinct user in the page).
func enrichChanges(ctx context.Context, userRepo user.Repository, changes []*PendingChange) (*ListPendingChangesOutput, error) {
	users := newUserLookup(userRepo)
	responses := make([]PendingChangeResponse, len(changes))
	for i, change := range changes {
		resp, err := toPendingChangeResponse(ctx, change, users.find)
		if err != nil {
			return nil, huma.Error500InternalServerError(msgFailedFetchUserDetails)
		}
		responses[i] = resp
	}
	return &ListPendingChangesOutput{
		Body: PendingChangeListResponse{
			Changes: responses,
			Total:   len(responses),
		},
	}, nil
}

// listPendingChanges returns the handler for GET /pending-changes (owner/admin only).
func listPendingChanges(svc *Service, userRepo user.Repository) func(context.Context, *ListPendingChangesInput) (*ListPendingChangesOutput, error) {
	return func(ctx context.Context, input *ListPendingChangesInput) (*ListPendingChangesOutput, error) {
		workspaceID, authUser, err := requireWorkspaceAndUser(ctx)
		if err != nil {
			return nil, err
		}

		// Check authorization (owner/admin only)
		canReview, err := svc.canReviewChanges(ctx, authUser.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError(msgFailedCheckPermissions)
		}
		if !canReview {
			return nil, huma.Error403Forbidden("only owners and admins can view all pending changes")
		}

		statusFilter, err := parseStatusFilter(input.Status)
		if err != nil {
			return nil, err
		}

		// Fetch pending changes
		changes, err := svc.repo.FindByWorkspace(ctx, workspaceID, statusFilter)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list pending changes")
		}

		return enrichChanges(ctx, userRepo, changes)
	}
}

// getPendingChange returns the handler for GET /pending-changes/{id}.
func getPendingChange(svc *Service, userRepo user.Repository) func(context.Context, *GetPendingChangeInput) (*GetPendingChangeOutput, error) {
	return func(ctx context.Context, input *GetPendingChangeInput) (*GetPendingChangeOutput, error) {
		workspaceID, authUser, err := requireWorkspaceAndUser(ctx)
		if err != nil {
			return nil, err
		}

		// Fetch the pending change
		change, err := svc.repo.FindByID(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error404NotFound(msgPendingChangeNotFound)
		}

		// Verify it belongs to the same workspace
		if change.WorkspaceID() != workspaceID {
			return nil, huma.Error404NotFound(msgPendingChangeNotFound)
		}

		// Check authorization: either the requester or an owner/admin
		canReview, err := svc.canReviewChanges(ctx, authUser.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError(msgFailedCheckPermissions)
		}
		isRequester := change.RequesterID() == authUser.ID

		if !canReview && !isRequester {
			return nil, huma.Error403Forbidden("you can only view your own pending changes or must be an owner/admin")
		}

		// Enrich with user details
		resp, err := toPendingChangeResponse(ctx, change, userRepo.FindByID)
		if err != nil {
			return nil, huma.Error500InternalServerError(msgFailedFetchUserDetails)
		}

		return &GetPendingChangeOutput{
			Body: resp,
		}, nil
	}
}

// listMyPendingChanges returns the handler for GET /my-pending-changes.
func listMyPendingChanges(svc *Service, userRepo user.Repository) func(context.Context, *ListMyPendingChangesInput) (*ListPendingChangesOutput, error) {
	return func(ctx context.Context, input *ListMyPendingChangesInput) (*ListPendingChangesOutput, error) {
		workspaceID, authUser, err := requireWorkspaceAndUser(ctx)
		if err != nil {
			return nil, err
		}

		statusFilter, err := parseStatusFilter(input.Status)
		if err != nil {
			return nil, err
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

		return enrichChanges(ctx, userRepo, filteredChanges)
	}
}

// requireReviewableChange enforces the owner/admin guard and confirms the
// change exists within the workspace, returning the matching huma error
// otherwise. Shared by the approve and reject handlers.
func requireReviewableChange(ctx context.Context, svc *Service, changeID, workspaceID uuid.UUID, authUserID uuid.UUID, forbiddenMsg string) error {
	canReview, err := svc.canReviewChanges(ctx, authUserID, workspaceID)
	if err != nil {
		return huma.Error500InternalServerError(msgFailedCheckPermissions)
	}
	if !canReview {
		return huma.Error403Forbidden(forbiddenMsg)
	}

	change, err := svc.repo.FindByID(ctx, changeID, workspaceID)
	if err != nil {
		return huma.Error404NotFound(msgPendingChangeNotFound)
	}
	if change.WorkspaceID() != workspaceID {
		return huma.Error404NotFound(msgPendingChangeNotFound)
	}
	return nil
}

// fetchUpdatedChangeResponse re-reads a change after a review action and
// enriches it with user details for the response body.
func fetchUpdatedChangeResponse(ctx context.Context, svc *Service, userRepo user.Repository, changeID, workspaceID uuid.UUID) (PendingChangeResponse, error) {
	updatedChange, err := svc.repo.FindByID(ctx, changeID, workspaceID)
	if err != nil {
		return PendingChangeResponse{}, huma.Error500InternalServerError("failed to fetch updated change")
	}
	resp, err := toPendingChangeResponse(ctx, updatedChange, userRepo.FindByID)
	if err != nil {
		return PendingChangeResponse{}, huma.Error500InternalServerError(msgFailedFetchUserDetails)
	}
	return resp, nil
}

// mapReviewActionError maps the shared approve/reject service errors to their
// huma responses, falling back to the supplied 500 message otherwise.
func mapReviewActionError(err error, fallbackMsg string) error {
	if errors.Is(err, ErrChangeAlreadyReviewed) {
		return huma.Error400BadRequest("change has already been reviewed")
	}
	if errors.Is(err, ErrUnauthorized) {
		return huma.Error403Forbidden("insufficient permissions")
	}
	return huma.Error500InternalServerError(fallbackMsg)
}

// approvePendingChange returns the handler for POST /pending-changes/{id}/approve (owner/admin only).
func approvePendingChange(svc *Service, userRepo user.Repository) func(context.Context, *ApprovePendingChangeInput) (*ApprovePendingChangeOutput, error) {
	return func(ctx context.Context, input *ApprovePendingChangeInput) (*ApprovePendingChangeOutput, error) {
		workspaceID, authUser, err := requireWorkspaceAndUser(ctx)
		if err != nil {
			return nil, err
		}

		if err := requireReviewableChange(ctx, svc, input.ID, workspaceID, authUser.ID, "only owners and admins can approve changes"); err != nil {
			return nil, err
		}

		// Approve the change
		if err := svc.ApproveChange(ctx, input.ID, workspaceID, authUser.ID); err != nil {
			return nil, mapReviewActionError(err, "failed to approve change")
		}

		// Fetch the updated change with applied entity details
		resp, err := fetchUpdatedChangeResponse(ctx, svc, userRepo, input.ID, workspaceID)
		if err != nil {
			return nil, err
		}

		return &ApprovePendingChangeOutput{
			Body: resp,
		}, nil
	}
}

// rejectPendingChange returns the handler for POST /pending-changes/{id}/reject (owner/admin only).
func rejectPendingChange(svc *Service, userRepo user.Repository) func(context.Context, *RejectPendingChangeInput) (*RejectPendingChangeOutput, error) {
	return func(ctx context.Context, input *RejectPendingChangeInput) (*RejectPendingChangeOutput, error) {
		workspaceID, authUser, err := requireWorkspaceAndUser(ctx)
		if err != nil {
			return nil, err
		}

		if err := requireReviewableChange(ctx, svc, input.ID, workspaceID, authUser.ID, "only owners and admins can reject changes"); err != nil {
			return nil, err
		}

		// Reject the change
		if err := svc.RejectChange(ctx, input.ID, workspaceID, authUser.ID, input.Body.Reason); err != nil {
			return nil, mapReviewActionError(err, "failed to reject change")
		}

		// Fetch the updated change
		resp, err := fetchUpdatedChangeResponse(ctx, svc, userRepo, input.ID, workspaceID)
		if err != nil {
			return nil, err
		}

		return &RejectPendingChangeOutput{
			Body: resp,
		}, nil
	}
}

// userLookup memoizes user fetches within a single request so list
// endpoints don't re-query the same requester/reviewer for every change.
// (A true single-round-trip batch would need a users-by-IDs sqlc query; at
// the typical workspace member count the memoized form is equivalent.)
type userLookup struct {
	repo  user.Repository
	cache map[uuid.UUID]*user.User
}

func newUserLookup(repo user.Repository) *userLookup {
	return &userLookup{repo: repo, cache: make(map[uuid.UUID]*user.User)}
}

func (l *userLookup) find(ctx context.Context, id uuid.UUID) (*user.User, error) {
	if u, ok := l.cache[id]; ok {
		return u, nil
	}
	u, err := l.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	l.cache[id] = u
	return u, nil
}

// Helper function to convert PendingChange to response with user details.
// findUser is either userRepo.FindByID (single-change paths) or a memoized
// userLookup.find (list paths).
func toPendingChangeResponse(ctx context.Context, change *PendingChange, findUser func(context.Context, uuid.UUID) (*user.User, error)) (PendingChangeResponse, error) {
	// Fetch requester details
	requester, err := findUser(ctx, change.RequesterID())
	if err != nil {
		return PendingChangeResponse{}, err
	}

	// Fetch reviewer details if available
	var reviewerName *string
	var reviewerEmail *string
	if change.ReviewedBy() != nil {
		reviewer, err := findUser(ctx, *change.ReviewedBy())
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
