package repairlog

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewRepairLog_ValidInput(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	description := "Screen replacement"

	repair, err := NewRepairLog(
		workspaceID,
		inventoryID,
		description,
		nil, nil, nil, nil, nil,
		false, nil,
	)

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, repair.ID())
	assert.Equal(t, workspaceID, repair.WorkspaceID())
	assert.Equal(t, inventoryID, repair.InventoryID())
	assert.Equal(t, StatusPending, repair.Status())
	assert.Equal(t, description, repair.Description())
	assert.Nil(t, repair.RepairDate())
	assert.Nil(t, repair.Cost())
	assert.Nil(t, repair.CurrencyCode())
	assert.Nil(t, repair.ServiceProvider())
	assert.Nil(t, repair.CompletedAt())
	assert.Nil(t, repair.NewCondition())
	assert.Nil(t, repair.Notes())
	assert.False(t, repair.IsWarrantyClaim())
	assert.Nil(t, repair.ReminderDate())
	assert.False(t, repair.ReminderSent())
	assert.True(t, repair.IsPending())
	assert.False(t, repair.IsInProgress())
	assert.False(t, repair.IsCompleted())
}

func TestNewRepairLog_WithAllFields(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	description := "Battery replacement"
	repairDate := time.Now()
	cost := 5000 // 50.00 EUR
	currencyCode := "EUR"
	serviceProvider := "Local Repair Shop"
	notes := "Under warranty"
	reminderDate := time.Now().Add(24 * time.Hour)

	repair, err := NewRepairLog(
		workspaceID,
		inventoryID,
		description,
		&repairDate,
		&cost,
		&currencyCode,
		&serviceProvider,
		&notes,
		true,
		&reminderDate,
	)

	require.NoError(t, err)
	assert.Equal(t, description, repair.Description())
	assert.Equal(t, repairDate, *repair.RepairDate())
	assert.Equal(t, cost, *repair.Cost())
	assert.Equal(t, currencyCode, *repair.CurrencyCode())
	assert.Equal(t, serviceProvider, *repair.ServiceProvider())
	assert.Equal(t, notes, *repair.Notes())
	assert.True(t, repair.IsWarrantyClaim())
	assert.Equal(t, reminderDate, *repair.ReminderDate())
}

func TestNewRepairLog_EmptyDescription(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()

	_, err := NewRepairLog(
		workspaceID,
		inventoryID,
		"",
		nil, nil, nil, nil, nil,
		false, nil,
	)

	assert.ErrorIs(t, err, ErrInvalidDescription)
}

func TestNewRepairLog_WhitespaceDescription(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()

	_, err := NewRepairLog(
		workspaceID,
		inventoryID,
		"   ",
		nil, nil, nil, nil, nil,
		false, nil,
	)

	assert.ErrorIs(t, err, ErrInvalidDescription)
}

func TestNewRepairLog_NilWorkspaceID(t *testing.T) {
	inventoryID := uuid.New()

	_, err := NewRepairLog(
		uuid.Nil,
		inventoryID,
		"Fix broken part",
		nil, nil, nil, nil, nil,
		false, nil,
	)

	assert.Error(t, err)
}

func TestNewRepairLog_NilInventoryID(t *testing.T) {
	workspaceID := uuid.New()

	_, err := NewRepairLog(
		workspaceID,
		uuid.Nil,
		"Fix broken part",
		nil, nil, nil, nil, nil,
		false, nil,
	)

	assert.Error(t, err)
}

func TestStartRepair_FromPending(t *testing.T) {
	repair := createTestRepairLog(t, StatusPending)

	err := repair.StartRepair()

	assert.NoError(t, err)
	assert.Equal(t, StatusInProgress, repair.Status())
	assert.True(t, repair.IsInProgress())
	assert.False(t, repair.IsPending())
}

func TestStartRepair_FromInProgress_Fails(t *testing.T) {
	repair := createTestRepairLog(t, StatusInProgress)

	err := repair.StartRepair()

	assert.ErrorIs(t, err, ErrInvalidStatusTransition)
	assert.Equal(t, StatusInProgress, repair.Status())
}

func TestStartRepair_FromCompleted_Fails(t *testing.T) {
	repair := createTestRepairLog(t, StatusCompleted)

	err := repair.StartRepair()

	assert.ErrorIs(t, err, ErrInvalidStatusTransition)
	assert.Equal(t, StatusCompleted, repair.Status())
}

func TestComplete_FromInProgress(t *testing.T) {
	repair := createTestRepairLog(t, StatusInProgress)
	condition := "GOOD"

	err := repair.Complete(&condition)

	assert.NoError(t, err)
	assert.Equal(t, StatusCompleted, repair.Status())
	assert.NotNil(t, repair.CompletedAt())
	assert.Equal(t, condition, *repair.NewCondition())
	assert.True(t, repair.IsCompleted())
	assert.False(t, repair.IsInProgress())
}

func TestComplete_FromInProgress_WithoutCondition(t *testing.T) {
	repair := createTestRepairLog(t, StatusInProgress)

	err := repair.Complete(nil)

	assert.NoError(t, err)
	assert.Equal(t, StatusCompleted, repair.Status())
	assert.NotNil(t, repair.CompletedAt())
	assert.Nil(t, repair.NewCondition())
}

func TestComplete_FromPending_Fails(t *testing.T) {
	repair := createTestRepairLog(t, StatusPending)
	condition := "GOOD"

	err := repair.Complete(&condition)

	assert.ErrorIs(t, err, ErrInvalidStatusTransition)
	assert.Equal(t, StatusPending, repair.Status())
	assert.Nil(t, repair.CompletedAt())
}

func TestComplete_FromCompleted_Fails(t *testing.T) {
	repair := createTestRepairLog(t, StatusCompleted)
	condition := "EXCELLENT"

	err := repair.Complete(&condition)

	assert.ErrorIs(t, err, ErrInvalidStatusTransition)
}

func TestComplete_SetsCompletedAt(t *testing.T) {
	repair := createTestRepairLog(t, StatusInProgress)
	beforeComplete := time.Now()

	err := repair.Complete(nil)

	require.NoError(t, err)
	assert.NotNil(t, repair.CompletedAt())
	assert.True(t, repair.CompletedAt().After(beforeComplete) || repair.CompletedAt().Equal(beforeComplete))
}

func TestUpdateDetails_Success(t *testing.T) {
	repair := createTestRepairLog(t, StatusPending)
	newDescription := "Updated description"
	newDate := time.Now()
	newCost := 10000
	newCurrency := "USD"
	newProvider := "New Provider"
	newNotes := "New notes"

	err := repair.UpdateDetails(
		newDescription,
		&newDate,
		&newCost,
		&newCurrency,
		&newProvider,
		&newNotes,
	)

	assert.NoError(t, err)
	assert.Equal(t, newDescription, repair.Description())
	assert.Equal(t, newDate, *repair.RepairDate())
	assert.Equal(t, newCost, *repair.Cost())
	assert.Equal(t, newCurrency, *repair.CurrencyCode())
	assert.Equal(t, newProvider, *repair.ServiceProvider())
	assert.Equal(t, newNotes, *repair.Notes())
}

func TestUpdateDetails_InProgress_Success(t *testing.T) {
	repair := createTestRepairLog(t, StatusInProgress)

	err := repair.UpdateDetails(
		"Updated while in progress",
		nil, nil, nil, nil, nil,
	)

	assert.NoError(t, err)
	assert.Equal(t, "Updated while in progress", repair.Description())
}

func TestUpdateDetails_Completed_Fails(t *testing.T) {
	repair := createTestRepairLog(t, StatusCompleted)

	err := repair.UpdateDetails(
		"Cannot update completed",
		nil, nil, nil, nil, nil,
	)

	assert.ErrorIs(t, err, ErrRepairAlreadyCompleted)
}

func TestUpdateDetails_EmptyDescription_Fails(t *testing.T) {
	repair := createTestRepairLog(t, StatusPending)

	err := repair.UpdateDetails(
		"",
		nil, nil, nil, nil, nil,
	)

	assert.ErrorIs(t, err, ErrInvalidDescription)
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	status := StatusInProgress
	description := "Test repair"
	repairDate := time.Now()
	cost := 5000
	currencyCode := "EUR"
	serviceProvider := "Test Provider"
	notes := "Test notes"
	reminderDate := time.Now().Add(24 * time.Hour)
	createdAt := time.Now().Add(-time.Hour)
	updatedAt := time.Now()

	repair := Reconstruct(
		id, workspaceID, inventoryID,
		status, description,
		&repairDate, &cost, &currencyCode, &serviceProvider,
		nil, nil, &notes,
		true, &reminderDate, false,
		createdAt, updatedAt,
	)

	assert.Equal(t, id, repair.ID())
	assert.Equal(t, workspaceID, repair.WorkspaceID())
	assert.Equal(t, inventoryID, repair.InventoryID())
	assert.Equal(t, status, repair.Status())
	assert.Equal(t, description, repair.Description())
	assert.Equal(t, repairDate, *repair.RepairDate())
	assert.Equal(t, cost, *repair.Cost())
	assert.Equal(t, currencyCode, *repair.CurrencyCode())
	assert.Equal(t, serviceProvider, *repair.ServiceProvider())
	assert.Nil(t, repair.CompletedAt())
	assert.Nil(t, repair.NewCondition())
	assert.Equal(t, notes, *repair.Notes())
	assert.True(t, repair.IsWarrantyClaim())
	assert.Equal(t, reminderDate, *repair.ReminderDate())
	assert.False(t, repair.ReminderSent())
	assert.Equal(t, createdAt, repair.CreatedAt())
	assert.Equal(t, updatedAt, repair.UpdatedAt())
}

func TestEntity_SetWarrantyClaim_Success(t *testing.T) {
	repair := createTestRepairLog(t, StatusPending)

	err := repair.SetWarrantyClaim(true)

	assert.NoError(t, err)
	assert.True(t, repair.IsWarrantyClaim())
}

func TestEntity_SetWarrantyClaim_InProgress_Success(t *testing.T) {
	repair := createTestRepairLog(t, StatusInProgress)

	err := repair.SetWarrantyClaim(true)

	assert.NoError(t, err)
	assert.True(t, repair.IsWarrantyClaim())
}

func TestEntity_SetWarrantyClaim_Completed_Fails(t *testing.T) {
	repair := createTestRepairLog(t, StatusCompleted)

	err := repair.SetWarrantyClaim(true)

	assert.ErrorIs(t, err, ErrRepairAlreadyCompleted)
}

func TestEntity_SetReminderDate_Success(t *testing.T) {
	repair := createTestRepairLog(t, StatusPending)
	futureDate := time.Now().Add(7 * 24 * time.Hour)

	err := repair.SetReminderDate(&futureDate)

	assert.NoError(t, err)
	assert.Equal(t, futureDate, *repair.ReminderDate())
	assert.False(t, repair.ReminderSent())
}

func TestEntity_SetReminderDate_ClearsReminder(t *testing.T) {
	now := time.Now()
	futureDate := now.Add(7 * 24 * time.Hour)
	repair := Reconstruct(
		uuid.New(), uuid.New(), uuid.New(), StatusPending,
		"Test", nil, nil, nil, nil, nil, nil, nil,
		false, &futureDate, true, // reminderSent = true
		now, now,
	)

	err := repair.SetReminderDate(nil)

	assert.NoError(t, err)
	assert.Nil(t, repair.ReminderDate())
	assert.False(t, repair.ReminderSent()) // Should be reset
}

func TestEntity_SetReminderDate_ResetsReminderSentFlag(t *testing.T) {
	now := time.Now()
	oldDate := now.Add(7 * 24 * time.Hour)
	repair := Reconstruct(
		uuid.New(), uuid.New(), uuid.New(), StatusPending,
		"Test", nil, nil, nil, nil, nil, nil, nil,
		false, &oldDate, true, // reminderSent = true
		now, now,
	)

	newDate := now.Add(14 * 24 * time.Hour)
	err := repair.SetReminderDate(&newDate)

	assert.NoError(t, err)
	assert.Equal(t, newDate, *repair.ReminderDate())
	assert.False(t, repair.ReminderSent()) // Should be reset when date changes
}

func TestEntity_SetReminderDate_Completed_Fails(t *testing.T) {
	repair := createTestRepairLog(t, StatusCompleted)
	futureDate := time.Now().Add(7 * 24 * time.Hour)

	err := repair.SetReminderDate(&futureDate)

	assert.ErrorIs(t, err, ErrRepairAlreadyCompleted)
}

func TestMarkReminderSent(t *testing.T) {
	now := time.Now()
	futureDate := now.Add(7 * 24 * time.Hour)
	repair := Reconstruct(
		uuid.New(), uuid.New(), uuid.New(), StatusPending,
		"Test", nil, nil, nil, nil, nil, nil, nil,
		false, &futureDate, false,
		now, now,
	)

	repair.MarkReminderSent()

	assert.True(t, repair.ReminderSent())
}

func TestReconstruct_WithCompletedFields(t *testing.T) {
	now := time.Now()
	completedAt := now.Add(-time.Hour)
	newCondition := "EXCELLENT"

	repair := Reconstruct(
		uuid.New(), uuid.New(), uuid.New(),
		StatusCompleted, "Completed repair",
		nil, nil, nil, nil,
		&completedAt, &newCondition, nil,
		false, nil, false,
		now.Add(-2*time.Hour), now,
	)

	assert.Equal(t, StatusCompleted, repair.Status())
	assert.NotNil(t, repair.CompletedAt())
	assert.Equal(t, completedAt, *repair.CompletedAt())
	assert.NotNil(t, repair.NewCondition())
	assert.Equal(t, newCondition, *repair.NewCondition())
	assert.True(t, repair.IsCompleted())
}

func TestReconstruct_WithReminderSent(t *testing.T) {
	now := time.Now()
	reminderDate := now.Add(-time.Hour)

	repair := Reconstruct(
		uuid.New(), uuid.New(), uuid.New(),
		StatusPending, "Test",
		nil, nil, nil, nil, nil, nil, nil,
		false, &reminderDate, true, // reminderSent = true
		now, now,
	)

	assert.Equal(t, reminderDate, *repair.ReminderDate())
	assert.True(t, repair.ReminderSent())
}

// Helper function to create test repair logs with specific status
func createTestRepairLog(t *testing.T, status RepairStatus) *RepairLog {
	t.Helper()

	now := time.Now()
	var completedAt *time.Time
	if status == StatusCompleted {
		completedAt = &now
	}

	return Reconstruct(
		uuid.New(),
		uuid.New(),
		uuid.New(),
		status,
		"Test repair",
		nil, nil, nil, nil,
		completedAt,
		nil, nil,
		false, nil, false,
		now, now,
	)
}
