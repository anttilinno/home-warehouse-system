package deleted

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type DeletedRecord struct {
	id          uuid.UUID
	workspaceID uuid.UUID
	entityType  activity.EntityType
	entityID    uuid.UUID
	deletedAt   time.Time
	deletedBy   *uuid.UUID
}

func NewDeletedRecord(
	workspaceID uuid.UUID,
	entityType activity.EntityType,
	entityID uuid.UUID,
	deletedBy *uuid.UUID,
) (*DeletedRecord, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if !entityType.IsValid() {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "entity_type", "invalid entity type")
	}
	if err := shared.ValidateUUID(entityID, "entity_id"); err != nil {
		return nil, err
	}

	return &DeletedRecord{
		id:          shared.NewUUID(),
		workspaceID: workspaceID,
		entityType:  entityType,
		entityID:    entityID,
		deletedAt:   time.Now(),
		deletedBy:   deletedBy,
	}, nil
}

func Reconstruct(
	id, workspaceID uuid.UUID,
	entityType activity.EntityType,
	entityID uuid.UUID,
	deletedAt time.Time,
	deletedBy *uuid.UUID,
) *DeletedRecord {
	return &DeletedRecord{
		id:          id,
		workspaceID: workspaceID,
		entityType:  entityType,
		entityID:    entityID,
		deletedAt:   deletedAt,
		deletedBy:   deletedBy,
	}
}

// Getters
func (d *DeletedRecord) ID() uuid.UUID                 { return d.id }
func (d *DeletedRecord) WorkspaceID() uuid.UUID        { return d.workspaceID }
func (d *DeletedRecord) EntityType() activity.EntityType { return d.entityType }
func (d *DeletedRecord) EntityID() uuid.UUID           { return d.entityID }
func (d *DeletedRecord) DeletedAt() time.Time          { return d.deletedAt }
func (d *DeletedRecord) DeletedBy() *uuid.UUID         { return d.deletedBy }
