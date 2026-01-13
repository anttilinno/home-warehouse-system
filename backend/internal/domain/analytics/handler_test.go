package analytics_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/analytics"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements analytics.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) GetDashboardStats(ctx context.Context, workspaceID uuid.UUID) (*analytics.DashboardStats, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*analytics.DashboardStats), args.Error(1)
}

func (m *MockService) GetCategoryStats(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]analytics.CategoryStats, error) {
	args := m.Called(ctx, workspaceID, limit)
	return args.Get(0).([]analytics.CategoryStats), args.Error(1)
}

func (m *MockService) GetLoanStats(ctx context.Context, workspaceID uuid.UUID) (*analytics.LoanStats, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*analytics.LoanStats), args.Error(1)
}

func (m *MockService) GetInventoryValueByLocation(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]analytics.LocationInventoryValue, error) {
	args := m.Called(ctx, workspaceID, limit)
	return args.Get(0).([]analytics.LocationInventoryValue), args.Error(1)
}

func (m *MockService) GetRecentActivity(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]analytics.RecentActivity, error) {
	args := m.Called(ctx, workspaceID, limit)
	return args.Get(0).([]analytics.RecentActivity), args.Error(1)
}

func (m *MockService) GetConditionBreakdown(ctx context.Context, workspaceID uuid.UUID) ([]analytics.ConditionBreakdown, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).([]analytics.ConditionBreakdown), args.Error(1)
}

func (m *MockService) GetStatusBreakdown(ctx context.Context, workspaceID uuid.UUID) ([]analytics.StatusBreakdown, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).([]analytics.StatusBreakdown), args.Error(1)
}

func (m *MockService) GetTopBorrowers(ctx context.Context, workspaceID uuid.UUID, limit int32) ([]analytics.TopBorrower, error) {
	args := m.Called(ctx, workspaceID, limit)
	return args.Get(0).([]analytics.TopBorrower), args.Error(1)
}

func (m *MockService) GetMonthlyLoanActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]analytics.MonthlyLoanActivity, error) {
	args := m.Called(ctx, workspaceID, since)
	return args.Get(0).([]analytics.MonthlyLoanActivity), args.Error(1)
}

func (m *MockService) GetAnalyticsSummary(ctx context.Context, workspaceID uuid.UUID) (*analytics.AnalyticsSummary, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*analytics.AnalyticsSummary), args.Error(1)
}

// Tests

func TestAnalyticsHandler_GetDashboardStats(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets dashboard stats successfully", func(t *testing.T) {
		stats := &analytics.DashboardStats{
			TotalItems:      100,
			TotalInventory:  250,
			TotalLocations:  10,
			TotalContainers: 5,
			ActiveLoans:     3,
			OverdueLoans:    1,
			LowStockItems:   2,
			TotalCategories: 15,
			TotalBorrowers:  8,
		}

		mockSvc.On("GetDashboardStats", mock.Anything, setup.WorkspaceID).
			Return(stats, nil).Once()

		rec := setup.Get("/analytics/dashboard")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("GetDashboardStats", mock.Anything, setup.WorkspaceID).
			Return(nil, fmt.Errorf("test error")).Once()

		rec := setup.Get("/analytics/dashboard")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetCategoryStats(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets category stats successfully", func(t *testing.T) {
		stats := []analytics.CategoryStats{
			{
				ID:             uuid.New(),
				Name:           "Electronics",
				ItemCount:      50,
				InventoryCount: 100,
				TotalValue:     50000,
			},
			{
				ID:             uuid.New(),
				Name:           "Tools",
				ItemCount:      30,
				InventoryCount: 75,
				TotalValue:     30000,
			},
		}

		mockSvc.On("GetCategoryStats", mock.Anything, setup.WorkspaceID, int32(10)).
			Return(stats, nil).Once()

		rec := setup.Get("/analytics/categories")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles custom limit", func(t *testing.T) {
		mockSvc.On("GetCategoryStats", mock.Anything, setup.WorkspaceID, int32(20)).
			Return([]analytics.CategoryStats{}, nil).Once()

		rec := setup.Get("/analytics/categories?limit=20")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no categories", func(t *testing.T) {
		mockSvc.On("GetCategoryStats", mock.Anything, setup.WorkspaceID, int32(10)).
			Return([]analytics.CategoryStats{}, nil).Once()

		rec := setup.Get("/analytics/categories")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetLoanStats(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets loan stats successfully", func(t *testing.T) {
		stats := &analytics.LoanStats{
			TotalLoans:    50,
			ActiveLoans:   10,
			ReturnedLoans: 38,
			OverdueLoans:  2,
		}

		mockSvc.On("GetLoanStats", mock.Anything, setup.WorkspaceID).
			Return(stats, nil).Once()

		rec := setup.Get("/analytics/loans")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("GetLoanStats", mock.Anything, setup.WorkspaceID).
			Return(nil, fmt.Errorf("test error")).Once()

		rec := setup.Get("/analytics/loans")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetLocationValues(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets location values successfully", func(t *testing.T) {
		values := []analytics.LocationInventoryValue{
			{
				ID:            uuid.New(),
				Name:          "Warehouse A",
				ItemCount:     100,
				TotalQuantity: 500,
				TotalValue:    100000,
			},
		}

		mockSvc.On("GetInventoryValueByLocation", mock.Anything, setup.WorkspaceID, int32(10)).
			Return(values, nil).Once()

		rec := setup.Get("/analytics/locations")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles custom limit", func(t *testing.T) {
		mockSvc.On("GetInventoryValueByLocation", mock.Anything, setup.WorkspaceID, int32(25)).
			Return([]analytics.LocationInventoryValue{}, nil).Once()

		rec := setup.Get("/analytics/locations?limit=25")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetRecentActivity(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets recent activity successfully", func(t *testing.T) {
		userID := uuid.New()
		entityName := "Test Item"
		activities := []analytics.RecentActivity{
			{
				ID:         uuid.New(),
				UserID:     &userID,
				Action:     "CREATE",
				EntityType: "item",
				EntityID:   uuid.New(),
				EntityName: &entityName,
				CreatedAt:  time.Now(),
			},
		}

		mockSvc.On("GetRecentActivity", mock.Anything, setup.WorkspaceID, int32(10)).
			Return(activities, nil).Once()

		rec := setup.Get("/analytics/activity")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles custom limit", func(t *testing.T) {
		mockSvc.On("GetRecentActivity", mock.Anything, setup.WorkspaceID, int32(50)).
			Return([]analytics.RecentActivity{}, nil).Once()

		rec := setup.Get("/analytics/activity?limit=50")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetConditionBreakdown(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets condition breakdown successfully", func(t *testing.T) {
		breakdown := []analytics.ConditionBreakdown{
			{Condition: "NEW", Count: 50},
			{Condition: "GOOD", Count: 30},
			{Condition: "FAIR", Count: 20},
		}

		mockSvc.On("GetConditionBreakdown", mock.Anything, setup.WorkspaceID).
			Return(breakdown, nil).Once()

		rec := setup.Get("/analytics/conditions")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("GetConditionBreakdown", mock.Anything, setup.WorkspaceID).
			Return([]analytics.ConditionBreakdown{}, fmt.Errorf("test error")).Once()

		rec := setup.Get("/analytics/conditions")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetStatusBreakdown(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets status breakdown successfully", func(t *testing.T) {
		breakdown := []analytics.StatusBreakdown{
			{Status: "AVAILABLE", Count: 80},
			{Status: "ON_LOAN", Count: 15},
			{Status: "IN_TRANSIT", Count: 5},
		}

		mockSvc.On("GetStatusBreakdown", mock.Anything, setup.WorkspaceID).
			Return(breakdown, nil).Once()

		rec := setup.Get("/analytics/statuses")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("GetStatusBreakdown", mock.Anything, setup.WorkspaceID).
			Return([]analytics.StatusBreakdown{}, fmt.Errorf("test error")).Once()

		rec := setup.Get("/analytics/statuses")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetTopBorrowers(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets top borrowers successfully", func(t *testing.T) {
		email := "john@example.com"
		borrowers := []analytics.TopBorrower{
			{
				ID:          uuid.New(),
				Name:        "John Doe",
				Email:       &email,
				TotalLoans:  25,
				ActiveLoans: 3,
			},
		}

		mockSvc.On("GetTopBorrowers", mock.Anything, setup.WorkspaceID, int32(10)).
			Return(borrowers, nil).Once()

		rec := setup.Get("/analytics/borrowers")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles custom limit", func(t *testing.T) {
		mockSvc.On("GetTopBorrowers", mock.Anything, setup.WorkspaceID, int32(5)).
			Return([]analytics.TopBorrower{}, nil).Once()

		rec := setup.Get("/analytics/borrowers?limit=5")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetAnalyticsSummary(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets analytics summary successfully", func(t *testing.T) {
		summary := &analytics.AnalyticsSummary{
			Dashboard: analytics.DashboardStats{
				TotalItems:      100,
				TotalInventory:  250,
				TotalLocations:  10,
				TotalContainers: 5,
				ActiveLoans:     3,
				OverdueLoans:    1,
				LowStockItems:   2,
				TotalCategories: 15,
				TotalBorrowers:  8,
			},
			LoanStats: analytics.LoanStats{
				TotalLoans:    50,
				ActiveLoans:   10,
				ReturnedLoans: 38,
				OverdueLoans:  2,
			},
			CategoryStats:      []analytics.CategoryStats{},
			LocationValues:     []analytics.LocationInventoryValue{},
			RecentActivity:     []analytics.RecentActivity{},
			ConditionBreakdown: []analytics.ConditionBreakdown{},
			StatusBreakdown:    []analytics.StatusBreakdown{},
			TopBorrowers:       []analytics.TopBorrower{},
		}

		mockSvc.On("GetAnalyticsSummary", mock.Anything, setup.WorkspaceID).
			Return(summary, nil).Once()

		rec := setup.Get("/analytics/summary")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("GetAnalyticsSummary", mock.Anything, setup.WorkspaceID).
			Return(nil, fmt.Errorf("test error")).Once()

		rec := setup.Get("/analytics/summary")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestAnalyticsHandler_GetMonthlyLoanActivity(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	handler := analytics.NewHandler(mockSvc)
	handler.RegisterRoutes(setup.API)

	t.Run("gets monthly loan activity successfully", func(t *testing.T) {
		activity := []analytics.MonthlyLoanActivity{
			{
				Month:         time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
				LoansCreated:  10,
				LoansReturned: 8,
			},
			{
				Month:         time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC),
				LoansCreated:  15,
				LoansReturned: 12,
			},
		}

		mockSvc.On("GetMonthlyLoanActivity", mock.Anything, setup.WorkspaceID, mock.AnythingOfType("time.Time")).
			Return(activity, nil).Once()

		rec := setup.Get("/analytics/loans/monthly")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles custom months parameter", func(t *testing.T) {
		mockSvc.On("GetMonthlyLoanActivity", mock.Anything, setup.WorkspaceID, mock.AnythingOfType("time.Time")).
			Return([]analytics.MonthlyLoanActivity{}, nil).Once()

		rec := setup.Get("/analytics/loans/monthly?months=6")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles service error", func(t *testing.T) {
		mockSvc.On("GetMonthlyLoanActivity", mock.Anything, setup.WorkspaceID, mock.AnythingOfType("time.Time")).
			Return([]analytics.MonthlyLoanActivity{}, fmt.Errorf("test error")).Once()

		rec := setup.Get("/analytics/loans/monthly")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}
