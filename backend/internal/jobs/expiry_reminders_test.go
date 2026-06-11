package jobs

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestExpiryWindowFor(t *testing.T) {
	tests := []struct {
		name       string
		daysUntil  int
		wantWindow int
		wantOK     bool
	}{
		{name: "expires today", daysUntil: 0, wantWindow: 1, wantOK: true},
		{name: "expires tomorrow", daysUntil: 1, wantWindow: 1, wantOK: true},
		{name: "two days out falls into 7-day window", daysUntil: 2, wantWindow: 7, wantOK: true},
		{name: "exactly 7 days", daysUntil: 7, wantWindow: 7, wantOK: true},
		{name: "eight days out falls into 30-day window", daysUntil: 8, wantWindow: 30, wantOK: true},
		{name: "exactly 30 days", daysUntil: 30, wantWindow: 30, wantOK: true},
		{name: "outside widest window", daysUntil: 31, wantWindow: 0, wantOK: false},
		{name: "far future", daysUntil: 365, wantWindow: 0, wantOK: false},
		{name: "already expired", daysUntil: -1, wantWindow: 0, wantOK: false},
		{name: "long expired", daysUntil: -100, wantWindow: 0, wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			window, ok := ExpiryWindowFor(tt.daysUntil)
			assert.Equal(t, tt.wantOK, ok)
			assert.Equal(t, tt.wantWindow, window)
		})
	}
}

func TestDaysUntil(t *testing.T) {
	now := time.Date(2026, 6, 11, 15, 30, 0, 0, time.UTC)

	tests := []struct {
		name string
		date time.Time
		want int
	}{
		{name: "same day", date: time.Date(2026, 6, 11, 0, 0, 0, 0, time.UTC), want: 0},
		{name: "same day late evening", date: time.Date(2026, 6, 11, 23, 59, 0, 0, time.UTC), want: 0},
		{name: "tomorrow", date: time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC), want: 1},
		{name: "in a week", date: time.Date(2026, 6, 18, 0, 0, 0, 0, time.UTC), want: 7},
		{name: "in 30 days", date: time.Date(2026, 7, 11, 0, 0, 0, 0, time.UTC), want: 30},
		{name: "yesterday", date: time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC), want: -1},
		{name: "across month boundary", date: time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC), want: 20},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, DaysUntil(tt.date, now))
		})
	}
}

func TestExpiryReminderPayload_DedupeKey(t *testing.T) {
	invID := uuid.MustParse("01890000-0000-7000-8000-000000000001")

	p := ExpiryReminderPayload{InventoryID: invID, Kind: ExpiryKindExpiration, WindowDays: 7}
	assert.Equal(t, "expiry:01890000-0000-7000-8000-000000000001:expiration:7", p.DedupeKey())

	// Different window must produce a different key (one notification per
	// inventory row per window).
	p30 := p
	p30.WindowDays = 30
	assert.NotEqual(t, p.DedupeKey(), p30.DedupeKey())

	// Different kind must produce a different key (expiration and warranty
	// alerts are independent).
	pw := p
	pw.Kind = ExpiryKindWarranty
	assert.NotEqual(t, p.DedupeKey(), pw.DedupeKey())
}

func TestPrefEnabled(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want bool
	}{
		{name: "empty preferences mean enabled", raw: ``, want: true},
		{name: "empty object means enabled", raw: `{}`, want: true},
		{name: "key missing means enabled", raw: `{"loans":false}`, want: true},
		{name: "key explicitly enabled", raw: `{"expiry_alerts":true}`, want: true},
		{name: "key explicitly disabled", raw: `{"expiry_alerts":false}`, want: false},
		{name: "master switch off wins", raw: `{"enabled":false,"expiry_alerts":true}`, want: false},
		{name: "master switch on, key on", raw: `{"enabled":true,"expiry_alerts":true}`, want: true},
		{name: "malformed json fails open", raw: `{not-json`, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, prefEnabled([]byte(tt.raw), expiryPrefKey))
		})
	}
}

func TestExpiryMessage(t *testing.T) {
	date := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)

	title, body := expiryMessage(ExpiryReminderPayload{
		ItemName: "Milk", Kind: ExpiryKindExpiration, Date: date,
	})
	assert.Equal(t, "Item Expiring Soon", title)
	assert.Equal(t, "Milk expires on Jul 1, 2026", body)

	title, body = expiryMessage(ExpiryReminderPayload{
		ItemName: "Drill", Kind: ExpiryKindWarranty, Date: date,
	})
	assert.Equal(t, "Warranty Expiring", title)
	assert.Equal(t, "Warranty for Drill expires on Jul 1, 2026", body)
}

func TestNewScheduleExpiryRemindersTask(t *testing.T) {
	task := NewScheduleExpiryRemindersTask()
	assert.Equal(t, TypeExpiryReminder+":schedule", task.Type())
}
