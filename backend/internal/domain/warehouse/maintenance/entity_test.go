package maintenance

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func TestNewSchedule_Validation(t *testing.T) {
	ws := uuid.New()
	inv := uuid.New()
	nextDue := date(2026, 7, 1)

	tests := []struct {
		name         string
		workspaceID  uuid.UUID
		inventoryID  uuid.UUID
		title        string
		intervalDays int
		nextDue      time.Time
		wantErr      error
	}{
		{name: "valid", workspaceID: ws, inventoryID: inv, title: "Replace filter", intervalDays: 90, nextDue: nextDue},
		{name: "empty title", workspaceID: ws, inventoryID: inv, title: "  ", intervalDays: 90, nextDue: nextDue, wantErr: ErrInvalidTitle},
		{name: "zero interval", workspaceID: ws, inventoryID: inv, title: "x", intervalDays: 0, nextDue: nextDue, wantErr: ErrInvalidInterval},
		{name: "negative interval", workspaceID: ws, inventoryID: inv, title: "x", intervalDays: -7, nextDue: nextDue, wantErr: ErrInvalidInterval},
		{name: "zero next due", workspaceID: ws, inventoryID: inv, title: "x", intervalDays: 90, wantErr: ErrInvalidNextDue},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s, err := NewSchedule(tt.workspaceID, tt.inventoryID, tt.title, nil, tt.intervalDays, tt.nextDue)
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			assert.True(t, s.IsActive())
			assert.Nil(t, s.LastCompletedAt())
			assert.Equal(t, tt.nextDue, s.NextDue())
		})
	}
}

// TestSchedule_Complete_NextDueAdvancement covers the overdue catch-up
// semantics: next_due = max(today, next_due + interval_days). The next
// occurrence anchors to the DUE date (cadence does not drift on early/late
// completion) but never lands in the past.
func TestSchedule_Complete_NextDueAdvancement(t *testing.T) {
	now := time.Date(2026, 6, 11, 14, 0, 0, 0, time.UTC) // "today" = 2026-06-11

	tests := []struct {
		name         string
		nextDue      time.Time
		intervalDays int
		wantNextDue  time.Time
	}{
		{
			name:         "due in the future: advance from due date",
			nextDue:      date(2026, 6, 20),
			intervalDays: 30,
			wantNextDue:  date(2026, 7, 20),
		},
		{
			name:         "due today: advance one interval",
			nextDue:      date(2026, 6, 11),
			intervalDays: 7,
			wantNextDue:  date(2026, 6, 18),
		},
		{
			name:         "slightly overdue: anchored date still in the future",
			nextDue:      date(2026, 6, 8), // 3 days overdue
			intervalDays: 30,
			wantNextDue:  date(2026, 7, 8), // due + interval, no clamp needed
		},
		{
			name:         "overdue by less than one interval: lands today, no clamp",
			nextDue:      date(2026, 6, 4), // 7 days overdue
			intervalDays: 7,
			wantNextDue:  date(2026, 6, 11), // due + interval == today
		},
		{
			name:         "long overdue: clamps to today instead of the past",
			nextDue:      date(2026, 1, 1), // ~5 months overdue
			intervalDays: 30,
			wantNextDue:  date(2026, 6, 11), // max(today, 2026-01-31) = today
		},
		{
			name:         "yearly cadence overdue by two days",
			nextDue:      date(2026, 6, 9),
			intervalDays: 365,
			wantNextDue:  date(2027, 6, 9),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := Reconstruct(
				uuid.New(), uuid.New(), uuid.New(),
				"Test schedule", nil,
				tt.intervalDays, tt.nextDue, nil, true,
				now.Add(-time.Hour), now.Add(-time.Hour),
			)

			s.Complete(now)

			assert.Equal(t, tt.wantNextDue, s.NextDue(), "next_due advancement")
			require.NotNil(t, s.LastCompletedAt())
			assert.Equal(t, now, *s.LastCompletedAt())
		})
	}
}

func TestSchedule_Complete_RepeatedCompletionsKeepCadence(t *testing.T) {
	// Completing on time repeatedly must not drift the cadence.
	now := time.Date(2026, 6, 11, 9, 0, 0, 0, time.UTC)
	s := Reconstruct(
		uuid.New(), uuid.New(), uuid.New(),
		"Quarterly check", nil,
		90, date(2026, 6, 11), nil, true,
		now, now,
	)

	s.Complete(now)
	assert.Equal(t, date(2026, 9, 9), s.NextDue())

	// Complete the next occurrence two days early — anchor stays on due date.
	s.Complete(time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC))
	assert.Equal(t, date(2026, 12, 8), s.NextDue())
}

func TestSchedule_IsOverdue(t *testing.T) {
	now := time.Date(2026, 6, 11, 23, 0, 0, 0, time.UTC)
	mk := func(due time.Time) *Schedule {
		return Reconstruct(uuid.New(), uuid.New(), uuid.New(), "t", nil, 7, due, nil, true, now, now)
	}

	assert.True(t, mk(date(2026, 6, 10)).IsOverdue(now), "yesterday is overdue")
	assert.False(t, mk(date(2026, 6, 11)).IsOverdue(now), "due today is not overdue")
	assert.False(t, mk(date(2026, 6, 12)).IsOverdue(now), "due tomorrow is not overdue")
}

func TestSchedule_UpdateDetails_Validation(t *testing.T) {
	s, err := NewSchedule(uuid.New(), uuid.New(), "Original", nil, 30, date(2026, 7, 1))
	require.NoError(t, err)

	assert.ErrorIs(t, s.UpdateDetails("", nil, 30, date(2026, 7, 1), true), ErrInvalidTitle)
	assert.ErrorIs(t, s.UpdateDetails("x", nil, 0, date(2026, 7, 1), true), ErrInvalidInterval)
	assert.ErrorIs(t, s.UpdateDetails("x", nil, 30, time.Time{}, true), ErrInvalidNextDue)

	notes := "every season"
	require.NoError(t, s.UpdateDetails("Updated", &notes, 14, date(2026, 8, 1), false))
	assert.Equal(t, "Updated", s.Title())
	assert.Equal(t, 14, s.IntervalDays())
	assert.Equal(t, date(2026, 8, 1), s.NextDue())
	assert.False(t, s.IsActive())
}
