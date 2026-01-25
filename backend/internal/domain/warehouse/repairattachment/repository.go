package repairattachment

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for repair attachment persistence.
type Repository interface {
	Create(ctx context.Context, ra *RepairAttachment) error
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairAttachment, error)
	ListByRepairLog(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*RepairAttachmentWithFile, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}
