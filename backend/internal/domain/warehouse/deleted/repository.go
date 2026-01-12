package deleted

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	Save(ctx context.Context, record *DeletedRecord) error
	FindSince(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*DeletedRecord, error)
	CleanupOld(ctx context.Context, before time.Time) error
}
