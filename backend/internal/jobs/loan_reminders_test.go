package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// Mock Email Senders
// =============================================================================

// testErrorEmailSender returns errors for testing error paths
type testErrorEmailSender struct {
	sendError error
}

func (e *testErrorEmailSender) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	return e.sendError
}

// testTrackingEmailSender tracks all sent emails for verification
type testTrackingEmailSender struct {
	sentEmails []testTrackedEmail
}

type testTrackedEmail struct {
	to           string
	borrowerName string
	itemName     string
	dueDate      time.Time
	isOverdue    bool
}

func (t *testTrackingEmailSender) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	t.sentEmails = append(t.sentEmails, testTrackedEmail{
		to:           to,
		borrowerName: borrowerName,
		itemName:     itemName,
		dueDate:      dueDate,
		isOverdue:    isOverdue,
	})
	return nil
}

// testContextAwareEmailSender checks context cancellation
type testContextAwareEmailSender struct {
	delay time.Duration
}

func (c *testContextAwareEmailSender) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(c.delay):
		return nil
	}
}

// =============================================================================
// LoanReminderPayload Tests
// =============================================================================

func TestLoanReminderPayload_JSON_Roundtrip(t *testing.T) {
	loanID := uuid.New()
	workspaceID := uuid.New()
	dueDate := time.Now().Add(48 * time.Hour).Truncate(time.Second)

	payload := LoanReminderPayload{
		LoanID:        loanID,
		WorkspaceID:   workspaceID,
		BorrowerName:  "John Doe",
		BorrowerEmail: "john@example.com",
		ItemName:      "Power Drill",
		DueDate:       dueDate,
		IsOverdue:     false,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, payload.LoanID, decoded.LoanID)
	assert.Equal(t, payload.WorkspaceID, decoded.WorkspaceID)
	assert.Equal(t, payload.BorrowerName, decoded.BorrowerName)
	assert.Equal(t, payload.BorrowerEmail, decoded.BorrowerEmail)
	assert.Equal(t, payload.ItemName, decoded.ItemName)
	assert.Equal(t, payload.DueDate.Unix(), decoded.DueDate.Unix())
	assert.Equal(t, payload.IsOverdue, decoded.IsOverdue)
}

func TestLoanReminderPayload_LongStrings(t *testing.T) {
	// Create a very long string
	longName := strings.Repeat("A", 500)

	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  longName,
		BorrowerEmail: "test@example.com",
		ItemName:      longName,
		DueDate:       time.Now(),
		IsOverdue:     false,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Len(t, decoded.BorrowerName, 500)
	assert.Len(t, decoded.ItemName, 500)
}

func TestLoanReminderPayload_ZeroTime(t *testing.T) {
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "Test User",
		BorrowerEmail: "test@example.com",
		ItemName:      "Test Item",
		DueDate:       time.Time{},
		IsOverdue:     false,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.True(t, decoded.DueDate.IsZero())
}

func TestLoanReminderPayload_UnicodeEmojis(t *testing.T) {
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "John 👨‍💻 Doe",
		BorrowerEmail: "john@example.com",
		ItemName:      "MacBook 💻 Pro",
		DueDate:       time.Now(),
		IsOverdue:     false,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, payload.BorrowerName, decoded.BorrowerName)
	assert.Equal(t, payload.ItemName, decoded.ItemName)
}

func TestLoanReminderPayload_SpecialCharacters(t *testing.T) {
	tests := []struct {
		name         string
		borrowerName string
		itemName     string
	}{
		{"quotes", `John "Johnny" Doe`, `Item with "quotes"`},
		{"backslashes", `John\\Doe`, `Item\\with\\slashes`},
		{"newlines", "John\nDoe", "Item\nwith\nnewlines"},
		{"tabs", "John\tDoe", "Item\twith\ttabs"},
		{"unicode", "Müller Ñoño", "Ñoño Item™"},
		{"mixed", `John "O'Neil" <test>`, `Item & "Things" ™`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := LoanReminderPayload{
				LoanID:        uuid.New(),
				WorkspaceID:   uuid.New(),
				BorrowerName:  tt.borrowerName,
				BorrowerEmail: "test@example.com",
				ItemName:      tt.itemName,
				DueDate:       time.Now(),
				IsOverdue:     false,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded LoanReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, tt.borrowerName, decoded.BorrowerName)
			assert.Equal(t, tt.itemName, decoded.ItemName)
		})
	}
}

func TestLoanReminderPayload_EmptyStrings(t *testing.T) {
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "",
		BorrowerEmail: "",
		ItemName:      "",
		DueDate:       time.Now(),
		IsOverdue:     false,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Empty(t, decoded.BorrowerName)
	assert.Empty(t, decoded.BorrowerEmail)
	assert.Empty(t, decoded.ItemName)
}

func TestLoanReminderPayload_OverdueFlag(t *testing.T) {
	tests := []struct {
		name      string
		isOverdue bool
	}{
		{"not overdue", false},
		{"overdue", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := LoanReminderPayload{
				LoanID:    uuid.New(),
				IsOverdue: tt.isOverdue,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded LoanReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, tt.isOverdue, decoded.IsOverdue)
		})
	}
}

func TestLoanReminderPayload_FutureDates(t *testing.T) {
	tests := []struct {
		name    string
		dueDate time.Time
	}{
		{"tomorrow", time.Now().Add(24 * time.Hour)},
		{"next week", time.Now().Add(7 * 24 * time.Hour)},
		{"next month", time.Now().AddDate(0, 1, 0)},
		{"next year", time.Now().AddDate(1, 0, 0)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := LoanReminderPayload{
				LoanID:    uuid.New(),
				DueDate:   tt.dueDate.Truncate(time.Second),
				IsOverdue: false,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded LoanReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, payload.DueDate.Unix(), decoded.DueDate.Unix())
		})
	}
}

func TestLoanReminderPayload_PastDates(t *testing.T) {
	tests := []struct {
		name    string
		dueDate time.Time
	}{
		{"yesterday", time.Now().Add(-24 * time.Hour)},
		{"last week", time.Now().Add(-7 * 24 * time.Hour)},
		{"last month", time.Now().AddDate(0, -1, 0)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := LoanReminderPayload{
				LoanID:    uuid.New(),
				DueDate:   tt.dueDate.Truncate(time.Second),
				IsOverdue: true,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded LoanReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, payload.DueDate.Unix(), decoded.DueDate.Unix())
			assert.True(t, decoded.IsOverdue)
		})
	}
}

// =============================================================================
// LoanReminderProcessor Tests
// =============================================================================

func TestLoanReminderProcessor_ProcessTask_Success(t *testing.T) {
	sender := &testTrackingEmailSender{}
	processor := NewLoanReminderProcessor(nil, sender, nil)

	dueDate := time.Now().Add(48 * time.Hour)
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "John Doe",
		BorrowerEmail: "john@example.com",
		ItemName:      "Power Drill",
		DueDate:       dueDate,
		IsOverdue:     false,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	task := asynq.NewTask(TypeLoanReminder, payloadBytes)
	err = processor.ProcessTask(context.Background(), task)
	require.NoError(t, err)

	// Verify email was sent with correct data
	require.Len(t, sender.sentEmails, 1)
	assert.Equal(t, "john@example.com", sender.sentEmails[0].to)
	assert.Equal(t, "John Doe", sender.sentEmails[0].borrowerName)
	assert.Equal(t, "Power Drill", sender.sentEmails[0].itemName)
	assert.False(t, sender.sentEmails[0].isOverdue)
}

func TestLoanReminderProcessor_ProcessTask_OverdueEmail(t *testing.T) {
	sender := &testTrackingEmailSender{}
	processor := NewLoanReminderProcessor(nil, sender, nil)

	dueDate := time.Now().Add(-48 * time.Hour)
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "Jane Smith",
		BorrowerEmail: "jane@example.com",
		ItemName:      "Circular Saw",
		DueDate:       dueDate,
		IsOverdue:     true,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	task := asynq.NewTask(TypeLoanReminder, payloadBytes)
	err = processor.ProcessTask(context.Background(), task)
	require.NoError(t, err)

	require.Len(t, sender.sentEmails, 1)
	assert.True(t, sender.sentEmails[0].isOverdue)
}

func TestLoanReminderProcessor_ProcessTask_EmailSenderError(t *testing.T) {
	errorSender := &testErrorEmailSender{
		sendError: errors.New("SMTP connection failed"),
	}
	processor := NewLoanReminderProcessor(nil, errorSender, nil)

	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "John Doe",
		BorrowerEmail: "john@example.com",
		ItemName:      "Power Drill",
		DueDate:       time.Now().Add(24 * time.Hour),
		IsOverdue:     false,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	task := asynq.NewTask(TypeLoanReminder, payloadBytes)
	err = processor.ProcessTask(context.Background(), task)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to send loan reminder email")
	assert.Contains(t, err.Error(), "SMTP connection failed")
}

func TestLoanReminderProcessor_ProcessTask_NilEmailSender(t *testing.T) {
	processor := NewLoanReminderProcessor(nil, nil, nil)

	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "John Doe",
		BorrowerEmail: "john@example.com",
		ItemName:      "Power Drill",
		DueDate:       time.Now().Add(24 * time.Hour),
		IsOverdue:     false,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	task := asynq.NewTask(TypeLoanReminder, payloadBytes)
	err = processor.ProcessTask(context.Background(), task)

	// Should succeed without sending email
	assert.NoError(t, err)
}

func TestLoanReminderProcessor_ProcessTask_InvalidPayload(t *testing.T) {
	processor := NewLoanReminderProcessor(nil, nil, nil)

	tests := []struct {
		name    string
		payload []byte
	}{
		{"empty payload", []byte{}},
		{"invalid json", []byte("not valid json")},
		{"truncated json", []byte(`{"loan_id": "abc`)},
		{"malformed object", []byte(`{loan_id: 123}`)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := asynq.NewTask(TypeLoanReminder, tt.payload)
			err := processor.ProcessTask(context.Background(), task)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed to unmarshal payload")
		})
	}
}

func TestLoanReminderProcessor_ProcessTask_InvalidUUID(t *testing.T) {
	processor := NewLoanReminderProcessor(nil, nil, nil)

	// Payload with invalid UUID format
	payload := []byte(`{"loan_id": "not-a-valid-uuid"}`)
	task := asynq.NewTask(TypeLoanReminder, payload)
	err := processor.ProcessTask(context.Background(), task)

	assert.Error(t, err)
}

func TestLoanReminderProcessor_ProcessTask_MultipleEmails(t *testing.T) {
	sender := &testTrackingEmailSender{}
	processor := NewLoanReminderProcessor(nil, sender, nil)

	// Process multiple tasks
	for i := 0; i < 5; i++ {
		payload := LoanReminderPayload{
			LoanID:        uuid.New(),
			WorkspaceID:   uuid.New(),
			BorrowerName:  "User " + string(rune('A'+i)),
			BorrowerEmail: "user" + string(rune('a'+i)) + "@example.com",
			ItemName:      "Item " + string(rune('1'+i)),
			DueDate:       time.Now().Add(time.Duration(i+1) * 24 * time.Hour),
			IsOverdue:     false,
		}

		payloadBytes, err := json.Marshal(payload)
		require.NoError(t, err)

		task := asynq.NewTask(TypeLoanReminder, payloadBytes)
		err = processor.ProcessTask(context.Background(), task)
		require.NoError(t, err)
	}

	// Verify all emails were sent
	assert.Len(t, sender.sentEmails, 5)
}

func TestLoanReminderProcessor_ProcessTask_ContextCancellation(t *testing.T) {
	sender := &testContextAwareEmailSender{delay: 100 * time.Millisecond}
	processor := NewLoanReminderProcessor(nil, sender, nil)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "John Doe",
		BorrowerEmail: "john@example.com",
		ItemName:      "Test Item",
		DueDate:       time.Now(),
		IsOverdue:     false,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	task := asynq.NewTask(TypeLoanReminder, payloadBytes)
	err = processor.ProcessTask(ctx, task)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "context canceled")
}

// =============================================================================
// LoanReminderScheduler Constructor Tests
// =============================================================================

func TestNewLoanReminderScheduler_NilPool(t *testing.T) {
	scheduler := NewLoanReminderScheduler(nil, nil)
	assert.NotNil(t, scheduler)
}

func TestNewLoanReminderScheduler_NilClient(t *testing.T) {
	scheduler := NewLoanReminderScheduler(nil, nil)
	assert.NotNil(t, scheduler)
}

// =============================================================================
// NewScheduleLoanRemindersTask Tests
// =============================================================================

func TestNewScheduleLoanRemindersTask_Type(t *testing.T) {
	task := NewScheduleLoanRemindersTask()

	assert.NotNil(t, task)
	assert.Equal(t, TypeLoanReminder+":schedule", task.Type())
}

func TestNewScheduleLoanRemindersTask_NoPayload(t *testing.T) {
	task := NewScheduleLoanRemindersTask()

	assert.Nil(t, task.Payload())
}

func TestNewScheduleLoanRemindersTask_MultipleInstances(t *testing.T) {
	task1 := NewScheduleLoanRemindersTask()
	task2 := NewScheduleLoanRemindersTask()

	// Each instance should be independent but same type
	assert.Equal(t, task1.Type(), task2.Type())
}

// =============================================================================
// Email Address Validation Tests (edge cases)
// =============================================================================

func TestLoanReminderPayload_VariousEmailFormats(t *testing.T) {
	tests := []struct {
		name  string
		email string
	}{
		{"simple", "test@example.com"},
		{"with subdomain", "test@mail.example.com"},
		{"with plus", "test+tag@example.com"},
		{"with dots", "first.last@example.com"},
		{"short domain", "test@ex.co"},
		{"long domain", "test@example.organization"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := LoanReminderPayload{
				LoanID:        uuid.New(),
				BorrowerEmail: tt.email,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded LoanReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, tt.email, decoded.BorrowerEmail)
		})
	}
}

// =============================================================================
// Due Date Boundary Tests
// =============================================================================

func TestLoanReminderPayload_DueDateBoundaries(t *testing.T) {
	tests := []struct {
		name    string
		dueDate time.Time
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
			payload := LoanReminderPayload{
				LoanID:  uuid.New(),
				DueDate: tt.dueDate,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded LoanReminderPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			// Compare at second precision since JSON doesn't preserve nanoseconds
			assert.Equal(t, payload.DueDate.Unix(), decoded.DueDate.Unix())
		})
	}
}
