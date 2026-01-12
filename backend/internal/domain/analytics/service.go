package analytics

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// Repository defines the interface for analytics data access
type Repository interface {
	GetDashboardStats(ctx context.Context, workspaceID uuid.UUID) (queries.GetDashboardStatsRow, error)
	GetCategoryStats(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetCategoryStatsRow, error)
	GetLoanStats(ctx context.Context, workspaceID uuid.UUID) (queries.GetLoanStatsRow, error)
	GetInventoryValueByLocation(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetInventoryValueByLocationRow, error)
	GetRecentActivity(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.WarehouseActivityLog, error)
	GetItemsByCondition(ctx context.Context, workspaceID uuid.UUID) ([]queries.GetItemsByConditionRow, error)
	GetItemsByStatus(ctx context.Context, workspaceID uuid.UUID) ([]queries.GetItemsByStatusRow, error)
	GetTopBorrowers(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetTopBorrowersRow, error)
	GetMonthlyLoanActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]queries.GetMonthlyLoanActivityRow, error)
}

// Service handles analytics operations
type Service struct {
	repo Repository
}

// NewService creates a new analytics service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetDashboardStats returns overall workspace statistics
func (s *Service) GetDashboardStats(ctx context.Context, workspaceID uuid.UUID) (*DashboardStats, error) {
	stats, err := s.repo.GetDashboardStats(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	return &DashboardStats{
		TotalItems:      stats.TotalItems,
		TotalInventory:  stats.TotalInventory,
		TotalLocations:  stats.TotalLocations,
		TotalContainers: stats.TotalContainers,
		ActiveLoans:     stats.ActiveLoans,
		OverdueLoans:    stats.OverdueLoans,
		LowStockItems:   stats.LowStockItems,
		TotalCategories: stats.TotalCategories,
		TotalBorrowers:  stats.TotalBorrowers,
	}, nil
}

// GetCategoryStats returns statistics per category
func (s *Service) GetCategoryStats(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]CategoryStats, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.repo.GetCategoryStats(ctx, workspaceID, limit)
	if err != nil {
		return nil, err
	}

	result := make([]CategoryStats, len(rows))
	for i, row := range rows {
		result[i] = CategoryStats{
			ID:             row.ID,
			Name:           row.Name,
			ItemCount:      row.ItemCount,
			InventoryCount: row.InventoryCount,
			TotalValue:     row.TotalValue,
		}
	}
	return result, nil
}

// GetLoanStats returns loan statistics
func (s *Service) GetLoanStats(ctx context.Context, workspaceID uuid.UUID) (*LoanStats, error) {
	stats, err := s.repo.GetLoanStats(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	return &LoanStats{
		TotalLoans:    stats.TotalLoans,
		ActiveLoans:   stats.ActiveLoans,
		ReturnedLoans: stats.ReturnedLoans,
		OverdueLoans:  stats.OverdueLoans,
	}, nil
}

// GetInventoryValueByLocation returns inventory value per location
func (s *Service) GetInventoryValueByLocation(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]LocationInventoryValue, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.repo.GetInventoryValueByLocation(ctx, workspaceID, limit)
	if err != nil {
		return nil, err
	}

	result := make([]LocationInventoryValue, len(rows))
	for i, row := range rows {
		result[i] = LocationInventoryValue{
			ID:            row.ID,
			Name:          row.Name,
			ItemCount:     row.ItemCount,
			TotalQuantity: row.TotalQuantity,
			TotalValue:    row.TotalValue,
		}
	}
	return result, nil
}

// GetRecentActivity returns recent activity log entries
func (s *Service) GetRecentActivity(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]RecentActivity, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.repo.GetRecentActivity(ctx, workspaceID, limit)
	if err != nil {
		return nil, err
	}

	result := make([]RecentActivity, len(rows))
	for i, row := range rows {
		var userID *uuid.UUID
		if row.UserID.Valid {
			id := uuid.UUID(row.UserID.Bytes)
			userID = &id
		}

		var createdAt time.Time
		if row.CreatedAt.Valid {
			createdAt = row.CreatedAt.Time
		}

		result[i] = RecentActivity{
			ID:         row.ID,
			UserID:     userID,
			Action:     string(row.Action),
			EntityType: string(row.EntityType),
			EntityID:   row.EntityID,
			EntityName: row.EntityName,
			CreatedAt:  createdAt,
		}
	}
	return result, nil
}

// GetConditionBreakdown returns inventory count by condition
func (s *Service) GetConditionBreakdown(ctx context.Context, workspaceID uuid.UUID) ([]ConditionBreakdown, error) {
	rows, err := s.repo.GetItemsByCondition(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	result := make([]ConditionBreakdown, len(rows))
	for i, row := range rows {
		condition := ""
		if row.Condition.Valid {
			condition = string(row.Condition.WarehouseItemConditionEnum)
		}
		result[i] = ConditionBreakdown{
			Condition: condition,
			Count:     row.Count,
		}
	}
	return result, nil
}

// GetStatusBreakdown returns inventory count by status
func (s *Service) GetStatusBreakdown(ctx context.Context, workspaceID uuid.UUID) ([]StatusBreakdown, error) {
	rows, err := s.repo.GetItemsByStatus(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	result := make([]StatusBreakdown, len(rows))
	for i, row := range rows {
		status := ""
		if row.Status.Valid {
			status = string(row.Status.WarehouseItemStatusEnum)
		}
		result[i] = StatusBreakdown{
			Status: status,
			Count:  row.Count,
		}
	}
	return result, nil
}

// GetTopBorrowers returns top borrowers by loan count
func (s *Service) GetTopBorrowers(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]TopBorrower, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.repo.GetTopBorrowers(ctx, workspaceID, limit)
	if err != nil {
		return nil, err
	}

	result := make([]TopBorrower, len(rows))
	for i, row := range rows {
		result[i] = TopBorrower{
			ID:          row.ID,
			Name:        row.Name,
			Email:       row.Email,
			TotalLoans:  row.TotalLoans,
			ActiveLoans: row.ActiveLoans,
		}
	}
	return result, nil
}

// GetMonthlyLoanActivity returns loan activity per month
func (s *Service) GetMonthlyLoanActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]MonthlyLoanActivity, error) {
	rows, err := s.repo.GetMonthlyLoanActivity(ctx, workspaceID, since)
	if err != nil {
		return nil, err
	}

	result := make([]MonthlyLoanActivity, len(rows))
	for i, row := range rows {
		var month time.Time
		if row.Month.Valid {
			month = row.Month.Time
		}
		result[i] = MonthlyLoanActivity{
			Month:         month,
			LoansCreated:  row.LoansCreated,
			LoansReturned: row.LoansReturned,
		}
	}
	return result, nil
}

// GetAnalyticsSummary returns a complete analytics summary
func (s *Service) GetAnalyticsSummary(ctx context.Context, workspaceID uuid.UUID) (*AnalyticsSummary, error) {
	// Get dashboard stats
	dashboard, err := s.GetDashboardStats(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	// Get loan stats
	loanStats, err := s.GetLoanStats(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	// Get category stats (top 10)
	categoryStats, err := s.GetCategoryStats(ctx, workspaceID, 10)
	if err != nil {
		return nil, err
	}

	// Get location values (top 10)
	locationValues, err := s.GetInventoryValueByLocation(ctx, workspaceID, 10)
	if err != nil {
		return nil, err
	}

	// Get recent activity (last 10)
	recentActivity, err := s.GetRecentActivity(ctx, workspaceID, 10)
	if err != nil {
		return nil, err
	}

	// Get condition breakdown
	conditionBreakdown, err := s.GetConditionBreakdown(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	// Get status breakdown
	statusBreakdown, err := s.GetStatusBreakdown(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	// Get top borrowers
	topBorrowers, err := s.GetTopBorrowers(ctx, workspaceID, 5)
	if err != nil {
		return nil, err
	}

	return &AnalyticsSummary{
		Dashboard:          *dashboard,
		LoanStats:          *loanStats,
		CategoryStats:      categoryStats,
		LocationValues:     locationValues,
		RecentActivity:     recentActivity,
		ConditionBreakdown: conditionBreakdown,
		StatusBreakdown:    statusBreakdown,
		TopBorrowers:       topBorrowers,
	}, nil
}

// Helper to convert time to pgtype.Timestamptz
func timeToPgTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{
		Time:  t,
		Valid: !t.IsZero(),
	}
}
