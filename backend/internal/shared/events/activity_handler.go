package events

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
)

// ActivityLoggerHandler handles events by logging them to the activity log.
type ActivityLoggerHandler struct {
	activityService activity.ServiceInterface
}

// NewActivityLoggerHandler creates a new activity logger event handler.
func NewActivityLoggerHandler(activityService activity.ServiceInterface) *ActivityLoggerHandler {
	return &ActivityLoggerHandler{
		activityService: activityService,
	}
}

// Handle processes an event and logs it to the activity log.
func (h *ActivityLoggerHandler) Handle(ctx context.Context, event Event) error {
	// Map event to activity log input
	switch e := event.(type) {
	case ItemCreatedEvent:
		return h.activityService.Log(ctx, activity.LogInput{
			WorkspaceID: e.WorkspaceID(),
			UserID:      e.CreatedBy,
			Action:      activity.ActionCreate,
			EntityType:  activity.EntityItem,
			EntityID:    e.ItemID,
			EntityName:  e.ItemName,
			Changes: map[string]interface{}{
				"sku": e.SKU,
			},
			Metadata: nil,
		})

	case ItemUpdatedEvent:
		return h.activityService.Log(ctx, activity.LogInput{
			WorkspaceID: e.WorkspaceID(),
			UserID:      e.UpdatedBy,
			Action:      activity.ActionUpdate,
			EntityType:  activity.EntityItem,
			EntityID:    e.ItemID,
			EntityName:  e.ItemName,
			Changes:     e.Changes,
			Metadata:    nil,
		})

	case ItemArchivedEvent:
		return h.activityService.Log(ctx, activity.LogInput{
			WorkspaceID: e.WorkspaceID(),
			UserID:      e.ArchivedBy,
			Action:      activity.ActionDelete,
			EntityType:  activity.EntityItem,
			EntityID:    e.ItemID,
			EntityName:  e.ItemName,
			Changes:     map[string]interface{}{"archived": true},
			Metadata:    nil,
		})

	case ItemRestoredEvent:
		return h.activityService.Log(ctx, activity.LogInput{
			WorkspaceID: e.WorkspaceID(),
			UserID:      e.RestoredBy,
			Action:      activity.ActionUpdate,
			EntityType:  activity.EntityItem,
			EntityID:    e.ItemID,
			EntityName:  e.ItemName,
			Changes:     map[string]interface{}{"restored": true},
			Metadata:    nil,
		})

	case InventoryCreatedEvent:
		return h.activityService.Log(ctx, activity.LogInput{
			WorkspaceID: e.WorkspaceID(),
			UserID:      e.CreatedBy,
			Action:      activity.ActionCreate,
			EntityType:  activity.EntityInventory,
			EntityID:    e.InventoryID,
			EntityName:  fmt.Sprintf("%s (qty: %d)", e.ItemName, e.Quantity),
			Changes: map[string]interface{}{
				"item_id":  e.ItemID.String(),
				"quantity": e.Quantity,
			},
			Metadata: nil,
		})

	case InventoryMovedEvent:
		return h.activityService.Log(ctx, activity.LogInput{
			WorkspaceID: e.WorkspaceID(),
			UserID:      e.MovedBy,
			Action:      activity.ActionMove,
			EntityType:  activity.EntityInventory,
			EntityID:    e.InventoryID,
			EntityName:  e.ItemName,
			Changes: map[string]interface{}{
				"from_location": formatLocationID(e.FromLocation),
				"to_location":   formatLocationID(e.ToLocation),
			},
			Metadata: nil,
		})

	case LoanCreatedEvent:
		return h.activityService.Log(ctx, activity.LogInput{
			WorkspaceID: e.WorkspaceID(),
			UserID:      e.CreatedBy,
			Action:      activity.ActionLoan,
			EntityType:  activity.EntityLoan,
			EntityID:    e.LoanID,
			EntityName:  e.ItemName,
			Changes: map[string]interface{}{
				"inventory_id": e.InventoryID.String(),
				"borrower_id":  e.BorrowerID.String(),
				"due_date":     formatDueDate(e.DueDate),
			},
			Metadata: nil,
		})

	case LoanReturnedEvent:
		return h.activityService.Log(ctx, activity.LogInput{
			WorkspaceID: e.WorkspaceID(),
			UserID:      e.ReturnedBy,
			Action:      activity.ActionReturn,
			EntityType:  activity.EntityLoan,
			EntityID:    e.LoanID,
			EntityName:  e.ItemName,
			Changes: map[string]interface{}{
				"borrower_id": e.BorrowerID.String(),
			},
			Metadata: nil,
		})

	default:
		// Unknown event type, skip logging
		return nil
	}
}

// RegisterHandlers registers all activity logging handlers on the event bus.
func (h *ActivityLoggerHandler) RegisterHandlers(bus EventBus) {
	bus.Subscribe("item.created", h.Handle)
	bus.Subscribe("item.updated", h.Handle)
	bus.Subscribe("item.archived", h.Handle)
	bus.Subscribe("item.restored", h.Handle)
	bus.Subscribe("inventory.created", h.Handle)
	bus.Subscribe("inventory.moved", h.Handle)
	bus.Subscribe("loan.created", h.Handle)
	bus.Subscribe("loan.returned", h.Handle)
}

// Helper functions

func formatLocationID(id *uuid.UUID) string {
	if id == nil {
		return "none"
	}
	return id.String()
}

func formatDueDate(date *string) string {
	if date == nil {
		return "no due date"
	}
	return *date
}
