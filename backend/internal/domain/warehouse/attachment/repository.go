package attachment

import (
	"context"

	"github.com/google/uuid"
)

type FileRepository interface {
	Save(ctx context.Context, file *File) error
	FindByID(ctx context.Context, id uuid.UUID) (*File, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type AttachmentRepository interface {
	Save(ctx context.Context, attachment *Attachment) error
	FindByID(ctx context.Context, id uuid.UUID) (*Attachment, error)
	FindByItem(ctx context.Context, itemID uuid.UUID) ([]*Attachment, error)
	Delete(ctx context.Context, id uuid.UUID) error
	SetPrimaryForItem(ctx context.Context, itemID, attachmentID uuid.UUID) error
}
