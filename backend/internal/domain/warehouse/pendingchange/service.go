package pendingchange

import (
	"context"
	"encoding/json"
	"fmt"
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
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// EntityApplier defines the interface for applying approved changes to specific entity types.
// Implementations are responsible for deserializing the JSON payload and creating, updating,
// or deleting the appropriate entity.
type EntityApplier interface {
	// ApplyCreate creates a new entity from the JSON payload and returns its ID
	ApplyCreate(ctx context.Context, workspaceID uuid.UUID, payload json.RawMessage) (uuid.UUID, error)

	// ApplyUpdate updates an existing entity with data from the JSON payload
	ApplyUpdate(ctx context.Context, entityID uuid.UUID, payload json.RawMessage) error

	// ApplyDelete removes an entity by its ID
	ApplyDelete(ctx context.Context, entityID uuid.UUID) error
}

// Service handles business logic for pending changes in the approval pipeline.
// It coordinates between the pending change repository, entity repositories, and the
// SSE broadcaster to manage the complete approval workflow.
type Service struct {
	repo           Repository
	memberRepo     member.Repository
	userRepo       user.Repository
	itemRepo       item.Repository
	categoryRepo   category.Repository
	locationRepo   location.Repository
	containerRepo  container.Repository
	inventoryRepo  inventory.Repository
	borrowerRepo   borrower.Repository
	loanRepo       loan.Repository
	labelRepo      label.Repository
	broadcaster    *events.Broadcaster
}

// NewService creates a new pending change service with all required dependencies.
// The service requires repositories for all supported entity types to apply approved changes.
func NewService(
	repo Repository,
	memberRepo member.Repository,
	userRepo user.Repository,
	itemRepo item.Repository,
	categoryRepo category.Repository,
	locationRepo location.Repository,
	containerRepo container.Repository,
	inventoryRepo inventory.Repository,
	borrowerRepo borrower.Repository,
	loanRepo loan.Repository,
	labelRepo label.Repository,
	broadcaster *events.Broadcaster,
) *Service {
	return &Service{
		repo:          repo,
		memberRepo:    memberRepo,
		userRepo:      userRepo,
		itemRepo:      itemRepo,
		categoryRepo:  categoryRepo,
		locationRepo:  locationRepo,
		containerRepo: containerRepo,
		inventoryRepo: inventoryRepo,
		borrowerRepo:  borrowerRepo,
		loanRepo:      loanRepo,
		labelRepo:     labelRepo,
		broadcaster:   broadcaster,
	}
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
				"id":                 change.ID().String(),
				"entity_type":        change.EntityType(),
				"entity_id":          change.EntityID(),
				"action":             string(change.Action()),
				"requester_id":       requesterID.String(),
				"requester_name":     requesterName,
				"requester_email":    requesterEmail,
				"status":             string(change.Status()),
			},
		})
	}

	return change, nil
}

// ApproveChange approves a pending change and applies it to the database.
// This operation:
//  1. Verifies the reviewer has admin/owner permissions
//  2. Marks the change as approved
//  3. Applies the change to the actual entity (creates, updates, or deletes)
//  4. Publishes an SSE event to notify the requester and other workspace members
//
// Returns an error if the reviewer lacks permissions, the change doesn't exist,
// has already been reviewed, or the change cannot be applied.
func (s *Service) ApproveChange(ctx context.Context, changeID uuid.UUID, reviewerID uuid.UUID) error {
	// Fetch the pending change
	change, err := s.repo.FindByID(ctx, changeID)
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

	// Approve the change (updates status)
	if err := change.Approve(reviewerID); err != nil {
		return fmt.Errorf("failed to approve change: %w", err)
	}

	// Apply the change to the actual entity
	if err := s.applyChange(ctx, change); err != nil {
		return fmt.Errorf("failed to apply change: %w", err)
	}

	// Save the approved change
	if err := s.repo.Save(ctx, change); err != nil {
		return fmt.Errorf("failed to save approved change: %w", err)
	}

	// Publish SSE event for approval
	if s.broadcaster != nil {
		s.broadcaster.Publish(change.WorkspaceID(), events.Event{
			Type:       "pendingchange.approved",
			EntityID:   change.ID().String(),
			EntityType: "pendingchange",
			UserID:     reviewerID,
			Data: map[string]any{
				"id":                 change.ID().String(),
				"entity_type":        change.EntityType(),
				"entity_id":          change.EntityID(),
				"action":             string(change.Action()),
				"requester_id":       change.RequesterID().String(),
				"requester_name":     requesterName,
				"requester_email":    requesterEmail,
				"reviewer_id":        reviewerID.String(),
				"reviewer_name":      reviewerName,
				"reviewer_email":     reviewerEmail,
				"status":             string(change.Status()),
			},
		})
	}

	return nil
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
func (s *Service) RejectChange(ctx context.Context, changeID uuid.UUID, reviewerID uuid.UUID, reason string) error {
	// Fetch the pending change
	change, err := s.repo.FindByID(ctx, changeID)
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
				"id":                 change.ID().String(),
				"entity_type":        change.EntityType(),
				"entity_id":          change.EntityID(),
				"action":             string(change.Action()),
				"requester_id":       change.RequesterID().String(),
				"requester_name":     requesterName,
				"requester_email":    requesterEmail,
				"reviewer_id":        reviewerID.String(),
				"reviewer_name":      reviewerName,
				"reviewer_email":     reviewerEmail,
				"rejection_reason":   reason,
				"status":             string(change.Status()),
			},
		})
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

// isValidEntityType checks if the entity type is supported
func (s *Service) isValidEntityType(entityType string) bool {
	validTypes := map[string]bool{
		"item":      true,
		"category":  true,
		"location":  true,
		"container": true,
		"inventory": true,
		"borrower":  true,
		"loan":      true,
		"label":     true,
	}
	return validTypes[entityType]
}

// applyChange applies the approved change to the actual entity
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
	default:
		return ErrInvalidEntityType
	}
}

// applyItemChange applies changes to items
func (s *Service) applyItemChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var itemData struct {
			Name          string  `json:"name"`
			SKU           string  `json:"sku"`
			MinStockLevel int     `json:"min_stock_level"`
		}
		if err := json.Unmarshal(change.Payload(), &itemData); err != nil {
			return fmt.Errorf("failed to unmarshal item payload: %w", err)
		}

		// Set defaults if not provided
		if itemData.SKU == "" {
			itemData.SKU = "AUTO"
		}

		newItem, err := item.NewItem(
			change.WorkspaceID(),
			itemData.Name,
			itemData.SKU,
			itemData.MinStockLevel,
		)
		if err != nil {
			return fmt.Errorf("failed to create item: %w", err)
		}

		if err := s.itemRepo.Save(ctx, newItem); err != nil {
			return fmt.Errorf("failed to save item: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for update action")
		}

		existingItem, err := s.itemRepo.FindByID(ctx, *change.EntityID(), change.WorkspaceID())
		if err != nil {
			return fmt.Errorf("failed to find item: %w", err)
		}

		// Unmarshal into the UpdateInput struct that item.Update expects
		var updateInput item.UpdateInput
		if err := json.Unmarshal(change.Payload(), &updateInput); err != nil {
			return fmt.Errorf("failed to unmarshal update payload: %w", err)
		}

		// Apply updates using the entity's Update method
		if err := existingItem.Update(updateInput); err != nil {
			return fmt.Errorf("failed to update item: %w", err)
		}

		// Save the updated item
		if err := s.itemRepo.Save(ctx, existingItem); err != nil {
			return fmt.Errorf("failed to save updated item: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for delete action")
		}

		if err := s.itemRepo.Delete(ctx, *change.EntityID()); err != nil {
			return fmt.Errorf("failed to delete item: %w", err)
		}

	default:
		return fmt.Errorf("unsupported action: %s", change.Action())
	}

	return nil
}

// applyCategoryChange applies changes to categories
func (s *Service) applyCategoryChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var categoryData struct {
			Name             string     `json:"name"`
			ParentCategoryID *uuid.UUID `json:"parent_category_id"`
			Description      *string    `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &categoryData); err != nil {
			return fmt.Errorf("failed to unmarshal category payload: %w", err)
		}

		newCategory, err := category.NewCategory(
			change.WorkspaceID(),
			categoryData.Name,
			categoryData.ParentCategoryID,
			categoryData.Description,
		)
		if err != nil {
			return fmt.Errorf("failed to create category: %w", err)
		}

		if err := s.categoryRepo.Save(ctx, newCategory); err != nil {
			return fmt.Errorf("failed to save category: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for update action")
		}

		existingCategory, err := s.categoryRepo.FindByID(ctx, *change.EntityID(), change.WorkspaceID())
		if err != nil {
			return fmt.Errorf("failed to find category: %w", err)
		}

		var updateData struct {
			Name             string     `json:"name"`
			ParentCategoryID *uuid.UUID `json:"parent_category_id"`
			Description      *string    `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &updateData); err != nil {
			return fmt.Errorf("failed to unmarshal update payload: %w", err)
		}

		if err := existingCategory.Update(updateData.Name, updateData.ParentCategoryID, updateData.Description); err != nil {
			return fmt.Errorf("failed to update category: %w", err)
		}

		if err := s.categoryRepo.Save(ctx, existingCategory); err != nil {
			return fmt.Errorf("failed to save updated category: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for delete action")
		}

		if err := s.categoryRepo.Delete(ctx, *change.EntityID()); err != nil {
			return fmt.Errorf("failed to delete category: %w", err)
		}

	default:
		return fmt.Errorf("unsupported action: %s", change.Action())
	}

	return nil
}

// applyLocationChange applies changes to locations
func (s *Service) applyLocationChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var locationData struct {
			Name           string     `json:"name"`
			ParentLocation *uuid.UUID `json:"parent_location"`
			Zone           *string    `json:"zone"`
			Shelf          *string    `json:"shelf"`
			Bin            *string    `json:"bin"`
			Description    *string    `json:"description"`
			ShortCode      *string    `json:"short_code"`
		}
		if err := json.Unmarshal(change.Payload(), &locationData); err != nil {
			return fmt.Errorf("failed to unmarshal location payload: %w", err)
		}

		// NewLocation signature: (workspaceID, name, parentLocation, zone, shelf, bin, description, shortCode)
		newLocation, err := location.NewLocation(
			change.WorkspaceID(),
			locationData.Name,
			locationData.ParentLocation,
			locationData.Zone,
			locationData.Shelf,
			locationData.Bin,
			locationData.Description,
			locationData.ShortCode,
		)
		if err != nil {
			return fmt.Errorf("failed to create location: %w", err)
		}

		if err := s.locationRepo.Save(ctx, newLocation); err != nil {
			return fmt.Errorf("failed to save location: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for update action")
		}

		existingLocation, err := s.locationRepo.FindByID(ctx, *change.EntityID(), change.WorkspaceID())
		if err != nil {
			return fmt.Errorf("failed to find location: %w", err)
		}

		var updateData struct {
			Name           string     `json:"name"`
			ParentLocation *uuid.UUID `json:"parent_location"`
			Zone           *string    `json:"zone"`
			Shelf          *string    `json:"shelf"`
			Bin            *string    `json:"bin"`
			Description    *string    `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &updateData); err != nil {
			return fmt.Errorf("failed to unmarshal update payload: %w", err)
		}

		if err := existingLocation.Update(updateData.Name, updateData.ParentLocation, updateData.Zone, updateData.Shelf, updateData.Bin, updateData.Description); err != nil {
			return fmt.Errorf("failed to update location: %w", err)
		}

		if err := s.locationRepo.Save(ctx, existingLocation); err != nil {
			return fmt.Errorf("failed to save updated location: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for delete action")
		}

		if err := s.locationRepo.Delete(ctx, *change.EntityID()); err != nil {
			return fmt.Errorf("failed to delete location: %w", err)
		}

	default:
		return fmt.Errorf("unsupported action: %s", change.Action())
	}

	return nil
}

// applyContainerChange applies changes to containers
func (s *Service) applyContainerChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var containerData struct {
			LocationID  uuid.UUID `json:"location_id"`
			Name        string    `json:"name"`
			Description *string   `json:"description"`
			Capacity    *string   `json:"capacity"`
			ShortCode   *string   `json:"short_code"`
		}
		if err := json.Unmarshal(change.Payload(), &containerData); err != nil {
			return fmt.Errorf("failed to unmarshal container payload: %w", err)
		}

		// NewContainer signature: (workspaceID, locationID uuid.UUID, name string, description, capacity, shortCode *string)
		newContainer, err := container.NewContainer(
			change.WorkspaceID(),
			containerData.LocationID,
			containerData.Name,
			containerData.Description,
			containerData.Capacity,
			containerData.ShortCode,
		)
		if err != nil {
			return fmt.Errorf("failed to create container: %w", err)
		}

		if err := s.containerRepo.Save(ctx, newContainer); err != nil {
			return fmt.Errorf("failed to save container: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for update action")
		}

		existingContainer, err := s.containerRepo.FindByID(ctx, *change.EntityID(), change.WorkspaceID())
		if err != nil {
			return fmt.Errorf("failed to find container: %w", err)
		}

		var updateData struct {
			Name        string    `json:"name"`
			LocationID  uuid.UUID `json:"location_id"`
			Description *string   `json:"description"`
			Capacity    *string   `json:"capacity"`
		}
		if err := json.Unmarshal(change.Payload(), &updateData); err != nil {
			return fmt.Errorf("failed to unmarshal update payload: %w", err)
		}

		// container.Update signature: (name string, locationID uuid.UUID, description, capacity *string)
		if err := existingContainer.Update(updateData.Name, updateData.LocationID, updateData.Description, updateData.Capacity); err != nil {
			return fmt.Errorf("failed to update container: %w", err)
		}

		if err := s.containerRepo.Save(ctx, existingContainer); err != nil {
			return fmt.Errorf("failed to save updated container: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for delete action")
		}

		if err := s.containerRepo.Delete(ctx, *change.EntityID()); err != nil {
			return fmt.Errorf("failed to delete container: %w", err)
		}

	default:
		return fmt.Errorf("unsupported action: %s", change.Action())
	}

	return nil
}

// applyInventoryChange applies changes to inventory
func (s *Service) applyInventoryChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var inventoryData struct {
			ItemID       uuid.UUID  `json:"item_id"`
			LocationID   uuid.UUID  `json:"location_id"`
			ContainerID  *uuid.UUID `json:"container_id"`
			Quantity     int        `json:"quantity"`
			Condition    string     `json:"condition"`
			Status       string     `json:"status"`
			CurrencyCode *string    `json:"currency_code"`
		}
		if err := json.Unmarshal(change.Payload(), &inventoryData); err != nil {
			return fmt.Errorf("failed to unmarshal inventory payload: %w", err)
		}

		condition := inventory.Condition(inventoryData.Condition)
		status := inventory.Status(inventoryData.Status)

		// NewInventory signature: (workspaceID, itemID, locationID uuid.UUID, containerID *uuid.UUID, quantity int, condition Condition, status Status, currencyCode *string)
		newInventory, err := inventory.NewInventory(
			change.WorkspaceID(),
			inventoryData.ItemID,
			inventoryData.LocationID,
			inventoryData.ContainerID,
			inventoryData.Quantity,
			condition,
			status,
			inventoryData.CurrencyCode,
		)
		if err != nil {
			return fmt.Errorf("failed to create inventory: %w", err)
		}

		if err := s.inventoryRepo.Save(ctx, newInventory); err != nil {
			return fmt.Errorf("failed to save inventory: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for update action")
		}

		existingInventory, err := s.inventoryRepo.FindByID(ctx, *change.EntityID(), change.WorkspaceID())
		if err != nil {
			return fmt.Errorf("failed to find inventory: %w", err)
		}

		var updateData map[string]interface{}
		if err := json.Unmarshal(change.Payload(), &updateData); err != nil {
			return fmt.Errorf("failed to unmarshal update payload: %w", err)
		}

		if quantity, ok := updateData["quantity"].(float64); ok {
			if err := existingInventory.UpdateQuantity(int(quantity)); err != nil {
				return fmt.Errorf("failed to update quantity: %w", err)
			}
		}

		if err := s.inventoryRepo.Save(ctx, existingInventory); err != nil {
			return fmt.Errorf("failed to save updated inventory: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for delete action")
		}

		if err := s.inventoryRepo.Delete(ctx, *change.EntityID()); err != nil {
			return fmt.Errorf("failed to delete inventory: %w", err)
		}

	default:
		return fmt.Errorf("unsupported action: %s", change.Action())
	}

	return nil
}

// applyBorrowerChange applies changes to borrowers
func (s *Service) applyBorrowerChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var borrowerData struct {
			Name  string  `json:"name"`
			Email *string `json:"email"`
			Phone *string `json:"phone"`
			Notes *string `json:"notes"`
		}
		if err := json.Unmarshal(change.Payload(), &borrowerData); err != nil {
			return fmt.Errorf("failed to unmarshal borrower payload: %w", err)
		}

		// NewBorrower signature: (workspaceID uuid.UUID, name string, email, phone, notes *string)
		newBorrower, err := borrower.NewBorrower(
			change.WorkspaceID(),
			borrowerData.Name,
			borrowerData.Email,
			borrowerData.Phone,
			borrowerData.Notes,
		)
		if err != nil {
			return fmt.Errorf("failed to create borrower: %w", err)
		}

		if err := s.borrowerRepo.Save(ctx, newBorrower); err != nil {
			return fmt.Errorf("failed to save borrower: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for update action")
		}

		existingBorrower, err := s.borrowerRepo.FindByID(ctx, *change.EntityID(), change.WorkspaceID())
		if err != nil {
			return fmt.Errorf("failed to find borrower: %w", err)
		}

		var updateInput borrower.UpdateInput
		if err := json.Unmarshal(change.Payload(), &updateInput); err != nil {
			return fmt.Errorf("failed to unmarshal update payload: %w", err)
		}

		if err := existingBorrower.Update(updateInput); err != nil {
			return fmt.Errorf("failed to update borrower: %w", err)
		}

		if err := s.borrowerRepo.Save(ctx, existingBorrower); err != nil {
			return fmt.Errorf("failed to save updated borrower: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for delete action")
		}

		if err := s.borrowerRepo.Delete(ctx, *change.EntityID()); err != nil {
			return fmt.Errorf("failed to delete borrower: %w", err)
		}

	default:
		return fmt.Errorf("unsupported action: %s", change.Action())
	}

	return nil
}

// applyLoanChange applies changes to loans
func (s *Service) applyLoanChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var loanData struct {
			InventoryID uuid.UUID   `json:"inventory_id"`
			BorrowerID  uuid.UUID   `json:"borrower_id"`
			Quantity    int         `json:"quantity"`
			LoanedAt    string      `json:"loaned_at"`
			DueDate     *string     `json:"due_date"`
			Notes       *string     `json:"notes"`
		}
		if err := json.Unmarshal(change.Payload(), &loanData); err != nil {
			return fmt.Errorf("failed to unmarshal loan payload: %w", err)
		}

		// Parse the loaned_at time
		loanedAt, err := time.Parse(time.RFC3339, loanData.LoanedAt)
		if err != nil {
			return fmt.Errorf("failed to parse loaned_at: %w", err)
		}

		// Parse due_date if provided
		var dueDate *time.Time
		if loanData.DueDate != nil {
			parsed, err := time.Parse(time.RFC3339, *loanData.DueDate)
			if err != nil {
				return fmt.Errorf("failed to parse due_date: %w", err)
			}
			dueDate = &parsed
		}

		// NewLoan signature: (workspaceID, inventoryID, borrowerID uuid.UUID, quantity int, loanedAt time.Time, dueDate *time.Time, notes *string)
		newLoan, err := loan.NewLoan(
			change.WorkspaceID(),
			loanData.InventoryID,
			loanData.BorrowerID,
			loanData.Quantity,
			loanedAt,
			dueDate,
			loanData.Notes,
		)
		if err != nil {
			return fmt.Errorf("failed to create loan: %w", err)
		}

		if err := s.loanRepo.Save(ctx, newLoan); err != nil {
			return fmt.Errorf("failed to save loan: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for update action")
		}

		existingLoan, err := s.loanRepo.FindByID(ctx, *change.EntityID(), change.WorkspaceID())
		if err != nil {
			return fmt.Errorf("failed to find loan: %w", err)
		}

		var updateData map[string]interface{}
		if err := json.Unmarshal(change.Payload(), &updateData); err != nil {
			return fmt.Errorf("failed to unmarshal update payload: %w", err)
		}

		// Apply updates based on the payload
		if _, ok := updateData["return"]; ok {
			if err := existingLoan.Return(); err != nil {
				return fmt.Errorf("failed to return loan: %w", err)
			}
		}

		if err := s.loanRepo.Save(ctx, existingLoan); err != nil {
			return fmt.Errorf("failed to save updated loan: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for delete action")
		}

		if err := s.loanRepo.Delete(ctx, *change.EntityID()); err != nil {
			return fmt.Errorf("failed to delete loan: %w", err)
		}

	default:
		return fmt.Errorf("unsupported action: %s", change.Action())
	}

	return nil
}

// applyLabelChange applies changes to labels
func (s *Service) applyLabelChange(ctx context.Context, change *PendingChange) error {
	switch change.Action() {
	case ActionCreate:
		var labelData struct {
			Name        string  `json:"name"`
			Color       *string `json:"color"`
			Description *string `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &labelData); err != nil {
			return fmt.Errorf("failed to unmarshal label payload: %w", err)
		}

		// NewLabel signature: (workspaceID uuid.UUID, name string, color, description *string)
		newLabel, err := label.NewLabel(
			change.WorkspaceID(),
			labelData.Name,
			labelData.Color,
			labelData.Description,
		)
		if err != nil {
			return fmt.Errorf("failed to create label: %w", err)
		}

		if err := s.labelRepo.Save(ctx, newLabel); err != nil {
			return fmt.Errorf("failed to save label: %w", err)
		}

	case ActionUpdate:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for update action")
		}

		existingLabel, err := s.labelRepo.FindByID(ctx, *change.EntityID(), change.WorkspaceID())
		if err != nil {
			return fmt.Errorf("failed to find label: %w", err)
		}

		var updateData struct {
			Name        string  `json:"name"`
			Color       *string `json:"color"`
			Description *string `json:"description"`
		}
		if err := json.Unmarshal(change.Payload(), &updateData); err != nil {
			return fmt.Errorf("failed to unmarshal update payload: %w", err)
		}

		if err := existingLabel.Update(updateData.Name, updateData.Color, updateData.Description); err != nil {
			return fmt.Errorf("failed to update label: %w", err)
		}

		if err := s.labelRepo.Save(ctx, existingLabel); err != nil {
			return fmt.Errorf("failed to save updated label: %w", err)
		}

	case ActionDelete:
		if change.EntityID() == nil {
			return fmt.Errorf("entity_id is required for delete action")
		}

		if err := s.labelRepo.Delete(ctx, *change.EntityID()); err != nil {
			return fmt.Errorf("failed to delete label: %w", err)
		}

	default:
		return fmt.Errorf("unsupported action: %s", change.Action())
	}

	return nil
}
