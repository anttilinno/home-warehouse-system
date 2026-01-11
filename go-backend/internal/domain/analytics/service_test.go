package analytics

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// MockRepository implements Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) GetDashboardStats(ctx context.Context, workspaceID uuid.UUID) (queries.GetDashboardStatsRow, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).(queries.GetDashboardStatsRow), args.Error(1)
}

func (m *MockRepository) GetCategoryStats(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetCategoryStatsRow, error) {
	args := m.Called(ctx, workspaceID, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.GetCategoryStatsRow), args.Error(1)
}

func (m *MockRepository) GetLoanStats(ctx context.Context, workspaceID uuid.UUID) (queries.GetLoanStatsRow, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).(queries.GetLoanStatsRow), args.Error(1)
}

func (m *MockRepository) GetInventoryValueByLocation(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetInventoryValueByLocationRow, error) {
	args := m.Called(ctx, workspaceID, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.GetInventoryValueByLocationRow), args.Error(1)
}

func (m *MockRepository) GetRecentActivity(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.WarehouseActivityLog, error) {
	args := m.Called(ctx, workspaceID, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseActivityLog), args.Error(1)
}

func (m *MockRepository) GetItemsByCondition(ctx context.Context, workspaceID uuid.UUID) ([]queries.GetItemsByConditionRow, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.GetItemsByConditionRow), args.Error(1)
}

func (m *MockRepository) GetItemsByStatus(ctx context.Context, workspaceID uuid.UUID) ([]queries.GetItemsByStatusRow, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.GetItemsByStatusRow), args.Error(1)
}

func (m *MockRepository) GetTopBorrowers(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]queries.GetTopBorrowersRow, error) {
	args := m.Called(ctx, workspaceID, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.GetTopBorrowersRow), args.Error(1)
}

func (m *MockRepository) GetMonthlyLoanActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]queries.GetMonthlyLoanActivityRow, error) {
	args := m.Called(ctx, workspaceID, since)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.GetMonthlyLoanActivityRow), args.Error(1)
}

// ============================================================================
// Service Tests
// ============================================================================

func TestNewService(t *testing.T) {
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)

	assert.NotNil(t, service)
}

func TestService_GetDashboardStats(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName  string
		mockSetup func(*MockRepository)
		wantErr   bool
		validate  func(*testing.T, *DashboardStats)
	}{
		{
			testName: "successful get dashboard stats",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{
					TotalItems:      100,
					TotalInventory:  500,
					TotalLocations:  10,
					TotalContainers: 25,
					ActiveLoans:     5,
					OverdueLoans:    2,
					LowStockItems:   3,
					TotalCategories: 8,
					TotalBorrowers:  15,
				}, nil)
			},
			wantErr: false,
			validate: func(t *testing.T, stats *DashboardStats) {
				assert.Equal(t, int32(100), stats.TotalItems)
				assert.Equal(t, int32(500), stats.TotalInventory)
				assert.Equal(t, int32(10), stats.TotalLocations)
				assert.Equal(t, int32(25), stats.TotalContainers)
				assert.Equal(t, int32(5), stats.ActiveLoans)
				assert.Equal(t, int32(2), stats.OverdueLoans)
				assert.Equal(t, int32(3), stats.LowStockItems)
				assert.Equal(t, int32(8), stats.TotalCategories)
				assert.Equal(t, int32(15), stats.TotalBorrowers)
			},
		},
		{
			testName: "empty stats",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, nil)
			},
			wantErr: false,
			validate: func(t *testing.T, stats *DashboardStats) {
				assert.Equal(t, int32(0), stats.TotalItems)
				assert.Equal(t, int32(0), stats.TotalInventory)
			},
		},
		{
			testName: "repository returns error",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			stats, err := service.GetDashboardStats(context.Background(), workspaceID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, stats)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, stats)
				if tt.validate != nil {
					tt.validate(t, stats)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetCategoryStats(t *testing.T) {
	workspaceID := uuid.New()
	catID1 := uuid.New()
	catID2 := uuid.New()

	tests := []struct {
		testName  string
		limit     int32
		mockSetup func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			testName: "successful get category stats",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{
					{ID: catID1, Name: "Electronics", ItemCount: 50, InventoryCount: 200, TotalValue: 50000},
					{ID: catID2, Name: "Tools", ItemCount: 30, InventoryCount: 100, TotalValue: 25000},
				}, nil)
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			testName: "zero limit defaults to 10",
			limit:    0,
			mockSetup: func(m *MockRepository) {
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "negative limit defaults to 10",
			limit:    -5,
			mockSetup: func(m *MockRepository) {
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "repository returns error",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			stats, err := service.GetCategoryStats(context.Background(), workspaceID, tt.limit)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, stats)
			} else {
				assert.NoError(t, err)
				assert.Len(t, stats, tt.wantCount)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetLoanStats(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName  string
		mockSetup func(*MockRepository)
		wantErr   bool
		validate  func(*testing.T, *LoanStats)
	}{
		{
			testName: "successful get loan stats",
			mockSetup: func(m *MockRepository) {
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{
					TotalLoans:    100,
					ActiveLoans:   10,
					ReturnedLoans: 85,
					OverdueLoans:  5,
				}, nil)
			},
			wantErr: false,
			validate: func(t *testing.T, stats *LoanStats) {
				assert.Equal(t, int32(100), stats.TotalLoans)
				assert.Equal(t, int32(10), stats.ActiveLoans)
				assert.Equal(t, int32(85), stats.ReturnedLoans)
				assert.Equal(t, int32(5), stats.OverdueLoans)
			},
		},
		{
			testName: "repository returns error",
			mockSetup: func(m *MockRepository) {
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{}, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			stats, err := service.GetLoanStats(context.Background(), workspaceID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, stats)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, stats)
				if tt.validate != nil {
					tt.validate(t, stats)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetInventoryValueByLocation(t *testing.T) {
	workspaceID := uuid.New()
	locID1 := uuid.New()
	locID2 := uuid.New()

	tests := []struct {
		testName  string
		limit     int32
		mockSetup func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			testName: "successful get inventory value by location",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return([]queries.GetInventoryValueByLocationRow{
					{ID: locID1, Name: "Warehouse A", ItemCount: 50, TotalQuantity: 200, TotalValue: 50000},
					{ID: locID2, Name: "Warehouse B", ItemCount: 30, TotalQuantity: 100, TotalValue: 25000},
				}, nil)
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			testName: "zero limit defaults to 10",
			limit:    0,
			mockSetup: func(m *MockRepository) {
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return([]queries.GetInventoryValueByLocationRow{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "repository returns error",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			values, err := service.GetInventoryValueByLocation(context.Background(), workspaceID, tt.limit)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, values)
			} else {
				assert.NoError(t, err)
				assert.Len(t, values, tt.wantCount)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetRecentActivity(t *testing.T) {
	workspaceID := uuid.New()
	actID := uuid.New()
	entityID := uuid.New()
	userID := uuid.New()
	now := time.Now()

	tests := []struct {
		testName  string
		limit     int32
		mockSetup func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			testName: "successful get recent activity with user",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				entityName := "Test Item"
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return([]queries.WarehouseActivityLog{
					{
						ID:         actID,
						UserID:     pgtype.UUID{Bytes: userID, Valid: true},
						Action:     queries.WarehouseActivityActionEnum("CREATE"),
						EntityType: queries.WarehouseActivityEntityEnum("ITEM"),
						EntityID:   entityID,
						EntityName: &entityName,
						CreatedAt:  pgtype.Timestamptz{Time: now, Valid: true},
					},
				}, nil)
			},
			wantErr:   false,
			wantCount: 1,
		},
		{
			testName: "successful get recent activity without user",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return([]queries.WarehouseActivityLog{
					{
						ID:         actID,
						UserID:     pgtype.UUID{Valid: false},
						Action:     queries.WarehouseActivityActionEnum("UPDATE"),
						EntityType: queries.WarehouseActivityEntityEnum("INVENTORY"),
						EntityID:   entityID,
						CreatedAt:  pgtype.Timestamptz{Valid: false},
					},
				}, nil)
			},
			wantErr:   false,
			wantCount: 1,
		},
		{
			testName: "zero limit defaults to 10",
			limit:    0,
			mockSetup: func(m *MockRepository) {
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return([]queries.WarehouseActivityLog{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "repository returns error",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			activities, err := service.GetRecentActivity(context.Background(), workspaceID, tt.limit)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, activities)
			} else {
				assert.NoError(t, err)
				assert.Len(t, activities, tt.wantCount)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetConditionBreakdown(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName  string
		mockSetup func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			testName: "successful get condition breakdown",
			mockSetup: func(m *MockRepository) {
				m.On("GetItemsByCondition", mock.Anything, workspaceID).Return([]queries.GetItemsByConditionRow{
					{Condition: queries.NullWarehouseItemConditionEnum{WarehouseItemConditionEnum: "new", Valid: true}, Count: 50},
					{Condition: queries.NullWarehouseItemConditionEnum{WarehouseItemConditionEnum: "good", Valid: true}, Count: 30},
					{Condition: queries.NullWarehouseItemConditionEnum{Valid: false}, Count: 10},
				}, nil)
			},
			wantErr:   false,
			wantCount: 3,
		},
		{
			testName: "empty breakdown",
			mockSetup: func(m *MockRepository) {
				m.On("GetItemsByCondition", mock.Anything, workspaceID).Return([]queries.GetItemsByConditionRow{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "repository returns error",
			mockSetup: func(m *MockRepository) {
				m.On("GetItemsByCondition", mock.Anything, workspaceID).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			breakdown, err := service.GetConditionBreakdown(context.Background(), workspaceID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, breakdown)
			} else {
				assert.NoError(t, err)
				assert.Len(t, breakdown, tt.wantCount)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetStatusBreakdown(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName  string
		mockSetup func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			testName: "successful get status breakdown",
			mockSetup: func(m *MockRepository) {
				m.On("GetItemsByStatus", mock.Anything, workspaceID).Return([]queries.GetItemsByStatusRow{
					{Status: queries.NullWarehouseItemStatusEnum{WarehouseItemStatusEnum: "active", Valid: true}, Count: 80},
					{Status: queries.NullWarehouseItemStatusEnum{WarehouseItemStatusEnum: "retired", Valid: true}, Count: 10},
					{Status: queries.NullWarehouseItemStatusEnum{Valid: false}, Count: 5},
				}, nil)
			},
			wantErr:   false,
			wantCount: 3,
		},
		{
			testName: "empty breakdown",
			mockSetup: func(m *MockRepository) {
				m.On("GetItemsByStatus", mock.Anything, workspaceID).Return([]queries.GetItemsByStatusRow{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "repository returns error",
			mockSetup: func(m *MockRepository) {
				m.On("GetItemsByStatus", mock.Anything, workspaceID).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			breakdown, err := service.GetStatusBreakdown(context.Background(), workspaceID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, breakdown)
			} else {
				assert.NoError(t, err)
				assert.Len(t, breakdown, tt.wantCount)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetTopBorrowers(t *testing.T) {
	workspaceID := uuid.New()
	borrowerID1 := uuid.New()
	borrowerID2 := uuid.New()

	tests := []struct {
		testName  string
		limit     int32
		mockSetup func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			testName: "successful get top borrowers",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				email := "borrower@example.com"
				m.On("GetTopBorrowers", mock.Anything, workspaceID, int32(10)).Return([]queries.GetTopBorrowersRow{
					{ID: borrowerID1, Name: "John Doe", Email: &email, TotalLoans: 15, ActiveLoans: 3},
					{ID: borrowerID2, Name: "Jane Smith", Email: nil, TotalLoans: 10, ActiveLoans: 1},
				}, nil)
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			testName: "zero limit defaults to 10",
			limit:    0,
			mockSetup: func(m *MockRepository) {
				m.On("GetTopBorrowers", mock.Anything, workspaceID, int32(10)).Return([]queries.GetTopBorrowersRow{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "repository returns error",
			limit:    10,
			mockSetup: func(m *MockRepository) {
				m.On("GetTopBorrowers", mock.Anything, workspaceID, int32(10)).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			borrowers, err := service.GetTopBorrowers(context.Background(), workspaceID, tt.limit)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, borrowers)
			} else {
				assert.NoError(t, err)
				assert.Len(t, borrowers, tt.wantCount)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetMonthlyLoanActivity(t *testing.T) {
	workspaceID := uuid.New()
	since := time.Now().Add(-12 * 30 * 24 * time.Hour)

	tests := []struct {
		testName  string
		mockSetup func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			testName: "successful get monthly loan activity",
			mockSetup: func(m *MockRepository) {
				m.On("GetMonthlyLoanActivity", mock.Anything, workspaceID, since).Return([]queries.GetMonthlyLoanActivityRow{
					{Month: pgtype.Date{Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), Valid: true}, LoansCreated: 10, LoansReturned: 8},
					{Month: pgtype.Date{Time: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC), Valid: true}, LoansCreated: 15, LoansReturned: 12},
				}, nil)
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			testName: "empty results",
			mockSetup: func(m *MockRepository) {
				m.On("GetMonthlyLoanActivity", mock.Anything, workspaceID, since).Return([]queries.GetMonthlyLoanActivityRow{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "invalid month timestamp",
			mockSetup: func(m *MockRepository) {
				m.On("GetMonthlyLoanActivity", mock.Anything, workspaceID, since).Return([]queries.GetMonthlyLoanActivityRow{
					{Month: pgtype.Date{Valid: false}, LoansCreated: 5, LoansReturned: 3},
				}, nil)
			},
			wantErr:   false,
			wantCount: 1,
		},
		{
			testName: "repository returns error",
			mockSetup: func(m *MockRepository) {
				m.On("GetMonthlyLoanActivity", mock.Anything, workspaceID, since).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			activity, err := service.GetMonthlyLoanActivity(context.Background(), workspaceID, since)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, activity)
			} else {
				assert.NoError(t, err)
				assert.Len(t, activity, tt.wantCount)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetAnalyticsSummary(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName  string
		mockSetup func(*MockRepository)
		wantErr   bool
	}{
		{
			testName: "successful get analytics summary",
			mockSetup: func(m *MockRepository) {
				// Dashboard stats
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{
					TotalItems:      100,
					TotalInventory:  500,
					TotalLocations:  10,
					TotalContainers: 25,
					ActiveLoans:     5,
					OverdueLoans:    2,
					LowStockItems:   3,
					TotalCategories: 8,
					TotalBorrowers:  15,
				}, nil)

				// Loan stats
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{
					TotalLoans:    100,
					ActiveLoans:   10,
					ReturnedLoans: 85,
					OverdueLoans:  5,
				}, nil)

				// Category stats
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{}, nil)

				// Location values
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return([]queries.GetInventoryValueByLocationRow{}, nil)

				// Recent activity
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return([]queries.WarehouseActivityLog{}, nil)

				// Condition breakdown
				m.On("GetItemsByCondition", mock.Anything, workspaceID).Return([]queries.GetItemsByConditionRow{}, nil)

				// Status breakdown
				m.On("GetItemsByStatus", mock.Anything, workspaceID).Return([]queries.GetItemsByStatusRow{}, nil)

				// Top borrowers
				m.On("GetTopBorrowers", mock.Anything, workspaceID, int32(5)).Return([]queries.GetTopBorrowersRow{}, nil)
			},
			wantErr: false,
		},
		{
			testName: "dashboard stats error fails summary",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, errors.New("database error"))
			},
			wantErr: true,
		},
		{
			testName: "loan stats error fails summary",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, nil)
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{}, errors.New("database error"))
			},
			wantErr: true,
		},
		{
			testName: "category stats error fails summary",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, nil)
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{}, nil)
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
		{
			testName: "location values error fails summary",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, nil)
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{}, nil)
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{}, nil)
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
		{
			testName: "recent activity error fails summary",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, nil)
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{}, nil)
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{}, nil)
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return([]queries.GetInventoryValueByLocationRow{}, nil)
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
		{
			testName: "condition breakdown error fails summary",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, nil)
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{}, nil)
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{}, nil)
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return([]queries.GetInventoryValueByLocationRow{}, nil)
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return([]queries.WarehouseActivityLog{}, nil)
				m.On("GetItemsByCondition", mock.Anything, workspaceID).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
		{
			testName: "status breakdown error fails summary",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, nil)
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{}, nil)
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{}, nil)
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return([]queries.GetInventoryValueByLocationRow{}, nil)
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return([]queries.WarehouseActivityLog{}, nil)
				m.On("GetItemsByCondition", mock.Anything, workspaceID).Return([]queries.GetItemsByConditionRow{}, nil)
				m.On("GetItemsByStatus", mock.Anything, workspaceID).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
		{
			testName: "top borrowers error fails summary",
			mockSetup: func(m *MockRepository) {
				m.On("GetDashboardStats", mock.Anything, workspaceID).Return(queries.GetDashboardStatsRow{}, nil)
				m.On("GetLoanStats", mock.Anything, workspaceID).Return(queries.GetLoanStatsRow{}, nil)
				m.On("GetCategoryStats", mock.Anything, workspaceID, int32(10)).Return([]queries.GetCategoryStatsRow{}, nil)
				m.On("GetInventoryValueByLocation", mock.Anything, workspaceID, int32(10)).Return([]queries.GetInventoryValueByLocationRow{}, nil)
				m.On("GetRecentActivity", mock.Anything, workspaceID, int32(10)).Return([]queries.WarehouseActivityLog{}, nil)
				m.On("GetItemsByCondition", mock.Anything, workspaceID).Return([]queries.GetItemsByConditionRow{}, nil)
				m.On("GetItemsByStatus", mock.Anything, workspaceID).Return([]queries.GetItemsByStatusRow{}, nil)
				m.On("GetTopBorrowers", mock.Anything, workspaceID, int32(5)).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			summary, err := service.GetAnalyticsSummary(context.Background(), workspaceID)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, summary)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, summary)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// ============================================================================
// Helper Function Tests
// ============================================================================

func TestTimeToPgTimestamptz(t *testing.T) {
	t.Run("valid time", func(t *testing.T) {
		now := time.Now()
		result := timeToPgTimestamptz(now)
		assert.True(t, result.Valid)
		assert.Equal(t, now, result.Time)
	})

	t.Run("zero time", func(t *testing.T) {
		var zeroTime time.Time
		result := timeToPgTimestamptz(zeroTime)
		assert.False(t, result.Valid)
	})
}

// ============================================================================
// Type Tests
// ============================================================================

func TestDashboardStats(t *testing.T) {
	stats := DashboardStats{
		TotalItems:      100,
		TotalInventory:  500,
		TotalLocations:  10,
		TotalContainers: 25,
		ActiveLoans:     5,
		OverdueLoans:    2,
		LowStockItems:   3,
		TotalCategories: 8,
		TotalBorrowers:  15,
	}

	assert.Equal(t, int32(100), stats.TotalItems)
	assert.Equal(t, int32(500), stats.TotalInventory)
	assert.Equal(t, int32(10), stats.TotalLocations)
	assert.Equal(t, int32(25), stats.TotalContainers)
	assert.Equal(t, int32(5), stats.ActiveLoans)
	assert.Equal(t, int32(2), stats.OverdueLoans)
	assert.Equal(t, int32(3), stats.LowStockItems)
	assert.Equal(t, int32(8), stats.TotalCategories)
	assert.Equal(t, int32(15), stats.TotalBorrowers)
}

func TestCategoryStats(t *testing.T) {
	id := uuid.New()
	stats := CategoryStats{
		ID:             id,
		Name:           "Electronics",
		ItemCount:      50,
		InventoryCount: 200,
		TotalValue:     50000,
	}

	assert.Equal(t, id, stats.ID)
	assert.Equal(t, "Electronics", stats.Name)
	assert.Equal(t, int32(50), stats.ItemCount)
	assert.Equal(t, int32(200), stats.InventoryCount)
	assert.Equal(t, int32(50000), stats.TotalValue)
}

func TestLoanStats(t *testing.T) {
	stats := LoanStats{
		TotalLoans:    100,
		ActiveLoans:   10,
		ReturnedLoans: 85,
		OverdueLoans:  5,
	}

	assert.Equal(t, int32(100), stats.TotalLoans)
	assert.Equal(t, int32(10), stats.ActiveLoans)
	assert.Equal(t, int32(85), stats.ReturnedLoans)
	assert.Equal(t, int32(5), stats.OverdueLoans)
}

func TestLocationInventoryValue(t *testing.T) {
	id := uuid.New()
	value := LocationInventoryValue{
		ID:            id,
		Name:          "Warehouse A",
		ItemCount:     50,
		TotalQuantity: 200,
		TotalValue:    50000,
	}

	assert.Equal(t, id, value.ID)
	assert.Equal(t, "Warehouse A", value.Name)
	assert.Equal(t, int32(50), value.ItemCount)
	assert.Equal(t, int32(200), value.TotalQuantity)
	assert.Equal(t, int32(50000), value.TotalValue)
}

func TestRecentActivity(t *testing.T) {
	id := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()
	entityName := "Test Item"
	now := time.Now()

	activity := RecentActivity{
		ID:         id,
		UserID:     &userID,
		Action:     "CREATE",
		EntityType: "ITEM",
		EntityID:   entityID,
		EntityName: &entityName,
		CreatedAt:  now,
	}

	assert.Equal(t, id, activity.ID)
	assert.Equal(t, &userID, activity.UserID)
	assert.Equal(t, "CREATE", activity.Action)
	assert.Equal(t, "ITEM", activity.EntityType)
	assert.Equal(t, entityID, activity.EntityID)
	assert.Equal(t, &entityName, activity.EntityName)
	assert.Equal(t, now, activity.CreatedAt)
}

func TestConditionBreakdown(t *testing.T) {
	breakdown := ConditionBreakdown{
		Condition: "new",
		Count:     50,
	}

	assert.Equal(t, "new", breakdown.Condition)
	assert.Equal(t, int32(50), breakdown.Count)
}

func TestStatusBreakdown(t *testing.T) {
	breakdown := StatusBreakdown{
		Status: "active",
		Count:  80,
	}

	assert.Equal(t, "active", breakdown.Status)
	assert.Equal(t, int32(80), breakdown.Count)
}

func TestTopBorrower(t *testing.T) {
	id := uuid.New()
	email := "borrower@example.com"

	borrower := TopBorrower{
		ID:          id,
		Name:        "John Doe",
		Email:       &email,
		TotalLoans:  15,
		ActiveLoans: 3,
	}

	assert.Equal(t, id, borrower.ID)
	assert.Equal(t, "John Doe", borrower.Name)
	assert.Equal(t, &email, borrower.Email)
	assert.Equal(t, int32(15), borrower.TotalLoans)
	assert.Equal(t, int32(3), borrower.ActiveLoans)
}

func TestMonthlyLoanActivity(t *testing.T) {
	month := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	activity := MonthlyLoanActivity{
		Month:         month,
		LoansCreated:  10,
		LoansReturned: 8,
	}

	assert.Equal(t, month, activity.Month)
	assert.Equal(t, int32(10), activity.LoansCreated)
	assert.Equal(t, int32(8), activity.LoansReturned)
}

func TestAnalyticsSummary(t *testing.T) {
	summary := AnalyticsSummary{
		Dashboard: DashboardStats{
			TotalItems: 100,
		},
		LoanStats: LoanStats{
			TotalLoans: 50,
		},
		CategoryStats:      []CategoryStats{},
		LocationValues:     []LocationInventoryValue{},
		RecentActivity:     []RecentActivity{},
		ConditionBreakdown: []ConditionBreakdown{},
		StatusBreakdown:    []StatusBreakdown{},
		TopBorrowers:       []TopBorrower{},
	}

	assert.Equal(t, int32(100), summary.Dashboard.TotalItems)
	assert.Equal(t, int32(50), summary.LoanStats.TotalLoans)
	assert.Empty(t, summary.CategoryStats)
	assert.Empty(t, summary.LocationValues)
	assert.Empty(t, summary.RecentActivity)
	assert.Empty(t, summary.ConditionBreakdown)
	assert.Empty(t, summary.StatusBreakdown)
	assert.Empty(t, summary.TopBorrowers)
}
