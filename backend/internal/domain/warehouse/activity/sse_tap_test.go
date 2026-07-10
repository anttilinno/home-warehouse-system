package activity

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// The mapping is exercised directly rather than through Broadcaster.Publish, so the
// assertions don't have to synchronise with the tap's write goroutine.
func TestEventToLogInput(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()

	tests := []struct {
		name       string
		event      events.Event
		wantOK     bool
		wantAction Action
		wantEntity EntityType
	}{
		{
			name:       "item.created maps to CREATE/ITEM",
			event:      events.Event{Type: "item.created", EntityType: "item", EntityID: entityID.String(), UserID: userID},
			wantOK:     true,
			wantAction: ActionCreate,
			wantEntity: EntityItem,
		},
		{
			name:       "item.deleted (archive) maps to DELETE",
			event:      events.Event{Type: "item.deleted", EntityType: "item", EntityID: entityID.String(), UserID: userID},
			wantOK:     true,
			wantAction: ActionDelete,
			wantEntity: EntityItem,
		},
		{
			name:       "borrower.archived maps to DELETE",
			event:      events.Event{Type: "borrower.archived", EntityType: "borrower", EntityID: entityID.String(), UserID: userID},
			wantOK:     true,
			wantAction: ActionDelete,
			wantEntity: EntityBorrower,
		},
		{
			name:       "borrower.restored maps to CREATE",
			event:      events.Event{Type: "borrower.restored", EntityType: "borrower", EntityID: entityID.String(), UserID: userID},
			wantOK:     true,
			wantAction: ActionCreate,
			wantEntity: EntityBorrower,
		},
		{
			name:       "loan.created maps to LOAN, not CREATE",
			event:      events.Event{Type: "loan.created", EntityType: "loan", EntityID: entityID.String(), UserID: userID},
			wantOK:     true,
			wantAction: ActionLoan,
			wantEntity: EntityLoan,
		},
		{
			name:       "loan.returned maps to RETURN",
			event:      events.Event{Type: "loan.returned", EntityType: "loan", EntityID: entityID.String(), UserID: userID},
			wantOK:     true,
			wantAction: ActionReturn,
			wantEntity: EntityLoan,
		},
		{
			name:       "inventory.updated maps to UPDATE",
			event:      events.Event{Type: "inventory.updated", EntityType: "inventory", EntityID: entityID.String(), UserID: userID},
			wantOK:     true,
			wantAction: ActionUpdate,
			wantEntity: EntityInventory,
		},
		{
			name:   "pendingchange events are skipped (not an audit entity)",
			event:  events.Event{Type: "pendingchange.approved", EntityType: "pendingchange", EntityID: entityID.String(), UserID: userID},
			wantOK: false,
		},
		{
			name:   "company is skipped (absent from the DB enum)",
			event:  events.Event{Type: "company.created", EntityType: "company", EntityID: entityID.String(), UserID: userID},
			wantOK: false,
		},
		{
			name:   "unknown action suffix is skipped",
			event:  events.Event{Type: "inventory.marked_used", EntityType: "inventory", EntityID: entityID.String(), UserID: userID},
			wantOK: false,
		},
		{
			name:   "unparsable entity id is skipped",
			event:  events.Event{Type: "item.created", EntityType: "item", EntityID: "not-a-uuid", UserID: userID},
			wantOK: false,
		},
		{
			name:   "type without a dot is skipped",
			event:  events.Event{Type: "heartbeat", EntityType: "item", EntityID: entityID.String(), UserID: userID},
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := eventToLogInput(workspaceID, tt.event)
			assert.Equal(t, tt.wantOK, ok)
			if !tt.wantOK {
				return
			}
			assert.Equal(t, tt.wantAction, got.Action)
			assert.Equal(t, tt.wantEntity, got.EntityType)
			assert.Equal(t, workspaceID, got.WorkspaceID)
			assert.Equal(t, entityID, got.EntityID)
			if assert.NotNil(t, got.UserID) {
				assert.Equal(t, userID, *got.UserID)
			}
		})
	}
}

func TestEventToLogInputOptionalFields(t *testing.T) {
	workspaceID := uuid.New()
	entityID := uuid.New()

	t.Run("system events (no user) log a nil actor", func(t *testing.T) {
		got, ok := eventToLogInput(workspaceID, events.Event{
			Type: "item.updated", EntityType: "item", EntityID: entityID.String(), UserID: uuid.Nil,
		})
		assert.True(t, ok)
		assert.Nil(t, got.UserID)
	})

	t.Run("entity name and metadata come from the event data", func(t *testing.T) {
		data := map[string]any{"name": "Cordless Drill", "sku": "TOOL-001"}
		got, ok := eventToLogInput(workspaceID, events.Event{
			Type: "item.created", EntityType: "item", EntityID: entityID.String(), Data: data,
		})
		assert.True(t, ok)
		assert.Equal(t, "Cordless Drill", got.EntityName)
		assert.Equal(t, data, got.Metadata)
	})

	t.Run("missing name leaves entity name empty", func(t *testing.T) {
		got, ok := eventToLogInput(workspaceID, events.Event{
			Type: "item.created", EntityType: "item", EntityID: entityID.String(),
			Data: map[string]any{"user_name": "Reviewer"},
		})
		assert.True(t, ok)
		assert.Empty(t, got.EntityName)
	})
}
