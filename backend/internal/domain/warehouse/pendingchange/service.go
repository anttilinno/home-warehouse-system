package pendingchange

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/maintenance"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/wishlist"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/webpush"
)

const (
	msgEntityIDRequiredForUpdateAction = "entity_id is required for update action"
	msgFailedToUnmarshalUpdatePayload  = "failed to unmarshal update payload: %w"
	msgEntityIDRequiredForDeleteAction = "entity_id is required for delete action"
	msgUnsupportedAction               = "unsupported action: %s"
)

// Transactor runs a function inside a single database transaction. It is a port
// implemented by infra/postgres.TxManager. Defining it here (rather than importing
// the infra package directly) keeps the domain free of infrastructure imports —
// the same convention used throughout this codebase. The function receives a
// context carrying the active transaction; repositories detect it via the
// infra layer and route their writes through the transaction automatically.
type Transactor interface {
	WithTx(ctx context.Context, fn func(context.Context) error) error
}

// noopTransactor executes the function without a surrounding transaction. It is
// used as a safe fallback when no Transactor is wired (e.g. in unit tests that
// mock repositories), preserving the previous non-transactional behaviour.
type noopTransactor struct{}

func (noopTransactor) WithTx(ctx context.Context, fn func(context.Context) error) error {
	return fn(ctx)
}

// Service handles business logic for pending changes in the approval pipeline.
// It coordinates between the pending change repository, the per-entity domain
// services, and the SSE broadcaster to manage the complete approval workflow.
//
// Approved create/update changes are applied through the same domain services
// that handle direct (admin) writes. This guarantees full payload fidelity
// (every field the member submitted is applied through the canonical
// create/update path) and reuses each domain's validation, uniqueness checks,
// and short-code generation.
//
// inventory and loan have no service-level Delete (the inventory/loan domains
// expose archive/return semantics instead), so their delete path goes through the
// repository directly. Delete carries no payload, so this does not affect payload
// fidelity.
type Service struct {
	repo           Repository
	memberRepo     member.Repository
	userRepo       user.Repository
	itemSvc        item.ServiceInterface
	categorySvc    category.ServiceInterface
	locationSvc    location.ServiceInterface
	containerSvc   container.ServiceInterface
	inventorySvc   inventory.ServiceInterface
	inventoryRepo  inventory.Repository
	borrowerSvc    borrower.ServiceInterface
	loanSvc        loan.ServiceInterface
	loanRepo       loan.Repository
	labelSvc       label.ServiceInterface
	maintenanceSvc maintenance.ServiceInterface
	wishlistSvc    wishlist.ServiceInterface
	tx             Transactor
	broadcaster    *events.Broadcaster
	pushSender     *webpush.Sender
}

// NewService creates a new pending change service with all required dependencies.
// The service requires the domain services for every supported entity type so
// approved changes are applied through the canonical create/update paths. The
// inventory and loan repositories are required for their delete paths (those
// domains expose no service-level Delete).
//
// tx is the transaction port (see Transactor). If nil, approvals fall back to the
// previous non-transactional behaviour — callers that need atomic, idempotent
// approval (the production wiring) must supply a real Transactor.
func NewService(
	repo Repository,
	memberRepo member.Repository,
	userRepo user.Repository,
	itemSvc item.ServiceInterface,
	categorySvc category.ServiceInterface,
	locationSvc location.ServiceInterface,
	containerSvc container.ServiceInterface,
	inventorySvc inventory.ServiceInterface,
	inventoryRepo inventory.Repository,
	borrowerSvc borrower.ServiceInterface,
	loanSvc loan.ServiceInterface,
	loanRepo loan.Repository,
	labelSvc label.ServiceInterface,
	maintenanceSvc maintenance.ServiceInterface,
	wishlistSvc wishlist.ServiceInterface,
	tx Transactor,
	broadcaster *events.Broadcaster,
) *Service {
	if tx == nil {
		tx = noopTransactor{}
	}
	return &Service{
		repo:           repo,
		memberRepo:     memberRepo,
		userRepo:       userRepo,
		itemSvc:        itemSvc,
		categorySvc:    categorySvc,
		locationSvc:    locationSvc,
		containerSvc:   containerSvc,
		inventorySvc:   inventorySvc,
		inventoryRepo:  inventoryRepo,
		borrowerSvc:    borrowerSvc,
		loanSvc:        loanSvc,
		loanRepo:       loanRepo,
		labelSvc:       labelSvc,
		maintenanceSvc: maintenanceSvc,
		wishlistSvc:    wishlistSvc,
		tx:             tx,
		broadcaster:    broadcaster,
	}
}

// SetPushSender sets the push notification sender (optional).
func (s *Service) SetPushSender(sender *webpush.Sender) {
	s.pushSender = sender
}

// CreatePendingChange creates a new pending change request and stores it in the queue.
// This is called by the approval middleware when a member attempts to create, update, or delete an entity.
// The change is validated, stored in the database, and an SSE event is published to notify admins.
//
// Returns the created PendingChange entity or an error if validation/storage fails.
func (s *Service) CreatePendingChange(
	ctx context.Context,
	workspaceID uuid.UUID,
	requesterID uuid.UUID,
	entityType string,
	entityID *uuid.UUID,
	action Action,
	payload json.RawMessage,
) (*PendingChange, error) {
	// Validate that the entity type is supported
	if !s.isValidEntityType(entityType) {
		return nil, ErrInvalidEntityType
	}

	// Create the pending change entity
	change, err := NewPendingChange(workspaceID, requesterID, entityType, entityID, action, payload)
	if err != nil {
		return nil, fmt.Errorf("failed to create pending change: %w", err)
	}

	// Save to repository
	if err := s.repo.Save(ctx, change); err != nil {
		return nil, fmt.Errorf("failed to save pending change: %w", err)
	}

	// Publish SSE event for pending change creation
	if s.broadcaster != nil {
		// Get requester user info
		var requesterName, requesterEmail string
		if requesterUser, err := s.userRepo.FindByID(ctx, requesterID); err == nil {
			requesterName = requesterUser.FullName()
			requesterEmail = requesterUser.Email()
		}

		s.broadcaster.Publish(workspaceID, events.Event{
			Type:       "pendingchange.created",
			EntityID:   change.ID().String(),
			EntityType: "pendingchange",
			UserID:     requesterID,
			Data: map[string]any{
				"id":              change.ID().String(),
				"entity_type":     change.EntityType(),
				"entity_id":       change.EntityID(),
				"action":          string(change.Action()),
				"requester_id":    requesterID.String(),
				"requester_name":  requesterName,
				"requester_email": requesterEmail,
				"status":          string(change.Status()),
			},
		})
	}

	return change, nil
}

// ApproveChange approves a pending change and applies it to the database.
// This operation:
//  1. Verifies the reviewer has admin/owner permissions
//  2. Inside a single transaction: re-fetches the change, verifies it is still
//     pending (idempotency guard), marks it approved, applies the entity mutation,
//     and persists the approved change — all atomically (all-or-nothing).
//  3. Publishes an SSE event to notify the requester and other workspace members
//
// Because the steps in (2) share one transaction, a failure to persist the
// approved change rolls back the entity mutation, so a retried approval cannot
// duplicate the apply. The in-transaction pending re-check makes a
// duplicate/retried approval a no-op rather than a second apply.
//
// Returns an error if the reviewer lacks permissions, the change doesn't exist,
// has already been reviewed, or the change cannot be applied.
func (s *Service) ApproveChange(ctx context.Context, changeID, workspaceID uuid.UUID, reviewerID uuid.UUID) error {
	// Fetch the pending change (outside the tx) for the permission check.
	// Workspace-scoped lookup (audit A3): a change ID from another workspace
	// resolves to not-found instead of being reviewable cross-tenant.
	change, err := s.repo.FindByID(ctx, changeID, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to fetch pending change: %w", err)
	}

	// Verify reviewer has permission (owner or admin)
	canReview, err := s.canReviewChanges(ctx, reviewerID, change.WorkspaceID())
	if err != nil {
		return fmt.Errorf("failed to check reviewer permissions: %w", err)
	}
	if !canReview {
		return ErrUnauthorized
	}

	// alreadyReviewed is set when the in-tx re-check finds the change is no longer
	// pending. In that case we short-circuit without re-applying (idempotency) and
	// skip the SSE/push side effects, since they were already emitted by the
	// approval that won the race.
	alreadyReviewed := false

	// Approve + apply + save atomically. Re-fetch inside the transaction so the
	// pending re-check reads the persisted status, not the in-memory copy fetched
	// above.
	err = s.tx.WithTx(ctx, func(ctx context.Context) error {
		current, err := s.repo.FindByID(ctx, changeID, workspaceID)
		if err != nil {
			return fmt.Errorf("failed to re-fetch pending change: %w", err)
		}

		// Idempotency guard: a non-pending change short-circuits without re-applying.
		if current.Status() != StatusPending {
			alreadyReviewed = true
			return nil
		}

		// Approve the change (updates status to approved).
		if err := current.Approve(reviewerID); err != nil {
			return fmt.Errorf("failed to approve change: %w", err)
		}

		// Apply the change to the actual entity through the domain service.
		if err := s.applyChange(ctx, current); err != nil {
			return fmt.Errorf("failed to apply change: %w", err)
		}

		// Persist the approved change.
		if err := s.repo.Save(ctx, current); err != nil {
			return fmt.Errorf("failed to save approved change: %w", err)
		}

		// Keep the outer reference in sync for the SSE payload below.
		change = current
		return nil
	})
	if err != nil {
		return err
	}

	// Duplicate/retried approval: nothing more to do.
	if alreadyReviewed {
		return nil
	}

	s.notifyApproval(ctx, change, reviewerID)
	return nil
}

// notifyApproval emits the SSE event and a best-effort push notification for an
// approved change. Requester/reviewer display fields are looked up best-effort
// and left blank on error.
func (s *Service) notifyApproval(ctx context.Context, change *PendingChange, reviewerID uuid.UUID) {
	var requesterName, requesterEmail, reviewerName, reviewerEmail string
	if requesterUser, err := s.userRepo.FindByID(ctx, change.RequesterID()); err == nil {
		requesterName = requesterUser.FullName()
		requesterEmail = requesterUser.Email()
	}
	if reviewerUser, err := s.userRepo.FindByID(ctx, reviewerID); err == nil {
		reviewerName = reviewerUser.FullName()
		reviewerEmail = reviewerUser.Email()
	}

	// Publish SSE event for approval
	if s.broadcaster != nil {
		s.broadcaster.Publish(change.WorkspaceID(), events.Event{
			Type:       "pendingchange.approved",
			EntityID:   change.ID().String(),
			EntityType: "pendingchange",
			UserID:     reviewerID,
			Data: map[string]any{
				"id":              change.ID().String(),
				"entity_type":     change.EntityType(),
				"entity_id":       change.EntityID(),
				"action":          string(change.Action()),
				"requester_id":    change.RequesterID().String(),
				"requester_name":  requesterName,
				"requester_email": requesterEmail,
				"reviewer_id":     reviewerID.String(),
				"reviewer_name":   reviewerName,
				"reviewer_email":  reviewerEmail,
				"status":          string(change.Status()),
			},
		})
	}

	// Send push notification to the requester
	if s.pushSender != nil && s.pushSender.IsEnabled() {
		message := webpush.PushMessage{
			Title: "Change Approved",
			Body:  fmt.Sprintf("Your %s %s has been approved by %s", change.EntityType(), change.Action(), reviewerName),
			Icon:  "/icon-192.png",
			Badge: "/favicon-32x32.png",
			Tag:   "change-approved",
			URL:   "/dashboard/my-changes",
			Data: map[string]interface{}{
				"type":        "pending_change_approved",
				"change_id":   change.ID().String(),
				"entity_type": change.EntityType(),
				"action":      string(change.Action()),
			},
		}
		if err := s.pushSender.SendToUser(ctx, change.RequesterID(), message); err != nil {
			log.Printf("Failed to send push notification for approved change %s: %v", change.ID(), err)
		}
	}
}

// RejectChange rejects a pending change with a descriptive reason.
// This operation:
//  1. Verifies the reviewer has admin/owner permissions
//  2. Marks the change as rejected with the provided reason
//  3. Publishes an SSE event to notify the requester
//
// The rejection reason should be clear and actionable so the member understands why their change was declined.
// Returns an error if the reviewer lacks permissions, the change doesn't exist, has already been reviewed,
// or the reason is empty.
func (s *Service) RejectChange(ctx context.Context, changeID, workspaceID uuid.UUID, reviewerID uuid.UUID, reason string) error {
	// Fetch the pending change (workspace-scoped, audit A3)
	change, err := s.repo.FindByID(ctx, changeID, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to fetch pending change: %w", err)
	}

	// Verify reviewer has permission (owner or admin)
	canReview, err := s.canReviewChanges(ctx, reviewerID, change.WorkspaceID())
	if err != nil {
		return fmt.Errorf("failed to check reviewer permissions: %w", err)
	}
	if !canReview {
		return ErrUnauthorized
	}

	// Get requester and reviewer info for SSE event
	var requesterName, requesterEmail, reviewerName, reviewerEmail string
	if requesterUser, err := s.userRepo.FindByID(ctx, change.RequesterID()); err == nil {
		requesterName = requesterUser.FullName()
		requesterEmail = requesterUser.Email()
	}
	if reviewerUser, err := s.userRepo.FindByID(ctx, reviewerID); err == nil {
		reviewerName = reviewerUser.FullName()
		reviewerEmail = reviewerUser.Email()
	}

	// Reject the change
	if err := change.Reject(reviewerID, reason); err != nil {
		return fmt.Errorf("failed to reject change: %w", err)
	}

	// Save the rejected change
	if err := s.repo.Save(ctx, change); err != nil {
		return fmt.Errorf("failed to save rejected change: %w", err)
	}

	// Publish SSE event for rejection
	if s.broadcaster != nil {
		s.broadcaster.Publish(change.WorkspaceID(), events.Event{
			Type:       "pendingchange.rejected",
			EntityID:   change.ID().String(),
			EntityType: "pendingchange",
			UserID:     reviewerID,
			Data: map[string]any{
				"id":               change.ID().String(),
				"entity_type":      change.EntityType(),
				"entity_id":        change.EntityID(),
				"action":           string(change.Action()),
				"requester_id":     change.RequesterID().String(),
				"requester_name":   requesterName,
				"requester_email":  requesterEmail,
				"reviewer_id":      reviewerID.String(),
				"reviewer_name":    reviewerName,
				"reviewer_email":   reviewerEmail,
				"rejection_reason": reason,
				"status":           string(change.Status()),
			},
		})
	}

	// Send push notification to the requester
	if s.pushSender != nil && s.pushSender.IsEnabled() {
		message := webpush.PushMessage{
			Title: "Change Rejected",
			Body:  fmt.Sprintf("Your %s %s has been rejected by %s: %s", change.EntityType(), change.Action(), reviewerName, reason),
			Icon:  "/icon-192.png",
			Badge: "/favicon-32x32.png",
			Tag:   "change-rejected",
			URL:   "/dashboard/my-changes",
			Data: map[string]interface{}{
				"type":        "pending_change_rejected",
				"change_id":   change.ID().String(),
				"entity_type": change.EntityType(),
				"action":      string(change.Action()),
				"reason":      reason,
			},
		}
		if err := s.pushSender.SendToUser(ctx, change.RequesterID(), message); err != nil {
			log.Printf("Failed to send push notification for rejected change %s: %v", change.ID(), err)
		}
	}

	return nil
}

// ListPendingForWorkspace retrieves all pending (not yet reviewed) changes for a workspace.
// This is used to populate the approval queue for admins/owners.
// Returns a list of changes awaiting review or an error if the query fails.
func (s *Service) ListPendingForWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*PendingChange, error) {
	status := StatusPending
	changes, err := s.repo.FindByWorkspace(ctx, workspaceID, &status)
	if err != nil {
		return nil, fmt.Errorf("failed to list pending changes: %w", err)
	}
	return changes, nil
}

// canReviewChanges checks if a user has permission to review changes (owner or admin role)
func (s *Service) canReviewChanges(ctx context.Context, userID uuid.UUID, workspaceID uuid.UUID) (bool, error) {
	m, err := s.memberRepo.FindByWorkspaceAndUser(ctx, workspaceID, userID)
	if err != nil {
		return false, err
	}

	// Only owners and admins can review changes
	return m.CanManageMembers(), nil
}

// isValidEntityType checks if the entity type is supported.
//
// This set must stay in sync with the approval middleware's extractEntityType
// (internal/api/middleware/approval_middleware.go). Entity types not listed here
// are deliberately NOT routed through the approval pipeline — see
// docs/APPROVAL_PIPELINE.md ("Entity coverage and deliberate exclusions") for the
// rationale on which member-mutable resources are gated and which are applied
// atomically with their parent and therefore intentionally excluded.
func (s *Service) isValidEntityType(entityType string) bool {
	validTypes := map[string]bool{
		"item":        true,
		"category":    true,
		"location":    true,
		"container":   true,
		"inventory":   true,
		"borrower":    true,
		"loan":        true,
		"label":       true,
		"maintenance": true,
		"wishlist":    true,
	}
	return validTypes[entityType]
}

// applyChange applies the approved change to the actual entity through the
// canonical domain service for its type.
func (s *Service) applyChange(ctx context.Context, change *PendingChange) error {
	switch change.EntityType() {
	case "item":
		return s.applyItemChange(ctx, change)
	case "category":
		return s.applyCategoryChange(ctx, change)
	case "location":
		return s.applyLocationChange(ctx, change)
	case "container":
		return s.applyContainerChange(ctx, change)
	case "inventory":
		return s.applyInventoryChange(ctx, change)
	case "borrower":
		return s.applyBorrowerChange(ctx, change)
	case "loan":
		return s.applyLoanChange(ctx, change)
	case "label":
		return s.applyLabelChange(ctx, change)
	case "maintenance":
		return s.applyMaintenanceChange(ctx, change)
	case "wishlist":
		return s.applyWishlistChange(ctx, change)
	default:
		return ErrInvalidEntityType
	}
}

// applyItemChange applies changes to items through item.Service, applying the
// full field set the member submitted.
func (s *Service) applyItemChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			SKU               string     `json:"sku"`
			Name              string     `json:"name"`
			Description       *string    `json:"description"`
			CategoryID        *uuid.UUID `json:"category_id"`
			Brand             *string    `json:"brand"`
			Model             *string    `json:"model"`
			ImageURL          *string    `json:"image_url"`
			SerialNumber      *string    `json:"serial_number"`
			Manufacturer      *string    `json:"manufacturer"`
			Barcode           *string    `json:"barcode"`
			IsInsured         *bool      `json:"is_insured"`
			LifetimeWarranty  *bool      `json:"lifetime_warranty"`
			WarrantyDetails   *string    `json:"warranty_details"`
			PurchasedFrom     *uuid.UUID `json:"purchased_from"`
			MinStockLevel     int        `json:"min_stock_level"`
			ShortCode         string     `json:"short_code"`
			ObsidianVaultPath *string    `json:"obsidian_vault_path"`
			ObsidianNotePath  *string    `json:"obsidian_note_path"`
			NeedsReview       *bool      `json:"needs_review"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal item payload: %w", err)
		}
		if _, err := s.itemSvc.Create(ctx, item.CreateInput{
			WorkspaceID:       change.WorkspaceID(),
			SKU:               p.SKU,
			Name:              p.Name,
			Description:       p.Description,
			CategoryID:        p.CategoryID,
			Brand:             p.Brand,
			Model:             p.Model,
			ImageURL:          p.ImageURL,
			SerialNumber:      p.SerialNumber,
			Manufacturer:      p.Manufacturer,
			Barcode:           p.Barcode,
			IsInsured:         p.IsInsured,
			LifetimeWarranty:  p.LifetimeWarranty,
			WarrantyDetails:   p.WarrantyDetails,
			PurchasedFrom:     p.PurchasedFrom,
			MinStockLevel:     p.MinStockLevel,
			ShortCode:         p.ShortCode,
			ObsidianVaultPath: p.ObsidianVaultPath,
			ObsidianNotePath:  p.ObsidianNotePath,
			NeedsReview:       p.NeedsReview,
		}); err != nil {
			return fmt.Errorf("failed to create item: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var input item.UpdateInput
		if err := json.Unmarshal(change.Payload(), &input); err != nil {
			return fmt.Errorf(msgFailedToUnmarshalUpdatePayload, err)
		}
		if _, err := s.itemSvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), input); err != nil {
			return fmt.Errorf("failed to update item: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.itemSvc.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete item: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}

// applyCategoryChange applies changes to categories through category.Service.
func (s *Service) applyCategoryChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			Name             string     `json:"name"`
			ParentCategoryID *uuid.UUID `json:"parent_category_id"`
			Description      *string    `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal category payload: %w", err)
		}
		if _, err := s.categorySvc.Create(ctx, category.CreateInput{
			WorkspaceID:      change.WorkspaceID(),
			Name:             p.Name,
			ParentCategoryID: p.ParentCategoryID,
			Description:      p.Description,
		}); err != nil {
			return fmt.Errorf("failed to create category: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var p struct {
			Name             string     `json:"name"`
			ParentCategoryID *uuid.UUID `json:"parent_category_id"`
			Description      *string    `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf(msgFailedToUnmarshalUpdatePayload, err)
		}
		if _, err := s.categorySvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), category.UpdateInput{
			Name:             p.Name,
			ParentCategoryID: p.ParentCategoryID,
			Description:      p.Description,
		}); err != nil {
			return fmt.Errorf("failed to update category: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.categorySvc.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete category: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}

// applyLocationChange applies changes to locations through location.Service.
func (s *Service) applyLocationChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			Name           string     `json:"name"`
			ParentLocation *uuid.UUID `json:"parent_location"`
			Description    *string    `json:"description"`
			ShortCode      string     `json:"short_code"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal location payload: %w", err)
		}
		if _, err := s.locationSvc.Create(ctx, location.CreateInput{
			WorkspaceID:    change.WorkspaceID(),
			Name:           p.Name,
			ParentLocation: p.ParentLocation,
			Description:    p.Description,
			ShortCode:      p.ShortCode,
		}); err != nil {
			return fmt.Errorf("failed to create location: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var p struct {
			Name           string     `json:"name"`
			ParentLocation *uuid.UUID `json:"parent_location"`
			Description    *string    `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf(msgFailedToUnmarshalUpdatePayload, err)
		}
		if _, err := s.locationSvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), location.UpdateInput{
			Name:           p.Name,
			ParentLocation: p.ParentLocation,
			Description:    p.Description,
		}); err != nil {
			return fmt.Errorf("failed to update location: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.locationSvc.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete location: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}

// applyContainerChange applies changes to containers through container.Service.
func (s *Service) applyContainerChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			LocationID  uuid.UUID `json:"location_id"`
			Name        string    `json:"name"`
			Description *string   `json:"description"`
			Capacity    *string   `json:"capacity"`
			ShortCode   string    `json:"short_code"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal container payload: %w", err)
		}
		if _, err := s.containerSvc.Create(ctx, container.CreateInput{
			WorkspaceID: change.WorkspaceID(),
			LocationID:  p.LocationID,
			Name:        p.Name,
			Description: p.Description,
			Capacity:    p.Capacity,
			ShortCode:   p.ShortCode,
		}); err != nil {
			return fmt.Errorf("failed to create container: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var p struct {
			Name        string    `json:"name"`
			LocationID  uuid.UUID `json:"location_id"`
			Description *string   `json:"description"`
			Capacity    *string   `json:"capacity"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf(msgFailedToUnmarshalUpdatePayload, err)
		}
		if _, err := s.containerSvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), container.UpdateInput{
			Name:        p.Name,
			LocationID:  p.LocationID,
			Description: p.Description,
			Capacity:    p.Capacity,
		}); err != nil {
			return fmt.Errorf("failed to update container: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.containerSvc.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete container: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}

// applyInventoryChange applies changes to inventory through inventory.Service
// (create/update). Delete goes through the repository because the inventory
// domain exposes no service-level Delete.
func (s *Service) applyInventoryChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			ItemID          uuid.UUID  `json:"item_id"`
			LocationID      uuid.UUID  `json:"location_id"`
			ContainerID     *uuid.UUID `json:"container_id"`
			Quantity        int        `json:"quantity"`
			Condition       string     `json:"condition"`
			Status          string     `json:"status"`
			DateAcquired    *time.Time `json:"date_acquired"`
			PurchasePrice   *int       `json:"purchase_price"`
			CurrencyCode    *string    `json:"currency_code"`
			WarrantyExpires *time.Time `json:"warranty_expires"`
			ExpirationDate  *time.Time `json:"expiration_date"`
			Notes           *string    `json:"notes"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal inventory payload: %w", err)
		}
		if _, err := s.inventorySvc.Create(ctx, inventory.CreateInput{
			WorkspaceID:     change.WorkspaceID(),
			ItemID:          p.ItemID,
			LocationID:      p.LocationID,
			ContainerID:     p.ContainerID,
			Quantity:        p.Quantity,
			Condition:       inventory.Condition(p.Condition),
			Status:          inventory.Status(p.Status),
			DateAcquired:    p.DateAcquired,
			PurchasePrice:   p.PurchasePrice,
			CurrencyCode:    p.CurrencyCode,
			WarrantyExpires: p.WarrantyExpires,
			ExpirationDate:  p.ExpirationDate,
			Notes:           p.Notes,
		}); err != nil {
			return fmt.Errorf("failed to create inventory: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var p struct {
			LocationID      uuid.UUID  `json:"location_id"`
			ContainerID     *uuid.UUID `json:"container_id"`
			Quantity        int        `json:"quantity"`
			Condition       string     `json:"condition"`
			DateAcquired    *time.Time `json:"date_acquired"`
			PurchasePrice   *int       `json:"purchase_price"`
			CurrencyCode    *string    `json:"currency_code"`
			WarrantyExpires *time.Time `json:"warranty_expires"`
			ExpirationDate  *time.Time `json:"expiration_date"`
			Notes           *string    `json:"notes"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf(msgFailedToUnmarshalUpdatePayload, err)
		}
		if _, err := s.inventorySvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), inventory.UpdateInput{
			LocationID:      p.LocationID,
			ContainerID:     p.ContainerID,
			Quantity:        p.Quantity,
			Condition:       inventory.Condition(p.Condition),
			DateAcquired:    p.DateAcquired,
			PurchasePrice:   p.PurchasePrice,
			CurrencyCode:    p.CurrencyCode,
			WarrantyExpires: p.WarrantyExpires,
			ExpirationDate:  p.ExpirationDate,
			Notes:           p.Notes,
		}); err != nil {
			return fmt.Errorf("failed to update inventory: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.inventoryRepo.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete inventory: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}

// applyBorrowerChange applies changes to borrowers through borrower.Service.
func (s *Service) applyBorrowerChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			Name  string  `json:"name"`
			Email *string `json:"email"`
			Phone *string `json:"phone"`
			Notes *string `json:"notes"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal borrower payload: %w", err)
		}
		if _, err := s.borrowerSvc.Create(ctx, borrower.CreateInput{
			WorkspaceID: change.WorkspaceID(),
			Name:        p.Name,
			Email:       p.Email,
			Phone:       p.Phone,
			Notes:       p.Notes,
		}); err != nil {
			return fmt.Errorf("failed to create borrower: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var input borrower.UpdateInput
		if err := json.Unmarshal(change.Payload(), &input); err != nil {
			return fmt.Errorf(msgFailedToUnmarshalUpdatePayload, err)
		}
		if _, err := s.borrowerSvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), input); err != nil {
			return fmt.Errorf("failed to update borrower: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.borrowerSvc.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete borrower: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}

// applyLoanChange applies changes to loans through loan.Service (create/update).
// Delete goes through the repository because the loan domain exposes return
// semantics rather than a service-level Delete.
func (s *Service) applyLoanChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		return s.applyLoanCreate(ctx, change)
	case ActionUpdate:
		return s.applyLoanUpdate(ctx, change)
	case ActionDelete:
		return s.applyLoanDelete(ctx, change)
	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}
}

// parseOptionalDueDate parses an optional RFC3339 due-date pointer (nil in, nil
// out); shared by the loan create/update appliers.
func parseOptionalDueDate(due *string) (*time.Time, error) {
	if due == nil {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, *due)
	if err != nil {
		return nil, fmt.Errorf("failed to parse due_date: %w", err)
	}
	return &parsed, nil
}

func (s *Service) applyLoanCreate(ctx context.Context, change *PendingChange) error {
	var p struct {
		InventoryID uuid.UUID `json:"inventory_id"`
		BorrowerID  uuid.UUID `json:"borrower_id"`
		Quantity    int       `json:"quantity"`
		LoanedAt    string    `json:"loaned_at"`
		DueDate     *string   `json:"due_date"`
		Notes       *string   `json:"notes"`
	}
	if err := json.Unmarshal(change.Payload(), &p); err != nil {
		return fmt.Errorf("failed to unmarshal loan payload: %w", err)
	}

	loanedAt, err := time.Parse(time.RFC3339, p.LoanedAt)
	if err != nil {
		return fmt.Errorf("failed to parse loaned_at: %w", err)
	}

	dueDate, err := parseOptionalDueDate(p.DueDate)
	if err != nil {
		return err
	}

	if _, err := s.loanSvc.Create(ctx, loan.CreateInput{
		WorkspaceID: change.WorkspaceID(),
		InventoryID: p.InventoryID,
		BorrowerID:  p.BorrowerID,
		Quantity:    p.Quantity,
		LoanedAt:    loanedAt,
		DueDate:     dueDate,
		Notes:       p.Notes,
	}); err != nil {
		return fmt.Errorf("failed to create loan: %w", err)
	}
	return nil
}

func (s *Service) applyLoanUpdate(ctx context.Context, change *PendingChange) error {
	if change.EntityID() == nil {
		return errors.New(msgEntityIDRequiredForUpdateAction)
	}
	var p struct {
		DueDate *string `json:"due_date"`
		Notes   *string `json:"notes"`
	}
	if err := json.Unmarshal(change.Payload(), &p); err != nil {
		return fmt.Errorf(msgFailedToUnmarshalUpdatePayload, err)
	}

	dueDate, err := parseOptionalDueDate(p.DueDate)
	if err != nil {
		return err
	}

	if _, err := s.loanSvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), dueDate, p.Notes); err != nil {
		return fmt.Errorf("failed to update loan: %w", err)
	}
	return nil
}

func (s *Service) applyLoanDelete(ctx context.Context, change *PendingChange) error {
	if change.EntityID() == nil {
		return errors.New(msgEntityIDRequiredForDeleteAction)
	}
	if err := s.loanRepo.Delete(ctx, *change.EntityID()); err != nil {
		return fmt.Errorf("failed to delete loan: %w", err)
	}
	return nil
}

// applyLabelChange applies changes to labels through label.Service.
func (s *Service) applyLabelChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			Name        string  `json:"name"`
			Color       *string `json:"color"`
			Description *string `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal label payload: %w", err)
		}
		if _, err := s.labelSvc.Create(ctx, label.CreateInput{
			WorkspaceID: change.WorkspaceID(),
			Name:        p.Name,
			Color:       p.Color,
			Description: p.Description,
		}); err != nil {
			return fmt.Errorf("failed to create label: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var p struct {
			Name        string  `json:"name"`
			Color       *string `json:"color"`
			Description *string `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf(msgFailedToUnmarshalUpdatePayload, err)
		}
		if _, err := s.labelSvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), label.UpdateInput{
			Name:        p.Name,
			Color:       p.Color,
			Description: p.Description,
		}); err != nil {
			return fmt.Errorf("failed to update label: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.labelSvc.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete label: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}

// applyMaintenanceChange applies changes to maintenance schedules through
// maintenance.Service (create/update/delete), mirroring the other entity
// appliers: the canonical service path validates the inventory reference and
// the schedule invariants (positive interval, non-empty title).
func (s *Service) applyMaintenanceChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			InventoryID  uuid.UUID `json:"inventory_id"`
			Title        string    `json:"title"`
			Notes        *string   `json:"notes"`
			IntervalDays int       `json:"interval_days"`
			NextDue      time.Time `json:"next_due"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal maintenance payload: %w", err)
		}
		if _, err := s.maintenanceSvc.Create(ctx, maintenance.CreateInput{
			WorkspaceID:  change.WorkspaceID(),
			InventoryID:  p.InventoryID,
			Title:        p.Title,
			Notes:        p.Notes,
			IntervalDays: p.IntervalDays,
			NextDue:      p.NextDue,
		}); err != nil {
			return fmt.Errorf("failed to create maintenance schedule: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var p struct {
			Title        *string    `json:"title"`
			Notes        *string    `json:"notes"`
			IntervalDays *int       `json:"interval_days"`
			NextDue      *time.Time `json:"next_due"`
			IsActive     *bool      `json:"is_active"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal maintenance update payload: %w", err)
		}
		if _, err := s.maintenanceSvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), maintenance.UpdateInput{
			Title:        p.Title,
			Notes:        p.Notes,
			IntervalDays: p.IntervalDays,
			NextDue:      p.NextDue,
			IsActive:     p.IsActive,
		}); err != nil {
			return fmt.Errorf("failed to update maintenance schedule: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.maintenanceSvc.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete maintenance schedule: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}

// applyWishlistChange applies changes to wishlist items through
// wishlist.Service (create/update/delete), mirroring the other entity
// appliers: the canonical service path validates the category/item references
// and the wishlist invariants (non-empty name, priority bounds, status
// transitions — including the acquired close-out carried by an update).
func (s *Service) applyWishlistChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var p struct {
			Name              string     `json:"name"`
			Notes             *string    `json:"notes"`
			URL               *string    `json:"url"`
			PriceEstimate     *int       `json:"price_estimate"`
			CurrencyCode      *string    `json:"currency_code"`
			Priority          *int       `json:"priority"`
			DesiredCategoryID *uuid.UUID `json:"desired_category_id"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal wishlist payload: %w", err)
		}
		priority := wishlist.PriorityDefault
		if p.Priority != nil {
			priority = *p.Priority
		}
		requesterID := change.RequesterID()
		if _, err := s.wishlistSvc.Create(ctx, wishlist.CreateInput{
			WorkspaceID:       change.WorkspaceID(),
			Name:              p.Name,
			Notes:             p.Notes,
			URL:               p.URL,
			PriceEstimate:     p.PriceEstimate,
			CurrencyCode:      p.CurrencyCode,
			Priority:          priority,
			DesiredCategoryID: p.DesiredCategoryID,
			CreatedBy:         &requesterID,
		}); err != nil {
			return fmt.Errorf("failed to create wishlist item: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForUpdateAction)
		}
		var p struct {
			Name              *string    `json:"name"`
			Notes             *string    `json:"notes"`
			URL               *string    `json:"url"`
			PriceEstimate     *int       `json:"price_estimate"`
			CurrencyCode      *string    `json:"currency_code"`
			Priority          *int       `json:"priority"`
			DesiredCategoryID *uuid.UUID `json:"desired_category_id"`
			Status            *string    `json:"status"`
			AcquiredItemID    *uuid.UUID `json:"acquired_item_id"`
		}
		if err := json.Unmarshal(change.Payload(), &p); err != nil {
			return fmt.Errorf("failed to unmarshal wishlist update payload: %w", err)
		}
		var status *wishlist.Status
		if p.Status != nil {
			st := wishlist.Status(*p.Status)
			status = &st
		}
		if _, err := s.wishlistSvc.Update(ctx, *change.EntityID(), change.WorkspaceID(), wishlist.UpdateInput{
			Name:              p.Name,
			Notes:             p.Notes,
			URL:               p.URL,
			PriceEstimate:     p.PriceEstimate,
			CurrencyCode:      p.CurrencyCode,
			Priority:          p.Priority,
			DesiredCategoryID: p.DesiredCategoryID,
			Status:            status,
			AcquiredItemID:    p.AcquiredItemID,
		}); err != nil {
			return fmt.Errorf("failed to update wishlist item: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return errors.New(msgEntityIDRequiredForDeleteAction)
		}
		if err := s.wishlistSvc.Delete(ctx, *change.EntityID(), change.WorkspaceID()); err != nil {
			return fmt.Errorf("failed to delete wishlist item: %w", err)
		}

	default:
		return fmt.Errorf(msgUnsupportedAction, change.Action())
	}

	return nil
}
