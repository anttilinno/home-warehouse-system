package jobs

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestMaintenanceReminderPayload_DedupeKey(t *testing.T) {
	schedID := uuid.MustParse("01890000-0000-7000-8000-000000000002")
	due := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)

	p := MaintenanceReminderPayload{ScheduleID: schedID, NextDue: due}
	assert.Equal(t, "maintenance:01890000-0000-7000-8000-000000000002:2026-06-15", p.DedupeKey())

	// Completing a schedule advances next_due, producing a fresh dedupe key
	// so the next occurrence gets its own notification.
	advanced := p
	advanced.NextDue = due.AddDate(0, 0, 30)
	assert.NotEqual(t, p.DedupeKey(), advanced.DedupeKey())
}

func TestMaintenanceMessage(t *testing.T) {
	due := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	base := MaintenanceReminderPayload{
		Title:    "Replace HVAC filter",
		ItemName: "HVAC Unit",
		NextDue:  due,
	}

	title, body := maintenanceMessage(base)
	assert.Equal(t, "Maintenance Due", title)
	assert.Equal(t, "Replace HVAC filter for HVAC Unit is due on Jun 15, 2026", body)

	overdue := base
	overdue.IsOverdue = true
	title, body = maintenanceMessage(overdue)
	assert.Equal(t, "Maintenance Overdue", title)
	assert.Equal(t, "Replace HVAC filter for HVAC Unit was due on Jun 15, 2026", body)
}

func TestNewScheduleMaintenanceRemindersTask(t *testing.T) {
	task := NewScheduleMaintenanceRemindersTask()
	assert.Equal(t, TypeMaintenanceReminder+":schedule", task.Type())
}
