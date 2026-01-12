package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// AnalyticsRepository handles analytics-related database operations
type AnalyticsRepository struct {
	q *queries.Queries
}

// NewAnalyticsRepository creates a new analytics repository from a pool
func NewAnalyticsRepository(pool *pgxpool.Pool) *AnalyticsRepository {
	return &AnalyticsRepository{q: queries.New(pool)}
}

// NewAnalyticsRepositoryFromQueries creates a new analytics repository from queries
func NewAnalyticsRepositoryFromQueries(q *queries.Queries) *AnalyticsRepository {
	return &AnalyticsRepository{q: q}
}

// GetDashboardStats returns overall workspace statistics
func (r *AnalyticsRepository) GetDashboardStats(ctx context.Context, workspaceID uuid.UUID) (queries.GetDashboardStatsRow, error) {
	return r.q.GetDashboardStats(ctx, workspaceID)
}

// GetCategoryStats returns statistics per category
func (r *AnalyticsRepository) GetCategoryStats(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetCategoryStatsRow, error) {
	return r.q.GetCategoryStats(ctx, queries.GetCategoryStatsParams{
		WorkspaceID: workspaceID,
		Limit:       limit,
	})
}

// GetLoanStats returns loan statistics
func (r *AnalyticsRepository) GetLoanStats(ctx context.Context, workspaceID uuid.UUID) (queries.GetLoanStatsRow, error) {
	return r.q.GetLoanStats(ctx, workspaceID)
}

// GetInventoryValueByLocation returns inventory value per location
func (r *AnalyticsRepository) GetInventoryValueByLocation(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetInventoryValueByLocationRow, error) {
	return r.q.GetInventoryValueByLocation(ctx, queries.GetInventoryValueByLocationParams{
		WorkspaceID: workspaceID,
		Limit:       limit,
	})
}

// GetRecentActivity returns recent activity log entries
func (r *AnalyticsRepository) GetRecentActivity(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.WarehouseActivityLog, error) {
	return r.q.GetRecentActivity(ctx, queries.GetRecentActivityParams{
		WorkspaceID: workspaceID,
		Limit:       limit,
	})
}

// GetItemsByCondition returns inventory count by condition
func (r *AnalyticsRepository) GetItemsByCondition(ctx context.Context, workspaceID uuid.UUID) ([]queries.GetItemsByConditionRow, error) {
	return r.q.GetItemsByCondition(ctx, workspaceID)
}

// GetItemsByStatus returns inventory count by status
func (r *AnalyticsRepository) GetItemsByStatus(ctx context.Context, workspaceID uuid.UUID) ([]queries.GetItemsByStatusRow, error) {
	return r.q.GetItemsByStatus(ctx, workspaceID)
}

// GetTopBorrowers returns top borrowers by loan count
func (r *AnalyticsRepository) GetTopBorrowers(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetTopBorrowersRow, error) {
	return r.q.GetTopBorrowers(ctx, queries.GetTopBorrowersParams{
		WorkspaceID: workspaceID,
		Limit:       limit,
	})
}

// GetMonthlyLoanActivity returns loan activity per month
func (r *AnalyticsRepository) GetMonthlyLoanActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]queries.GetMonthlyLoanActivityRow, error) {
	return r.q.GetMonthlyLoanActivity(ctx, queries.GetMonthlyLoanActivityParams{
		WorkspaceID: workspaceID,
		LoanedAt: pgtype.Timestamptz{
			Time:  since,
			Valid: !since.IsZero(),
		},
	})
}
