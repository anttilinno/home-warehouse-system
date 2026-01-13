package analytics

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// Handler handles analytics-related HTTP requests
type Handler struct {
	svc ServiceInterface
}

// NewHandler creates a new analytics handler
func NewHandler(svc ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// DashboardStatsRequest is the input for dashboard stats
type DashboardStatsRequest struct{}

// DashboardStatsResponse is the response for dashboard stats
type DashboardStatsResponse struct {
	Body DashboardStats
}

// CategoryStatsRequest is the input for category stats
type CategoryStatsRequest struct {
	Limit int `query:"limit" default:"10" minimum:"1" maximum:"50" doc:"Maximum number of categories to return"`
}

// CategoryStatsResponse is the response for category stats
type CategoryStatsResponse struct {
	Body []CategoryStats
}

// LoanStatsRequest is the input for loan stats
type LoanStatsRequest struct{}

// LoanStatsResponse is the response for loan stats
type LoanStatsResponse struct {
	Body LoanStats
}

// LocationValuesRequest is the input for location values
type LocationValuesRequest struct {
	Limit int `query:"limit" default:"10" minimum:"1" maximum:"50" doc:"Maximum number of locations to return"`
}

// LocationValuesResponse is the response for location values
type LocationValuesResponse struct {
	Body []LocationInventoryValue
}

// RecentActivityRequest is the input for recent activity
type RecentActivityRequest struct {
	Limit int `query:"limit" default:"10" minimum:"1" maximum:"100" doc:"Maximum number of activities to return"`
}

// RecentActivityResponse is the response for recent activity
type RecentActivityResponse struct {
	Body []RecentActivity
}

// ConditionBreakdownRequest is the input for condition breakdown
type ConditionBreakdownRequest struct{}

// ConditionBreakdownResponse is the response for condition breakdown
type ConditionBreakdownResponse struct {
	Body []ConditionBreakdown
}

// StatusBreakdownRequest is the input for status breakdown
type StatusBreakdownRequest struct{}

// StatusBreakdownResponse is the response for status breakdown
type StatusBreakdownResponse struct {
	Body []StatusBreakdown
}

// TopBorrowersRequest is the input for top borrowers
type TopBorrowersRequest struct {
	Limit int `query:"limit" default:"10" minimum:"1" maximum:"50" doc:"Maximum number of borrowers to return"`
}

// TopBorrowersResponse is the response for top borrowers
type TopBorrowersResponse struct {
	Body []TopBorrower
}

// AnalyticsSummaryRequest is the input for analytics summary
type AnalyticsSummaryRequest struct{}

// AnalyticsSummaryResponse is the response for analytics summary
type AnalyticsSummaryResponse struct {
	Body AnalyticsSummary
}

// MonthlyLoanActivityRequest is the input for monthly loan activity
type MonthlyLoanActivityRequest struct {
	Months int `query:"months" default:"12" minimum:"1" maximum:"24" doc:"Number of months to look back"`
}

// MonthlyLoanActivityResponse is the response for monthly loan activity
type MonthlyLoanActivityResponse struct {
	Body []MonthlyLoanActivity
}

// RegisterRoutes registers analytics routes with the Huma API.
// Note: These routes are registered within a workspace-scoped router group,
// so paths are relative to /workspaces/{workspace_id}.
func (h *Handler) RegisterRoutes(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "get-dashboard-stats",
		Method:      http.MethodGet,
		Path:        "/analytics/dashboard",
		Summary:     "Get dashboard statistics",
		Description: "Returns overall workspace statistics including item counts, loan status, and inventory summary.",
		Tags:        []string{"Analytics"},
	}, h.GetDashboardStats)

	huma.Register(api, huma.Operation{
		OperationID: "get-category-stats",
		Method:      http.MethodGet,
		Path:        "/analytics/categories",
		Summary:     "Get category statistics",
		Description: "Returns item and inventory statistics per category.",
		Tags:        []string{"Analytics"},
	}, h.GetCategoryStats)

	huma.Register(api, huma.Operation{
		OperationID: "get-loan-stats",
		Method:      http.MethodGet,
		Path:        "/analytics/loans",
		Summary:     "Get loan statistics",
		Description: "Returns loan statistics including active, returned, and overdue loans.",
		Tags:        []string{"Analytics"},
	}, h.GetLoanStats)

	huma.Register(api, huma.Operation{
		OperationID: "get-location-values",
		Method:      http.MethodGet,
		Path:        "/analytics/locations",
		Summary:     "Get inventory value by location",
		Description: "Returns inventory value and item counts per location.",
		Tags:        []string{"Analytics"},
	}, h.GetLocationValues)

	huma.Register(api, huma.Operation{
		OperationID: "get-recent-activity",
		Method:      http.MethodGet,
		Path:        "/analytics/activity",
		Summary:     "Get recent activity",
		Description: "Returns recent activity log entries for the workspace.",
		Tags:        []string{"Analytics"},
	}, h.GetRecentActivity)

	huma.Register(api, huma.Operation{
		OperationID: "get-condition-breakdown",
		Method:      http.MethodGet,
		Path:        "/analytics/conditions",
		Summary:     "Get inventory by condition",
		Description: "Returns inventory count breakdown by item condition.",
		Tags:        []string{"Analytics"},
	}, h.GetConditionBreakdown)

	huma.Register(api, huma.Operation{
		OperationID: "get-status-breakdown",
		Method:      http.MethodGet,
		Path:        "/analytics/statuses",
		Summary:     "Get inventory by status",
		Description: "Returns inventory count breakdown by item status.",
		Tags:        []string{"Analytics"},
	}, h.GetStatusBreakdown)

	huma.Register(api, huma.Operation{
		OperationID: "get-top-borrowers",
		Method:      http.MethodGet,
		Path:        "/analytics/borrowers",
		Summary:     "Get top borrowers",
		Description: "Returns top borrowers by loan count.",
		Tags:        []string{"Analytics"},
	}, h.GetTopBorrowers)

	huma.Register(api, huma.Operation{
		OperationID: "get-analytics-summary",
		Method:      http.MethodGet,
		Path:        "/analytics/summary",
		Summary:     "Get complete analytics summary",
		Description: "Returns a complete analytics summary including all available statistics.",
		Tags:        []string{"Analytics"},
	}, h.GetAnalyticsSummary)

	huma.Register(api, huma.Operation{
		OperationID: "get-monthly-loan-activity",
		Method:      http.MethodGet,
		Path:        "/analytics/loans/monthly",
		Summary:     "Get monthly loan activity",
		Description: "Returns loan activity per month for the specified time period.",
		Tags:        []string{"Analytics"},
	}, h.GetMonthlyLoanActivity)
}

// GetDashboardStats handles the dashboard stats request
func (h *Handler) GetDashboardStats(ctx context.Context, input *DashboardStatsRequest) (*DashboardStatsResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	stats, err := h.svc.GetDashboardStats(ctx, workspaceID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch dashboard stats", err)
	}
	return &DashboardStatsResponse{Body: *stats}, nil
}

// GetCategoryStats handles the category stats request
func (h *Handler) GetCategoryStats(ctx context.Context, input *CategoryStatsRequest) (*CategoryStatsResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	stats, err := h.svc.GetCategoryStats(ctx, workspaceID, int32(input.Limit))
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch category stats", err)
	}
	return &CategoryStatsResponse{Body: stats}, nil
}

// GetLoanStats handles the loan stats request
func (h *Handler) GetLoanStats(ctx context.Context, input *LoanStatsRequest) (*LoanStatsResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	stats, err := h.svc.GetLoanStats(ctx, workspaceID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch loan stats", err)
	}
	return &LoanStatsResponse{Body: *stats}, nil
}

// GetLocationValues handles the location values request
func (h *Handler) GetLocationValues(ctx context.Context, input *LocationValuesRequest) (*LocationValuesResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	values, err := h.svc.GetInventoryValueByLocation(ctx, workspaceID, int32(input.Limit))
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch location values", err)
	}
	return &LocationValuesResponse{Body: values}, nil
}

// GetRecentActivity handles the recent activity request
func (h *Handler) GetRecentActivity(ctx context.Context, input *RecentActivityRequest) (*RecentActivityResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	activity, err := h.svc.GetRecentActivity(ctx, workspaceID, int32(input.Limit))
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch recent activity", err)
	}
	return &RecentActivityResponse{Body: activity}, nil
}

// GetConditionBreakdown handles the condition breakdown request
func (h *Handler) GetConditionBreakdown(ctx context.Context, input *ConditionBreakdownRequest) (*ConditionBreakdownResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	breakdown, err := h.svc.GetConditionBreakdown(ctx, workspaceID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch condition breakdown", err)
	}
	return &ConditionBreakdownResponse{Body: breakdown}, nil
}

// GetStatusBreakdown handles the status breakdown request
func (h *Handler) GetStatusBreakdown(ctx context.Context, input *StatusBreakdownRequest) (*StatusBreakdownResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	breakdown, err := h.svc.GetStatusBreakdown(ctx, workspaceID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch status breakdown", err)
	}
	return &StatusBreakdownResponse{Body: breakdown}, nil
}

// GetTopBorrowers handles the top borrowers request
func (h *Handler) GetTopBorrowers(ctx context.Context, input *TopBorrowersRequest) (*TopBorrowersResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	borrowers, err := h.svc.GetTopBorrowers(ctx, workspaceID, int32(input.Limit))
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch top borrowers", err)
	}
	return &TopBorrowersResponse{Body: borrowers}, nil
}

// GetAnalyticsSummary handles the analytics summary request
func (h *Handler) GetAnalyticsSummary(ctx context.Context, input *AnalyticsSummaryRequest) (*AnalyticsSummaryResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	summary, err := h.svc.GetAnalyticsSummary(ctx, workspaceID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch analytics summary", err)
	}
	return &AnalyticsSummaryResponse{Body: *summary}, nil
}

// GetMonthlyLoanActivity handles the monthly loan activity request
func (h *Handler) GetMonthlyLoanActivity(ctx context.Context, input *MonthlyLoanActivityRequest) (*MonthlyLoanActivityResponse, error) {
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("workspace context required")
	}
	since := time.Now().AddDate(0, -input.Months, 0)
	activity, err := h.svc.GetMonthlyLoanActivity(ctx, workspaceID, since)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to fetch monthly loan activity", err)
	}
	return &MonthlyLoanActivityResponse{Body: activity}, nil
}
