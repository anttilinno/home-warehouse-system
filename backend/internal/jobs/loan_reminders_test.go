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

// =============================================================================
// LoanReminderProcessor Additional Error Path Tests
// =============================================================================

func TestLoanReminderProcessor_ProcessTask_InvalidPayloadTypes(t *testing.T) {
	processor := NewLoanReminderProcessor(nil, nil, nil)

	tests := []struct {
		name        string
		payload     []byte
		errContains string
	}{
		{
			name:        "array instead of object",
			payload:     []byte("[1,2,3]"),
			errContains: "failed to unmarshal payload",
		},
		{
			name:        "string instead of object",
			payload:     []byte(`"just a string"`),
			errContains: "failed to unmarshal payload",
		},
		{
			name:        "number instead of object",
			payload:     []byte("12345"),
			errContains: "failed to unmarshal payload",
		},
		{
			name:        "boolean instead of object",
			payload:     []byte("true"),
			errContains: "failed to unmarshal payload",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := asynq.NewTask(TypeLoanReminder, tt.payload)
			err := processor.ProcessTask(context.Background(), task)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.errContains)
		})
	}
}

func TestLoanReminderProcessor_ProcessTask_EmailSenderVariousErrors(t *testing.T) {
	tests := []struct {
		name          string
		sendError     error
		errContains   string
	}{
		{
			name:          "network timeout",
			sendError:     errors.New("connection timeout"),
			errContains:   "connection timeout",
		},
		{
			name:          "invalid recipient",
			sendError:     errors.New("invalid email address"),
			errContains:   "invalid email address",
		},
		{
			name:          "mail server unavailable",
			sendError:     errors.New("503 service unavailable"),
			errContains:   "503 service unavailable",
		},
		{
			name:          "rate limited",
			sendError:     errors.New("too many requests"),
			errContains:   "too many requests",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errorSender := &testErrorEmailSender{sendError: tt.sendError}
			processor := NewLoanReminderProcessor(nil, errorSender, nil)

			payload := LoanReminderPayload{
				LoanID:        uuid.New(),
				WorkspaceID:   uuid.New(),
				BorrowerName:  "John Doe",
				BorrowerEmail: "john@example.com",
				ItemName:      "Test Item",
				DueDate:       time.Now().Add(24 * time.Hour),
				IsOverdue:     false,
			}

			payloadBytes, err := json.Marshal(payload)
			require.NoError(t, err)

			task := asynq.NewTask(TypeLoanReminder, payloadBytes)
			err = processor.ProcessTask(context.Background(), task)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.errContains)
		})
	}
}

func TestLoanReminderProcessor_ProcessTask_WithTimeout(t *testing.T) {
	// Test that context timeout is respected
	sender := &testContextAwareEmailSender{delay: 1 * time.Second}
	processor := NewLoanReminderProcessor(nil, sender, nil)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

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
	// Could be either deadline exceeded or context canceled
	assert.True(t, strings.Contains(err.Error(), "deadline exceeded") ||
		strings.Contains(err.Error(), "context"))
}

// =============================================================================
// LoanReminderPayload Field Validation Tests
// =============================================================================

func TestLoanReminderPayload_AllFieldsSerialization(t *testing.T) {
	// Test that all fields serialize correctly
	loanID := uuid.New()
	workspaceID := uuid.New()

	payload := LoanReminderPayload{
		LoanID:        loanID,
		WorkspaceID:   workspaceID,
		BorrowerName:  "Test User",
		BorrowerEmail: "test@example.com",
		ItemName:      "Test Item",
		DueDate:       time.Now(),
		IsOverdue:     true,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	jsonStr := string(data)
	assert.Contains(t, jsonStr, "loan_id")
	assert.Contains(t, jsonStr, "workspace_id")
	assert.Contains(t, jsonStr, "borrower_name")
	assert.Contains(t, jsonStr, "borrower_email")
	assert.Contains(t, jsonStr, "item_name")
	assert.Contains(t, jsonStr, "due_date")
	assert.Contains(t, jsonStr, "is_overdue")
}

func TestLoanReminderPayload_ZeroUUIDs(t *testing.T) {
	payload := LoanReminderPayload{
		LoanID:        uuid.Nil,
		WorkspaceID:   uuid.Nil,
		BorrowerName:  "Test User",
		BorrowerEmail: "test@example.com",
		ItemName:      "Test Item",
		DueDate:       time.Now(),
		IsOverdue:     false,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, uuid.Nil, decoded.LoanID)
	assert.Equal(t, uuid.Nil, decoded.WorkspaceID)
}

// =============================================================================
// Concurrent Access Tests
// =============================================================================

func TestLoanReminderPayload_ConcurrentMarshal(t *testing.T) {
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "Test User",
		BorrowerEmail: "test@example.com",
		ItemName:      "Test Item",
		DueDate:       time.Now(),
		IsOverdue:     false,
	}

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			data, err := json.Marshal(payload)
			require.NoError(t, err)
			require.NotEmpty(t, data)
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestNewScheduleLoanRemindersTask_Concurrent(t *testing.T) {
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			task := NewScheduleLoanRemindersTask()
			require.NotNil(t, task)
			require.Equal(t, TypeLoanReminder+":schedule", task.Type())
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestLoanReminderProcessor_ConcurrentProcessing(t *testing.T) {
	sender := &testTrackingEmailSender{}
	processor := NewLoanReminderProcessor(nil, sender, nil)

	done := make(chan bool)
	for i := 0; i < 5; i++ {
		go func(idx int) {
			payload := LoanReminderPayload{
				LoanID:        uuid.New(),
				WorkspaceID:   uuid.New(),
				BorrowerName:  "User",
				BorrowerEmail: "user@example.com",
				ItemName:      "Item",
				DueDate:       time.Now().Add(24 * time.Hour),
				IsOverdue:     false,
			}

			payloadBytes, _ := json.Marshal(payload)
			task := asynq.NewTask(TypeLoanReminder, payloadBytes)
			_ = processor.ProcessTask(context.Background(), task)
			done <- true
		}(i)
	}

	for i := 0; i < 5; i++ {
		<-done
	}

	// All 5 emails should have been tracked
	assert.Len(t, sender.sentEmails, 5)
}

// =============================================================================
// LoanReminderScheduler Tests
// =============================================================================

func TestNewLoanReminderScheduler_ReturnsValidInstance(t *testing.T) {
	scheduler := NewLoanReminderScheduler(nil, nil)

	// Scheduler should not be nil even with nil dependencies
	assert.NotNil(t, scheduler)
}

func TestNewLoanReminderScheduler_MultipleInstances(t *testing.T) {
	scheduler1 := NewLoanReminderScheduler(nil, nil)
	scheduler2 := NewLoanReminderScheduler(nil, nil)

	assert.NotNil(t, scheduler1)
	assert.NotNil(t, scheduler2)
	assert.NotSame(t, scheduler1, scheduler2)
}

// =============================================================================
// Type Constant Tests
// =============================================================================

func TestTypeLoanReminder_Value(t *testing.T) {
	assert.Equal(t, "loan:reminder", TypeLoanReminder)
}

func TestTypeLoanReminder_NotEqualToOtherTypes(t *testing.T) {
	assert.NotEqual(t, TypeRepairReminder, TypeLoanReminder)
	assert.NotEqual(t, TypeCleanupDeletedRecords, TypeLoanReminder)
	assert.NotEqual(t, TypeCleanupOldActivity, TypeLoanReminder)
}
