package jobs

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// Additional loan reminder payload tests beyond those in jobs_test.go

func TestLoanReminderPayload_LongStrings(t *testing.T) {
	loanID := uuid.New()
	workspaceID := uuid.New()
	dueDate := time.Now()

	// Very long strings to test buffer handling
	longName := string(make([]byte, 1000))
	for i := range longName {
		longName = string(append([]byte(longName[:i]), 'A'))
	}

	payload := LoanReminderPayload{
		LoanID:        loanID,
		WorkspaceID:   workspaceID,
		BorrowerName:  longName[:500],
		BorrowerEmail: "test@example.com",
		ItemName:      longName[:500],
		DueDate:       dueDate,
		IsOverdue:     false,
	}

	// Should still marshal/unmarshal successfully
	data, err := json.Marshal(payload)
	assert.NoError(t, err)

	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)

	assert.Len(t, decoded.BorrowerName, 500)
	assert.Len(t, decoded.ItemName, 500)
}

func TestLoanReminderPayload_ZeroTime(t *testing.T) {
	loanID := uuid.New()
	workspaceID := uuid.New()

	payload := LoanReminderPayload{
		LoanID:        loanID,
		WorkspaceID:   workspaceID,
		BorrowerName:  "Test User",
		BorrowerEmail: "test@example.com",
		ItemName:      "Test Item",
		DueDate:       time.Time{}, // Zero time
		IsOverdue:     false,
	}

	// Marshal to JSON
	data, err := json.Marshal(payload)
	assert.NoError(t, err)

	// Unmarshal back
	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)

	assert.True(t, decoded.DueDate.IsZero())
}

func TestLoanReminderPayload_UnicodeEmojis(t *testing.T) {
	loanID := uuid.New()
	workspaceID := uuid.New()
	dueDate := time.Now()

	payload := LoanReminderPayload{
		LoanID:        loanID,
		WorkspaceID:   workspaceID,
		BorrowerName:  "John 👨‍💻 Doe",
		BorrowerEmail: "john@example.com",
		ItemName:      "MacBook 💻 Pro",
		DueDate:       dueDate,
		IsOverdue:     false,
	}

	// Marshal to JSON
	data, err := json.Marshal(payload)
	assert.NoError(t, err)

	// Unmarshal back
	var decoded LoanReminderPayload
	err = json.Unmarshal(data, &decoded)
	assert.NoError(t, err)

	// Verify emoji characters are preserved
	assert.Equal(t, payload.BorrowerName, decoded.BorrowerName)
	assert.Equal(t, payload.ItemName, decoded.ItemName)
}
