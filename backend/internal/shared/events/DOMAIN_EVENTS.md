# Domain Events System

This document describes the domain events system for decoupling side effects like activity logging from core business logic.

## Overview

The domain events system provides a clean way to handle cross-cutting concerns without coupling your business logic to infrastructure concerns like logging, notifications, or analytics.

### Benefits

- **Decoupled Logic**: Business logic doesn't need to know about activity logging or notifications
- **Easier Testing**: Test core logic without mocking activity loggers
- **Extensible**: Add new event handlers without modifying services
- **Single Responsibility**: Services focus on business logic, handlers manage side effects

## Architecture

```
Service → Publish Event → EventBus → Handlers (Activity Logger, Notifications, etc.)
```

## Core Components

### Event Interface

All domain events implement the `Event` interface:

```go
type Event interface {
    EventName() string
    OccurredAt() time.Time
    WorkspaceID() uuid.UUID
}
```

### EventBus

The `EventBus` manages event publication and subscription:

```go
type EventBus interface {
    Publish(ctx context.Context, event Event) error
    Subscribe(eventName string, handler EventHandler)
    SubscribeAll(handler EventHandler)
}
```

### Event Handler

Handlers process events:

```go
type EventHandler func(ctx context.Context, event Event) error
```

## Available Events

### Item Events

- `item.created` - `ItemCreatedEvent`
- `item.updated` - `ItemUpdatedEvent`
- `item.archived` - `ItemArchivedEvent`
- `item.restored` - `ItemRestoredEvent`

### Inventory Events

- `inventory.created` - `InventoryCreatedEvent`
- `inventory.moved` - `InventoryMovedEvent`

### Loan Events

- `loan.created` - `LoanCreatedEvent`
- `loan.returned` - `LoanReturnedEvent`

## Usage Example

### 1. Publishing Events from Services

When performing business operations, publish domain events:

```go
func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID, userID *uuid.UUID) error {
    // Load item
    item, err := s.repo.FindByID(ctx, id, workspaceID)
    if err != nil {
        return err
    }

    // Perform business logic
    if err := item.Archive(); err != nil {
        return err
    }

    // Save changes
    if err := s.repo.Save(ctx, item); err != nil {
        return err
    }

    // Publish event (side effects will be handled by event handlers)
    event := events.NewItemArchivedEvent(workspaceID, item.ID(), item.Name(), userID)
    if err := s.eventBus.Publish(ctx, event); err != nil {
        // Log error but don't fail the operation
        log.Error("failed to publish event", "error", err)
    }

    return nil
}
```

### 2. Creating Custom Event Handlers

Create handlers for your specific needs:

```go
// Custom notification handler
type NotificationHandler struct {
    notificationService notification.ServiceInterface
}

func (h *NotificationHandler) Handle(ctx context.Context, event Event) error {
    switch e := event.(type) {
    case events.LoanCreatedEvent:
        // Send notification when loan is created
        return h.notificationService.Notify(ctx, notification.Input{
            WorkspaceID: e.WorkspaceID(),
            UserID:      e.CreatedBy,
            Type:        notification.TypeLoanCreated,
            Message:     fmt.Sprintf("Loan created for %s", e.ItemName),
        })
    }
    return nil
}
```

### 3. Wiring Everything Together

In `router.go` or `main.go`, wire the event bus and handlers:

```go
// Create event bus
logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
eventBus := events.NewInMemoryEventBus(logger)

// Create activity service
activityRepo := postgres.NewActivityRepository(pool)
activitySvc := activity.NewService(activityRepo)

// Create and register activity logger handler
activityHandler := events.NewActivityLoggerHandler(activitySvc)
activityHandler.RegisterHandlers(eventBus)

// Create services with event bus
itemRepo := postgres.NewItemRepository(pool)
itemSvc := item.NewServiceWithEvents(itemRepo, eventBus)
```

## Adding Services with Event Support

To add event support to a service:

### Option 1: Optional EventBus (Recommended)

Make the event bus optional to maintain backward compatibility:

```go
type Service struct {
    repo     Repository
    eventBus events.EventBus // optional
}

func NewService(repo Repository) *Service {
    return &Service{repo: repo}
}

func NewServiceWithEvents(repo Repository, eventBus events.EventBus) *Service {
    return &Service{
        repo:     repo,
        eventBus: eventBus,
    }
}

func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID, userID *uuid.UUID) error {
    // ... business logic ...

    // Publish event if event bus is available
    if s.eventBus != nil {
        event := events.NewItemArchivedEvent(workspaceID, id, item.Name(), userID)
        _ = s.eventBus.Publish(ctx, event) // Ignore error, log in bus
    }

    return nil
}
```

### Option 2: Required EventBus

For new services where events are central:

```go
type Service struct {
    repo     Repository
    eventBus events.EventBus
}

func NewService(repo Repository, eventBus events.EventBus) *Service {
    return &Service{
        repo:     repo,
        eventBus: eventBus,
    }
}
```

## Built-in Activity Logger Handler

The `ActivityLoggerHandler` automatically logs events to the activity log:

```go
activityHandler := events.NewActivityLoggerHandler(activityService)
activityHandler.RegisterHandlers(eventBus)
```

Supported events:
- Item: created, updated, archived, restored
- Inventory: created, moved
- Loan: created, returned

## Testing

### Testing Services Without Events

Services with optional event bus can be tested without it:

```go
func TestService_Archive(t *testing.T) {
    repo := &mockRepository{}
    svc := NewService(repo) // No event bus

    err := svc.Archive(ctx, itemID, workspaceID, userID)
    require.NoError(t, err)
}
```

### Testing with Mock Event Bus

```go
func TestService_Archive_PublishesEvent(t *testing.T) {
    repo := &mockRepository{}
    eventBus := &mockEventBus{}
    svc := NewServiceWithEvents(repo, eventBus)

    err := svc.Archive(ctx, itemID, workspaceID, userID)
    require.NoError(t, err)

    // Verify event was published
    assert.Len(t, eventBus.publishedEvents, 1)
    assert.Equal(t, "item.archived", eventBus.publishedEvents[0].EventName())
}
```

## Best Practices

1. **Events should be immutable**: Once created, event data shouldn't change
2. **Events describe what happened**: Use past tense (ItemCreated, not CreateItem)
3. **Include context**: Events should contain workspace ID, user ID, and relevant entity data
4. **Don't fail operations on event errors**: Log but don't return errors from event publishing
5. **Handlers should be idempotent**: The same event might be processed multiple times
6. **Keep events focused**: One event per business action
7. **Use BaseEvent for common fields**: Inherit from `events.BaseEvent` for consistency

## Future Enhancements

- **Async Event Bus**: Process events asynchronously with workers
- **Event Store**: Persist events for event sourcing
- **Event Replay**: Rebuild state from historical events
- **Dead Letter Queue**: Handle failed event processing
- **Distributed Events**: Publish events across services via message queue

## Adding New Event Types

To add a new event type:

1. Define the event struct in `domain_events.go`:
```go
type CategoryCreatedEvent struct {
    BaseEvent
    CategoryID uuid.UUID
    Name       string
    CreatedBy  *uuid.UUID
}

func (e CategoryCreatedEvent) EventName() string {
    return "category.created"
}

func NewCategoryCreatedEvent(workspaceID, categoryID uuid.UUID, name string, createdBy *uuid.UUID) CategoryCreatedEvent {
    return CategoryCreatedEvent{
        BaseEvent:  NewBaseEvent(workspaceID),
        CategoryID: categoryID,
        Name:       name,
        CreatedBy:  createdBy,
    }
}
```

2. Add handler in `activity_handler.go` if needed:
```go
case CategoryCreatedEvent:
    return h.activityService.Log(ctx, activity.LogInput{
        WorkspaceID: e.WorkspaceID(),
        UserID:      e.CreatedBy,
        Action:      activity.ActionCreate,
        EntityType:  activity.EntityCategory,
        EntityID:    e.CategoryID,
        EntityName:  e.Name,
        Changes:     nil,
        Metadata:    nil,
    })
```

3. Register the handler:
```go
bus.Subscribe("category.created", activityHandler.Handle)
```

4. Publish from service:
```go
event := events.NewCategoryCreatedEvent(workspaceID, category.ID(), category.Name(), userID)
_ = s.eventBus.Publish(ctx, event)
```
