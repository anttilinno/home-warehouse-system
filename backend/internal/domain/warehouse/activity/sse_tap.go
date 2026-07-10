package activity

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// tapWriteTimeout bounds a single audit-row insert triggered by an SSE publish.
const tapWriteTimeout = 5 * time.Second

// tapEntityTypes maps the lowercase entity_type carried on SSE events to the
// warehouse.activity_entity_enum values. Entity types absent from the DB enum
// (company) and non-entity events (pendingchange, wishlist, maintenance,
// repairlog, photos, import…) are deliberately omitted and skipped silently.
//
// Skipping pendingchange is also what keeps an approved change from producing two
// rows: the pendingchange.approved event is ignored and the entity event that the
// approval publishes (item.created …) is the one that gets logged.
var tapEntityTypes = map[string]EntityType{
	"item":      EntityItem,
	"inventory": EntityInventory,
	"location":  EntityLocation,
	"container": EntityContainer,
	"category":  EntityCategory,
	"label":     EntityLabel,
	"loan":      EntityLoan,
	"borrower":  EntityBorrower,
}

// tapActions maps an event-type suffix to an activity action. archive publishes
// `.deleted` for most entities and `.archived` for borrower; restore publishes
// `.created` / `.restored` respectively — both spellings map to the same action.
// Unlisted suffixes (marked_used…) are skipped.
var tapActions = map[string]Action{
	"created":  ActionCreate,
	"restored": ActionCreate,
	"updated":  ActionUpdate,
	"deleted":  ActionDelete,
	"archived": ActionDelete,
	"returned": ActionReturn,
	"moved":    ActionMove,
}

// NewEventTap returns a Broadcaster tap that mirrors entity SSE events into the
// activity log. Wire it once at startup: broadcaster.SetTap(activity.NewEventTap(svc, logger)).
func NewEventTap(svc ServiceInterface, logger *slog.Logger) func(uuid.UUID, events.Event) {
	return func(workspaceID uuid.UUID, e events.Event) {
		input, ok := eventToLogInput(workspaceID, e)
		if !ok {
			return
		}

		// ponytail: one goroutine per event, bounded by request rate; queue if it ever matters.
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), tapWriteTimeout)
			defer cancel()

			if err := svc.Log(ctx, input); err != nil {
				logger.Error("activity tap: failed to write activity log",
					"error", err, "event_type", e.Type, "entity_id", e.EntityID)
			}
		}()
	}
}

// eventToLogInput maps an SSE event onto an activity LogInput. The bool reports
// whether the event is auditable at all; unmappable events are dropped silently.
func eventToLogInput(workspaceID uuid.UUID, e events.Event) (LogInput, bool) {
	entityType, ok := tapEntityTypes[e.EntityType]
	if !ok {
		return LogInput{}, false
	}

	dot := strings.LastIndex(e.Type, ".")
	if dot < 0 {
		return LogInput{}, false
	}
	action, ok := tapActions[e.Type[dot+1:]]
	if !ok {
		return LogInput{}, false
	}
	// A new loan is a LOAN action, not a generic CREATE.
	if entityType == EntityLoan && action == ActionCreate {
		action = ActionLoan
	}

	// NewActivityLog rejects uuid.Nil, so an unparsable entity ID cannot be logged.
	entityID, err := uuid.Parse(e.EntityID)
	if err != nil {
		return LogInput{}, false
	}

	// The actor is nil for system-published events (no authenticated user).
	var userID *uuid.UUID
	if e.UserID != uuid.Nil {
		userID = &e.UserID
	}

	// Best-effort: lifecycle events carry only user_name, not the entity name.
	entityName, _ := e.Data["name"].(string)

	return LogInput{
		WorkspaceID: workspaceID,
		UserID:      userID,
		Action:      action,
		EntityType:  entityType,
		EntityID:    entityID,
		EntityName:  entityName,
		Metadata:    e.Data,
	}, true
}
