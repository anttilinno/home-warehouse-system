package activity

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, log *ActivityLog) error
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error)
	FindByEntity(ctx context.Context, workspaceID uuid.UUID, entityType EntityType, entityID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error)
	FindByUser(ctx context.Context, workspaceID, userID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error)
	FindRecentActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*ActivityLog, error)
}
