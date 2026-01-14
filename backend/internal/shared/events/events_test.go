package events

import (
	"context"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInMemoryEventBus_PublishAndSubscribe(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	bus := NewInMemoryEventBus(logger)

	// Track received events
	var receivedEvents []Event
	handler := func(ctx context.Context, event Event) error {
		receivedEvents = append(receivedEvents, event)
		return nil
	}

	// Subscribe to item.created events
	bus.Subscribe("item.created", handler)

	// Publish event
	workspaceID := uuid.New()
	itemID := uuid.New()
	userID := uuid.New()
	event := NewItemCreatedEvent(workspaceID, itemID, "Test Item", "SKU-001", nil, &userID)

	ctx := context.Background()
	err := bus.Publish(ctx, event)

	// Assert
	require.NoError(t, err)
	require.Len(t, receivedEvents, 1)
	assert.Equal(t, "item.created", receivedEvents[0].EventName())
	assert.Equal(t, workspaceID, receivedEvents[0].WorkspaceID())
}

func TestInMemoryEventBus_MultipleHandlers(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	bus := NewInMemoryEventBus(logger)

	// Track calls
	var calls []string

	handler1 := func(ctx context.Context, event Event) error {
		calls = append(calls, "handler1")
		return nil
	}

	handler2 := func(ctx context.Context, event Event) error {
		calls = append(calls, "handler2")
		return nil
	}

	// Subscribe both handlers
	bus.Subscribe("item.created", handler1)
	bus.Subscribe("item.created", handler2)

	// Publish event
	workspaceID := uuid.New()
	itemID := uuid.New()
	event := NewItemCreatedEvent(workspaceID, itemID, "Test Item", "SKU-001", nil, nil)

	ctx := context.Background()
	err := bus.Publish(ctx, event)

	// Assert both handlers were called
	require.NoError(t, err)
	assert.Equal(t, []string{"handler1", "handler2"}, calls)
}

func TestInMemoryEventBus_SubscribeAll(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	bus := NewInMemoryEventBus(logger)

	// Track received events
	var receivedEvents []Event
	allHandler := func(ctx context.Context, event Event) error {
		receivedEvents = append(receivedEvents, event)
		return nil
	}

	// Subscribe to all events
	bus.SubscribeAll(allHandler)

	// Publish different event types
	workspaceID := uuid.New()
	ctx := context.Background()

	event1 := NewItemCreatedEvent(workspaceID, uuid.New(), "Item 1", "SKU-001", nil, nil)
	event2 := NewItemArchivedEvent(workspaceID, uuid.New(), "Item 2", nil)

	_ = bus.Publish(ctx, event1)
	_ = bus.Publish(ctx, event2)

	// Assert both events were received
	require.Len(t, receivedEvents, 2)
	assert.Equal(t, "item.created", receivedEvents[0].EventName())
	assert.Equal(t, "item.archived", receivedEvents[1].EventName())
}

func TestItemCreatedEvent(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	userID := uuid.New()
	categoryID := uuid.New()

	event := NewItemCreatedEvent(workspaceID, itemID, "Test Item", "SKU-001", &categoryID, &userID)

	assert.Equal(t, "item.created", event.EventName())
	assert.Equal(t, workspaceID, event.WorkspaceID())
	assert.Equal(t, itemID, event.ItemID)
	assert.Equal(t, "Test Item", event.ItemName)
	assert.Equal(t, "SKU-001", event.SKU)
	assert.Equal(t, &categoryID, event.CategoryID)
	assert.Equal(t, &userID, event.CreatedBy)
	assert.WithinDuration(t, time.Now(), event.OccurredAt(), time.Second)
}

func TestItemArchivedEvent(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	userID := uuid.New()

	event := NewItemArchivedEvent(workspaceID, itemID, "Test Item", &userID)

	assert.Equal(t, "item.archived", event.EventName())
	assert.Equal(t, workspaceID, event.WorkspaceID())
	assert.Equal(t, itemID, event.ItemID)
	assert.Equal(t, "Test Item", event.ItemName)
	assert.Equal(t, &userID, event.ArchivedBy)
	assert.WithinDuration(t, time.Now(), event.OccurredAt(), time.Second)
}

func TestInventoryMovedEvent(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	fromLocation := uuid.New()
	toLocation := uuid.New()
	userID := uuid.New()

	event := NewInventoryMovedEvent(workspaceID, inventoryID, "Test Item", &fromLocation, &toLocation, &userID)

	assert.Equal(t, "inventory.moved", event.EventName())
	assert.Equal(t, workspaceID, event.WorkspaceID())
	assert.Equal(t, inventoryID, event.InventoryID)
	assert.Equal(t, "Test Item", event.ItemName)
	assert.Equal(t, &fromLocation, event.FromLocation)
	assert.Equal(t, &toLocation, event.ToLocation)
	assert.Equal(t, &userID, event.MovedBy)
}

func TestLoanCreatedEvent(t *testing.T) {
	workspaceID := uuid.New()
	loanID := uuid.New()
	inventoryID := uuid.New()
	borrowerID := uuid.New()
	userID := uuid.New()
	dueDate := "2026-02-01"

	event := NewLoanCreatedEvent(workspaceID, loanID, inventoryID, "Test Item", borrowerID, &dueDate, &userID)

	assert.Equal(t, "loan.created", event.EventName())
	assert.Equal(t, workspaceID, event.WorkspaceID())
	assert.Equal(t, loanID, event.LoanID)
	assert.Equal(t, inventoryID, event.InventoryID)
	assert.Equal(t, "Test Item", event.ItemName)
	assert.Equal(t, borrowerID, event.BorrowerID)
	assert.Equal(t, &dueDate, event.DueDate)
	assert.Equal(t, &userID, event.CreatedBy)
}
