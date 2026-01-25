package declutter

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for declutter data access.
type Repository interface {
	// FindUnused returns inventory items that haven't been used for the specified threshold.
	FindUnused(ctx context.Context, params ListParams) ([]DeclutterItem, error)

	// CountUnused returns the total count of unused inventory for pagination.
	CountUnused(ctx context.Context, workspaceID uuid.UUID, thresholdDays int) (int, error)

	// GetCounts returns summary counts of unused inventory at 90/180/365 day thresholds.
	GetCounts(ctx context.Context, workspaceID uuid.UUID) (*DeclutterCounts, error)

	// GetMaxValue returns the maximum purchase price in the workspace for percentile calculation.
	GetMaxValue(ctx context.Context, workspaceID uuid.UUID) (int, error)

	// MarkUsed updates the last_used_at timestamp to current time.
	MarkUsed(ctx context.Context, inventoryID, workspaceID uuid.UUID) error
}
