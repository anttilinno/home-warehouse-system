// Package maintenance models recurring maintenance schedules for inventory
// entries ("HVAC filter every 3 months", "smoke-detector batteries yearly").
// Schedules feed the reminder pipeline (internal/jobs/maintenance_reminders.go)
// and write back into repair logs when completed.
package maintenance

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Schedule represents a recurring maintenance schedule for an inventory entry.
type Schedule struct {
	id              uuid.UUID
	workspaceID     uuid.UUID
	inventoryID     uuid.UUID
	title           string
	notes           *string
	intervalDays    int
	nextDue         time.Time
	lastCompletedAt *time.Time
	isActive        bool
	createdAt       time.Time
	updatedAt       time.Time
}

// NewSchedule creates a new active maintenance schedule.
func NewSchedule(
	workspaceID, inventoryID uuid.UUID,
	title string,
	notes *string,
	intervalDays int,
	nextDue time.Time,
) (*Schedule, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(inventoryID, "inventory_id"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(title) == "" {
		return nil, ErrInvalidTitle
	}
	if intervalDays <= 0 {
		return nil, ErrInvalidInterval
	}
	if nextDue.IsZero() {
		return nil, ErrInvalidNextDue
	}

	now := time.Now()
	return &Schedule{
		id:           shared.NewUUID(),
		workspaceID:  workspaceID,
		inventoryID:  inventoryID,
		title:        title,
		notes:        notes,
		intervalDays: intervalDays,
		nextDue:      nextDue,
		isActive:     true,
		createdAt:    now,
		updatedAt:    now,
	}, nil
}

// Reconstruct creates a Schedule from database values without validation.
func Reconstruct(
	id, workspaceID, inventoryID uuid.UUID,
	title string,
	notes *string,
	intervalDays int,
	nextDue time.Time,
	lastCompletedAt *time.Time,
	isActive bool,
	createdAt, updatedAt time.Time,
) *Schedule {
	return &Schedule{
		id:              id,
		workspaceID:     workspaceID,
		inventoryID:     inventoryID,
		title:           title,
		notes:           notes,
		intervalDays:    intervalDays,
		nextDue:         nextDue,
		lastCompletedAt: lastCompletedAt,
		isActive:        isActive,
		createdAt:       createdAt,
		updatedAt:       updatedAt,
	}
}

// Getters

// ID returns the schedule's unique identifier.
func (s *Schedule) ID() uuid.UUID { return s.id }

// WorkspaceID returns the workspace this schedule belongs to.
func (s *Schedule) WorkspaceID() uuid.UUID { return s.workspaceID }

// InventoryID returns the inventory entry being maintained.
func (s *Schedule) InventoryID() uuid.UUID { return s.inventoryID }

// Title returns the schedule title (e.g. "Replace HVAC filter").
func (s *Schedule) Title() string { return s.title }

// Notes returns the optional schedule notes.
func (s *Schedule) Notes() *string { return s.notes }

// IntervalDays returns the cadence in days.
func (s *Schedule) IntervalDays() int { return s.intervalDays }

// NextDue returns the date the next maintenance is due.
func (s *Schedule) NextDue() time.Time { return s.nextDue }

// LastCompletedAt returns the most recent completion timestamp (nil until
// first completed).
func (s *Schedule) LastCompletedAt() *time.Time { return s.lastCompletedAt }

// IsActive reports whether the schedule generates reminders.
func (s *Schedule) IsActive() bool { return s.isActive }

// CreatedAt returns the creation timestamp.
func (s *Schedule) CreatedAt() time.Time { return s.createdAt }

// UpdatedAt returns the last update timestamp.
func (s *Schedule) UpdatedAt() time.Time { return s.updatedAt }

// IsOverdue reports whether the schedule's next_due date is before today
// (relative to now).
func (s *Schedule) IsOverdue(now time.Time) bool {
	return s.nextDue.Before(startOfDay(now))
}

// UpdateDetails updates the editable schedule fields.
func (s *Schedule) UpdateDetails(title string, notes *string, intervalDays int, nextDue time.Time, isActive bool) error {
	if strings.TrimSpace(title) == "" {
		return ErrInvalidTitle
	}
	if intervalDays <= 0 {
		return ErrInvalidInterval
	}
	if nextDue.IsZero() {
		return ErrInvalidNextDue
	}

	s.title = title
	s.notes = notes
	s.intervalDays = intervalDays
	s.nextDue = nextDue
	s.isActive = isActive
	s.updatedAt = time.Now()
	return nil
}

// Complete records a completion at now and advances next_due.
//
// Overdue catch-up semantics: the next occurrence is anchored to the DUE date
// (next_due + interval_days), not the completion date, so the cadence does
// not drift when maintenance is done a few days early or late. If the
// schedule is so overdue that the anchored date would still be in the past,
// the new due date clamps to today — i.e.
//
//	next_due = max(today, next_due + interval_days)
//
// This means a long-neglected schedule yields exactly one immediate catch-up
// occurrence instead of a backlog of stale ones.
func (s *Schedule) Complete(now time.Time) {
	completedAt := now
	s.lastCompletedAt = &completedAt

	next := s.nextDue.AddDate(0, 0, s.intervalDays)
	if today := startOfDay(now); next.Before(today) {
		next = today
	}
	s.nextDue = next
	s.updatedAt = now
}

// startOfDay truncates t to midnight in its own location.
func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}
