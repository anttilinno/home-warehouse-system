package jobs

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// RepairReminderPayload Tests
// =============================================================================

func TestRepairReminderPayload_JSON_Roundtrip(t *testing.T) {
	repairLogID := uuid.New()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	reminderDate := time.Now().Add(48 * time.Hour).Truncate(time.Second)

	payload := RepairReminderPayload{
		RepairLogID:  repairLogID,
		WorkspaceID:  workspaceID,
		InventoryID:  inventoryID,
		ItemName:     "Power Drill",
		Description:  "Replace worn brushes",
		ReminderDate: reminderDate,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded RepairReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, payload.RepairLogID, decoded.RepairLogID)
	assert.Equal(t, payload.WorkspaceID, decoded.WorkspaceID)
	assert.Equal(t, payload.InventoryID, decoded.InventoryID)
	assert.Equal(t, payload.ItemName, decoded.ItemName)
	assert.Equal(t, payload.Description, decoded.Description)
	assert.Equal(t, payload.ReminderDate.Unix(), decoded.ReminderDate.Unix())
}

func TestRepairReminderPayload_LongDescription(t *testing.T) {
	// Create a very long description
	longDescription := ""
	for i := 0; i < 100; i++ {
		longDescription += "This is a long description. "
	}

	payload := RepairReminderPayload{
		RepairLogID:  uuid.New(),
		WorkspaceID:  uuid.New(),
		InventoryID:  uuid.New(),
		ItemName:     "Test Item",
		Description:  longDescription,
		ReminderDate: time.Now(),
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded RepairReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, longDescription, decoded.Description)
}

func TestRepairReminderPayload_ZeroTime(t *testing.T) {
	payload := RepairReminderPayload{
		RepairLogID:  uuid.New(),
		WorkspaceID:  uuid.New(),
		InventoryID:  uuid.New(),
		ItemName:     "Test Item",
		Description:  "Test Description",
		ReminderDate: time.Time{},
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded RepairReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.True(t, decoded.ReminderDate.IsZero())
}

func TestRepairReminderPayload_UnicodeCharacters(t *testing.T) {
	payload := RepairReminderPayload{
		RepairLogID:  uuid.New(),
		WorkspaceID:  uuid.New(),
		InventoryID:  uuid.New(),
		ItemName:     "Bohrmaschine mit Akku",
		Description:  "Auswechseln der Bursten - sehr wichtig!",
		ReminderDate: time.Now(),
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded RepairReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, payload.ItemName, decoded.ItemName)
	assert.Equal(t, payload.Description, decoded.Description)
}

func TestRepairReminderPayload_SpecialCharacters(t *testing.T) {
	tests := []struct {
		name        string
		itemName    string
		description string
	}{
		{"quotes", `Item "Special"`, `Description with "quotes"`},
		{"backslashes", `Item\\Path`, `Path\\with\\slashes`},
		{"newlines", "Item\nName", "Description\nwith\nnewlines"},
		{"tabs", "Item\tName", "Description\twith\ttabs"},
		{"mixed", `Item & "Things"`, `Special <chars> & "stuff"`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := RepairReminderPayload{
				RepairLogID:  uuid.New(),
				WorkspaceID:  uuid.New(),
				InventoryID:  uuid.New(),
				ItemName:     tt.itemName,
				Description:  tt.description,
				ReminderDate: time.Now(),
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded RepairReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, tt.itemName, decoded.ItemName)
			assert.Equal(t, tt.description, decoded.Description)
		})
	}
}

func TestRepairReminderPayload_EmptyStrings(t *testing.T) {
	payload := RepairReminderPayload{
		RepairLogID:  uuid.New(),
		WorkspaceID:  uuid.New(),
		InventoryID:  uuid.New(),
		ItemName:     "",
		Description:  "",
		ReminderDate: time.Now(),
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded RepairReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Empty(t, decoded.ItemName)
	assert.Empty(t, decoded.Description)
}

func TestRepairReminderPayload_FutureDates(t *testing.T) {
	tests := []struct {
		name         string
		reminderDate time.Time
	}{
		{"tomorrow", time.Now().Add(24 * time.Hour)},
		{"next week", time.Now().Add(7 * 24 * time.Hour)},
		{"next month", time.Now().AddDate(0, 1, 0)},
		{"next year", time.Now().AddDate(1, 0, 0)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := RepairReminderPayload{
				RepairLogID:  uuid.New(),
				ReminderDate: tt.reminderDate.Truncate(time.Second),
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded RepairReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, payload.ReminderDate.Unix(), decoded.ReminderDate.Unix())
		})
	}
}

func TestRepairReminderPayload_PastDates(t *testing.T) {
	tests := []struct {
		name         string
		reminderDate time.Time
	}{
		{"yesterday", time.Now().Add(-24 * time.Hour)},
		{"last week", time.Now().Add(-7 * 24 * time.Hour)},
		{"last month", time.Now().AddDate(0, -1, 0)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := RepairReminderPayload{
				RepairLogID:  uuid.New(),
				ReminderDate: tt.reminderDate.Truncate(time.Second),
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded RepairReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, payload.ReminderDate.Unix(), decoded.ReminderDate.Unix())
		})
	}
}

// =============================================================================
// RepairReminderProcessor Tests
// =============================================================================

func TestRepairReminderProcessor_ProcessTask_InvalidPayload(t *testing.T) {
	processor := NewRepairReminderProcessor(nil, nil)

	tests := []struct {
		name    string
		payload []byte
	}{
		{"empty payload", []byte{}},
		{"invalid json", []byte("not valid json")},
		{"truncated json", []byte(`{"repair_log_id": "abc`)},
		{"malformed object", []byte(`{repair_log_id: 123}`)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := asynq.NewTask(TypeRepairReminder, tt.payload)
			err := processor.ProcessTask(context.Background(), task)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to unmarshal payload")
		})
	}
}

func TestRepairReminderProcessor_ProcessTask_InvalidUUID(t *testing.T) {
	processor := NewRepairReminderProcessor(nil, nil)

	// Payload with invalid UUID format
	payload := []byte(`{"repair_log_id": "not-a-valid-uuid"}`)
	task := asynq.NewTask(TypeRepairReminder, payload)
	err := processor.ProcessTask(context.Background(), task)

	assert.Error(t, err)
}

// =============================================================================
// RepairReminderScheduler Constructor Tests
// =============================================================================

func TestNewRepairReminderScheduler_NilPool(t *testing.T) {
	scheduler := NewRepairReminderScheduler(nil, nil)
	assert.NotNil(t, scheduler)
}

func TestNewRepairReminderScheduler_NilClient(t *testing.T) {
	scheduler := NewRepairReminderScheduler(nil, nil)
	assert.NotNil(t, scheduler)
}

// =============================================================================
// NewScheduleRepairRemindersTask Tests
// =============================================================================

func TestNewScheduleRepairRemindersTask_Type(t *testing.T) {
	task := NewScheduleRepairRemindersTask()

	assert.NotNil(t, task)
	assert.Equal(t, TypeRepairReminder+":schedule", task.Type())
}

func TestNewScheduleRepairRemindersTask_NoPayload(t *testing.T) {
	task := NewScheduleRepairRemindersTask()

	assert.Nil(t, task.Payload())
}

func TestNewScheduleRepairRemindersTask_MultipleInstances(t *testing.T) {
	task1 := NewScheduleRepairRemindersTask()
	task2 := NewScheduleRepairRemindersTask()

	// Each instance should be independent but same type
	assert.Equal(t, task1.Type(), task2.Type())
}

// =============================================================================
// Reminder Date Boundary Tests
// =============================================================================

func TestRepairReminderPayload_ReminderDateBoundaries(t *testing.T) {
	tests := []struct {
		name         string
		reminderDate time.Time
	}{
		{"unix epoch", time.Unix(0, 0)},
		{"year 2000", time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)},
		{"far future", time.Date(2100, 12, 31, 23, 59, 59, 0, time.UTC)},
		{"with nanoseconds", time.Now().Add(time.Nanosecond * 123456789)},
		{"start of day", time.Now().Truncate(24 * time.Hour)},
		{"end of day", time.Now().Truncate(24*time.Hour).Add(24*time.Hour - time.Second)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := RepairReminderPayload{
				RepairLogID:  uuid.New(),
				ReminderDate: tt.reminderDate,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded RepairReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			// Compare at second precision since JSON doesn't preserve nanoseconds
			assert.Equal(t, payload.ReminderDate.Unix(), decoded.ReminderDate.Unix())
		})
	}
}

// =============================================================================
// Type Constant Tests
// =============================================================================

func TestTypeRepairReminder_Value(t *testing.T) {
	assert.Equal(t, "repair:reminder", TypeRepairReminder)
}

func TestTypeRepairReminder_NotEqualToLoan(t *testing.T) {
	assert.NotEqual(t, TypeLoanReminder, TypeRepairReminder)
}
