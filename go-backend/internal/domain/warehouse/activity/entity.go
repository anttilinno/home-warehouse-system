package activity

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Action string

const (
	ActionCreate Action = "CREATE"
	ActionUpdate Action = "UPDATE"
	ActionDelete Action = "DELETE"
	ActionMove   Action = "MOVE"
	ActionLoan   Action = "LOAN"
	ActionReturn Action = "RETURN"
)

func (a Action) IsValid() bool {
	switch a {
	case ActionCreate, ActionUpdate, ActionDelete, ActionMove, ActionLoan, ActionReturn:
		return true
	}
	return false
}

type EntityType string

const (
	EntityItem      EntityType = "ITEM"
	EntityInventory EntityType = "INVENTORY"
	EntityLocation  EntityType = "LOCATION"
	EntityContainer EntityType = "CONTAINER"
	EntityCategory  EntityType = "CATEGORY"
	EntityLabel     EntityType = "LABEL"
	EntityLoan      EntityType = "LOAN"
	EntityBorrower  EntityType = "BORROWER"
	EntityCompany   EntityType = "COMPANY"
)

func (e EntityType) IsValid() bool {
	switch e {
	case EntityItem, EntityInventory, EntityLocation, EntityContainer,
		EntityCategory, EntityLabel, EntityLoan, EntityBorrower, EntityCompany:
		return true
	}
	return false
}

type ActivityLog struct {
	id         uuid.UUID
	workspaceID uuid.UUID
	userID     *uuid.UUID
	action     Action
	entityType EntityType
	entityID   uuid.UUID
	entityName string
	changes    map[string]interface{}
	metadata   map[string]interface{}
	createdAt  time.Time
}

func NewActivityLog(
	workspaceID uuid.UUID,
	userID *uuid.UUID,
	action Action,
	entityType EntityType,
	entityID uuid.UUID,
	entityName string,
	changes, metadata map[string]interface{},
) (*ActivityLog, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if !action.IsValid() {
		return nil, ErrInvalidAction
	}
	if !entityType.IsValid() {
		return nil, ErrInvalidEntityType
	}
	if err := shared.ValidateUUID(entityID, "entity_id"); err != nil {
		return nil, err
	}

	return &ActivityLog{
		id:         shared.NewUUID(),
		workspaceID: workspaceID,
		userID:     userID,
		action:     action,
		entityType: entityType,
		entityID:   entityID,
		entityName: entityName,
		changes:    changes,
		metadata:   metadata,
		createdAt:  time.Now(),
	}, nil
}

func Reconstruct(
	id, workspaceID uuid.UUID,
	userID *uuid.UUID,
	action Action,
	entityType EntityType,
	entityID uuid.UUID,
	entityName string,
	changes, metadata map[string]interface{},
	createdAt time.Time,
) *ActivityLog {
	return &ActivityLog{
		id:         id,
		workspaceID: workspaceID,
		userID:     userID,
		action:     action,
		entityType: entityType,
		entityID:   entityID,
		entityName: entityName,
		changes:    changes,
		metadata:   metadata,
		createdAt:  createdAt,
	}
}

// Getters
func (a *ActivityLog) ID() uuid.UUID                      { return a.id }
func (a *ActivityLog) WorkspaceID() uuid.UUID             { return a.workspaceID }
func (a *ActivityLog) UserID() *uuid.UUID                 { return a.userID }
func (a *ActivityLog) Action() Action                     { return a.action }
func (a *ActivityLog) EntityType() EntityType             { return a.entityType }
func (a *ActivityLog) EntityID() uuid.UUID                { return a.entityID }
func (a *ActivityLog) EntityName() string                 { return a.entityName }
func (a *ActivityLog) Changes() map[string]interface{}    { return a.changes }
func (a *ActivityLog) Metadata() map[string]interface{}   { return a.metadata }
func (a *ActivityLog) CreatedAt() time.Time               { return a.createdAt }
