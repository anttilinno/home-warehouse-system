package importjob

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	// ImportJob operations
	SaveJob(ctx context.Context, job *ImportJob) error
	FindJobByID(ctx context.Context, id, workspaceID uuid.UUID) (*ImportJob, error)
	FindJobsByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*ImportJob, int, error)
	FindJobsByStatus(ctx context.Context, status ImportStatus, limit int) ([]*ImportJob, error)
	DeleteJob(ctx context.Context, id uuid.UUID) error

	// ImportError operations
	SaveError(ctx context.Context, error *ImportError) error
	FindErrorsByJobID(ctx context.Context, jobID uuid.UUID) ([]*ImportError, error)
	DeleteErrorsByJobID(ctx context.Context, jobID uuid.UUID) error
}
