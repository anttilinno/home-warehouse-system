package analytics

import (
	"time"

	"github.com/google/uuid"
)

// DashboardStats contains overall workspace statistics
type DashboardStats struct {
	TotalItems      int32 `json:"total_items"`
	TotalInventory  int32 `json:"total_inventory"`
	TotalLocations  int32 `json:"total_locations"`
	TotalContainers int32 `json:"total_containers"`
	ActiveLoans     int32 `json:"active_loans"`
	OverdueLoans    int32 `json:"overdue_loans"`
	LowStockItems   int32 `json:"low_stock_items"`
	TotalCategories int32 `json:"total_categories"`
	TotalBorrowers  int32 `json:"total_borrowers"`
}

// CategoryStats contains statistics per category
type CategoryStats struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	ItemCount      int32     `json:"item_count"`
	InventoryCount int32     `json:"inventory_count"`
	TotalValue     int32     `json:"total_value"` // In cents
}

// LoanStats contains loan statistics
type LoanStats struct {
	TotalLoans    int32 `json:"total_loans"`
	ActiveLoans   int32 `json:"active_loans"`
	ReturnedLoans int32 `json:"returned_loans"`
	OverdueLoans  int32 `json:"overdue_loans"`
}

// LocationInventoryValue contains inventory value per location
type LocationInventoryValue struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	ItemCount     int32     `json:"item_count"`
	TotalQuantity int32     `json:"total_quantity"`
	TotalValue    int32     `json:"total_value"` // In cents
}

// RecentActivity represents a recent activity log entry
type RecentActivity struct {
	ID         uuid.UUID  `json:"id"`
	UserID     *uuid.UUID `json:"user_id,omitempty"`
	Action     string     `json:"action"`
	EntityType string     `json:"entity_type"`
	EntityID   uuid.UUID  `json:"entity_id"`
	EntityName *string    `json:"entity_name,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ConditionBreakdown contains inventory count by condition
type ConditionBreakdown struct {
	Condition string `json:"condition"`
	Count     int32  `json:"count"`
}

// StatusBreakdown contains inventory count by status
type StatusBreakdown struct {
	Status string `json:"status"`
	Count  int32  `json:"count"`
}

// TopBorrower contains borrower statistics
type TopBorrower struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Email       *string   `json:"email,omitempty"`
	TotalLoans  int32     `json:"total_loans"`
	ActiveLoans int32     `json:"active_loans"`
}

// MonthlyLoanActivity contains loan activity per month
type MonthlyLoanActivity struct {
	Month         time.Time `json:"month"`
	LoansCreated  int32     `json:"loans_created"`
	LoansReturned int32     `json:"loans_returned"`
}

// OutOfStockItem represents an item that is completely out of stock
type OutOfStockItem struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	SKU           string     `json:"sku"`
	MinStockLevel int32      `json:"min_stock_level"`
	CategoryID    *uuid.UUID `json:"category_id,omitempty"`
	CategoryName  *string    `json:"category_name,omitempty"`
}

// AnalyticsSummary contains a complete analytics summary
type AnalyticsSummary struct {
	Dashboard           DashboardStats           `json:"dashboard"`
	LoanStats           LoanStats                `json:"loan_stats"`
	CategoryStats       []CategoryStats          `json:"category_stats"`
	LocationValues      []LocationInventoryValue `json:"location_values"`
	RecentActivity      []RecentActivity         `json:"recent_activity"`
	ConditionBreakdown  []ConditionBreakdown     `json:"condition_breakdown"`
	StatusBreakdown     []StatusBreakdown        `json:"status_breakdown"`
	TopBorrowers        []TopBorrower            `json:"top_borrowers"`
	MonthlyLoanActivity []MonthlyLoanActivity    `json:"monthly_loan_activity,omitempty"`
}
