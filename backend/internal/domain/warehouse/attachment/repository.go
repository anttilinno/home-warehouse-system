package attachment

import (
	"context"

	"github.com/google/uuid"
)

type FileRepository interface {
	Save(ctx context.Context, file *File) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*File, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}

type AttachmentRepository interface {
	Save(ctx context.Context, attachment *Attachment) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Attachment, error)
	FindByItem(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*Attachment, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	SetPrimaryForItem(ctx context.Context, itemID, attachmentID, workspaceID uuid.UUID) error
}
