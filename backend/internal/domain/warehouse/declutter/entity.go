// Package declutter provides domain types and logic for the declutter assistant feature.
// The declutter assistant helps users identify and act on unused inventory items.
package declutter

import (
	"time"

	"github.com/google/uuid"
)

// GroupBy represents the grouping options for declutter list.
type GroupBy string

const (
	// GroupByNone indicates no grouping.
	GroupByNone GroupBy = "none"
	// GroupByCategory groups items by their category.
	GroupByCategory GroupBy = "category"
	// GroupByLocation groups items by their location.
	GroupByLocation GroupBy = "location"
)

// DeclutterItem represents an inventory item that hasn't been used for a while.
// It includes calculated score and enriched data for display.
type DeclutterItem struct {
	// Core inventory fields
	ID            uuid.UUID
	WorkspaceID   uuid.UUID
	ItemID        uuid.UUID
	LocationID    uuid.UUID
	ContainerID   *uuid.UUID
	Quantity      int
	Condition     *string
	Status        *string
	PurchasePrice *int // cents
	CurrencyCode  *string
	LastUsedAt    *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time

	// Enriched fields from joins
	ItemName     string
	ItemSKU      string
	LocationName string
	CategoryID   *uuid.UUID
	CategoryName *string

	// Calculated fields
	DaysUnused int
	Score      int // Higher score = higher priority to declutter
}

// DeclutterCounts represents summary counts of unused inventory at different thresholds.
type DeclutterCounts struct {
	// Item counts
	Unused90  int `json:"unused_90"`
	Unused180 int `json:"unused_180"`
	Unused365 int `json:"unused_365"`

	// Total value in cents
	Value90  int64 `json:"value_90"`
	Value180 int64 `json:"value_180"`
	Value365 int64 `json:"value_365"`
}

// ListParams contains parameters for listing unused inventory.
type ListParams struct {
	WorkspaceID   uuid.UUID
	ThresholdDays int     // Minimum days since last use
	GroupBy       GroupBy // Grouping option
	Page          int
	PageSize      int
}

// DefaultListParams returns default list parameters.
func DefaultListParams(workspaceID uuid.UUID) ListParams {
	return ListParams{
		WorkspaceID:   workspaceID,
		ThresholdDays: 90,
		GroupBy:       GroupByNone,
		Page:          1,
		PageSize:      50,
	}
}

// Offset returns the SQL offset for pagination.
func (p ListParams) Offset() int {
	if p.Page < 1 {
		return 0
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL limit for pagination.
func (p ListParams) Limit() int {
	if p.PageSize <= 0 {
		return 50
	}
	if p.PageSize > 100 {
		return 100
	}
	return p.PageSize
}

// CalculateScore computes a declutter priority score for an item.
// Higher score = higher priority to declutter.
//
// Score formula:
//   - Age component (0-100): Based on how far past threshold the item is
//   - Value component (0-50): Lower value items score higher (easier to declutter)
//
// Parameters:
//   - daysUnused: Number of days since last use
//   - threshold: The minimum days threshold (e.g., 90)
//   - valueCents: The item's purchase price in cents
//   - maxValueCents: The maximum item value in the workspace (for percentile calc)
//
// Returns: Score from 0 to 150 (higher = should declutter sooner)
func CalculateScore(daysUnused int, threshold int, valueCents int, maxValueCents int) int {
	// Age score: 100 when at threshold, increases beyond that (capped at 100)
	var ageScore float64
	if threshold > 0 {
		ageScore = float64(daysUnused) / float64(threshold) * 100
		if ageScore > 100 {
			ageScore = 100
		}
	}

	// Value score: Lower value items get higher score (easier to declutter)
	// Range: 0-50 points
	var valueScore float64
	if maxValueCents > 0 && valueCents >= 0 {
		// Invert: low value = high score
		valueScore = (1 - float64(valueCents)/float64(maxValueCents)) * 50
		if valueScore < 0 {
			valueScore = 0
		}
	} else if maxValueCents == 0 {
		// If no items have value, give neutral score
		valueScore = 25
	}

	return int(ageScore + valueScore)
}
