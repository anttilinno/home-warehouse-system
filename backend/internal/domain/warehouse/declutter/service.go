package declutter

import (
	"context"

	"github.com/google/uuid"
)

// Service implements declutter business logic.
type Service struct {
	repo Repository
}

// NewService creates a new declutter service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListUnusedResult contains the result of listing unused inventory.
type ListUnusedResult struct {
	Items []DeclutterItem
	Total int
}

// ListUnused returns unused inventory items with calculated scores.
func (s *Service) ListUnused(ctx context.Context, params ListParams) (*ListUnusedResult, error) {
	// Get items from repository
	items, err := s.repo.FindUnused(ctx, params)
	if err != nil {
		return nil, err
	}

	// Get total count for pagination
	total, err := s.repo.CountUnused(ctx, params.WorkspaceID, params.ThresholdDays)
	if err != nil {
		return nil, err
	}

	// Get max value for score calculation
	maxValue, err := s.repo.GetMaxValue(ctx, params.WorkspaceID)
	if err != nil {
		return nil, err
	}

	// Calculate scores for each item
	for i := range items {
		valueCents := 0
		if items[i].PurchasePrice != nil {
			valueCents = *items[i].PurchasePrice
		}
		items[i].Score = CalculateScore(
			items[i].DaysUnused,
			params.ThresholdDays,
			valueCents,
			maxValue,
		)
	}

	return &ListUnusedResult{
		Items: items,
		Total: total,
	}, nil
}

// GetCounts returns summary counts of unused inventory at different thresholds.
func (s *Service) GetCounts(ctx context.Context, workspaceID uuid.UUID) (*DeclutterCounts, error) {
	return s.repo.GetCounts(ctx, workspaceID)
}

// MarkUsed updates the last_used_at timestamp to current time.
func (s *Service) MarkUsed(ctx context.Context, inventoryID, workspaceID uuid.UUID) error {
	return s.repo.MarkUsed(ctx, inventoryID, workspaceID)
}
