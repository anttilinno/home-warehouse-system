package repairlog

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MockRepository implements Repository for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, repair *RepairLog) error {
	args := m.Called(ctx, repair)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairLog, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*RepairLog), args.Error(1)
}

func (m *MockRepository) FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*RepairLog, error) {
	args := m.Called(ctx, workspaceID, inventoryID)
	return args.Get(0).([]*RepairLog), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*RepairLog, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*RepairLog), args.Int(1), args.Error(2)
}

func (m *MockRepository) FindByStatus(ctx context.Context, workspaceID uuid.UUID, status RepairStatus, pagination shared.Pagination) ([]*RepairLog, error) {
	args := m.Called(ctx, workspaceID, status, pagination)
	return args.Get(0).([]*RepairLog), args.Error(1)
}

func (m *MockRepository) CountByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) (int, error) {
	args := m.Called(ctx, workspaceID, inventoryID)
	return args.Int(0), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) UpdateWarrantyClaim(ctx context.Context, id, workspaceID uuid.UUID, isWarrantyClaim bool) error {
	args := m.Called(ctx, id, workspaceID, isWarrantyClaim)
	return args.Error(0)
}

func (m *MockRepository) UpdateReminderDate(ctx context.Context, id, workspaceID uuid.UUID, reminderDate *time.Time) error {
	args := m.Called(ctx, id, workspaceID, reminderDate)
	return args.Error(0)
}

func (m *MockRepository) MarkReminderSent(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) GetTotalRepairCost(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]RepairCostSummary, error) {
	args := m.Called(ctx, workspaceID, inventoryID)
	return args.Get(0).([]RepairCostSummary), args.Error(1)
}

// MockInventoryRepository implements inventory.Repository for testing
type MockInventoryRepository struct {
	mock.Mock
}

func (m *MockInventoryRepository) Save(ctx context.Context, inv *inventory.Inventory) error {
	args := m.Called(ctx, inv)
	return args.Error(0)
}

func (m *MockInventoryRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*inventory.Inventory, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*inventory.Inventory), args.Int(1), args.Error(2)
}

func (m *MockInventoryRepository) FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, locationID)
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) FindByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, containerID)
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) FindAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockInventoryRepository) GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Int(0), args.Error(1)
}

func (m *MockInventoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// Helper to create a test inventory for service tests
func newTestInventory(workspaceID, itemID, locationID uuid.UUID) *inventory.Inventory {
	return inventory.Reconstruct(
		uuid.New(),
		workspaceID,
		itemID,
		locationID,
		nil,
		1,
		inventory.ConditionGood,
		inventory.StatusAvailable,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		false,
		time.Now(),
		time.Now(),
	)
}

// Helper to create a test repair log in PENDING status for service tests
func newPendingRepairLog(workspaceID, inventoryID uuid.UUID) *RepairLog {
	return Reconstruct(
		uuid.New(),
		workspaceID,
		inventoryID,
		StatusPending,
		"Test repair",
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		false, nil, false,
		time.Now(),
		time.Now(),
	)
}

// Helper to create a test repair log in IN_PROGRESS status for service tests
func newInProgressRepairLog(workspaceID, inventoryID uuid.UUID) *RepairLog {
	return Reconstruct(
		uuid.New(),
		workspaceID,
		inventoryID,
		StatusInProgress,
		"Test repair",
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		false, nil, false,
		time.Now(),
		time.Now(),
	)
}

func TestCreate_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	inv := newTestInventory(workspaceID, itemID, locationID)

	mockInvRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
	mockRepo.On("Save", ctx, mock.AnythingOfType("*repairlog.RepairLog")).Return(nil)

	input := CreateInput{
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
		Description: "Screen replacement",
	}

	repairLog, err := svc.Create(ctx, input)

	assert.NoError(t, err)
	assert.NotNil(t, repairLog)
	assert.Equal(t, StatusPending, repairLog.Status())
	assert.Equal(t, "Screen replacement", repairLog.Description())
	mockInvRepo.AssertExpectations(t)
	mockRepo.AssertExpectations(t)
}

func TestCreate_InventoryNotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()

	mockInvRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(nil, shared.ErrNotFound)

	input := CreateInput{
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
		Description: "Screen replacement",
	}

	repairLog, err := svc.Create(ctx, input)

	assert.Error(t, err)
	assert.Nil(t, repairLog)
	assert.Equal(t, shared.ErrNotFound, err)
	mockInvRepo.AssertExpectations(t)
}

func TestStartRepair_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("Save", ctx, repair).Return(nil)

	result, err := svc.StartRepair(ctx, repair.ID(), workspaceID)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, StatusInProgress, result.Status())
	mockRepo.AssertExpectations(t)
}

func TestStartRepair_InvalidTransition(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	// Create repair already in progress
	repair := newInProgressRepairLog(workspaceID, inventoryID)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)

	result, err := svc.StartRepair(ctx, repair.ID(), workspaceID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrInvalidStatusTransition, err)
	mockRepo.AssertExpectations(t)
}

func TestComplete_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newInProgressRepairLog(workspaceID, inventoryID)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("Save", ctx, repair).Return(nil)

	result, err := svc.Complete(ctx, repair.ID(), workspaceID, nil)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, StatusCompleted, result.Status())
	assert.NotNil(t, result.CompletedAt())
	mockRepo.AssertExpectations(t)
}

func TestComplete_UpdatesInventoryCondition(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	repair := newInProgressRepairLog(workspaceID, inventoryID)
	// Override inventory ID to match what we return
	repair = Reconstruct(
		repair.ID(),
		workspaceID,
		inventoryID,
		StatusInProgress,
		repair.Description(),
		nil, nil, nil, nil, nil, nil, nil,
		false, nil, false,
		repair.CreatedAt(),
		repair.UpdatedAt(),
	)

	inv := newTestInventory(workspaceID, itemID, locationID)
	// Override inventory ID
	inv = inventory.Reconstruct(
		inventoryID,
		workspaceID,
		itemID,
		locationID,
		nil,
		1,
		inventory.ConditionDamaged,
		inventory.StatusAvailable,
		nil, nil, nil, nil, nil, nil,
		false,
		time.Now(),
		time.Now(),
	)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockInvRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
	mockInvRepo.On("Save", ctx, inv).Return(nil)
	mockRepo.On("Save", ctx, repair).Return(nil)

	newCondition := "EXCELLENT"
	result, err := svc.Complete(ctx, repair.ID(), workspaceID, &newCondition)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, StatusCompleted, result.Status())
	assert.Equal(t, &newCondition, result.NewCondition())
	// Verify inventory condition was updated
	assert.Equal(t, inventory.ConditionExcellent, inv.Condition())
	mockRepo.AssertExpectations(t)
	mockInvRepo.AssertExpectations(t)
}

func TestComplete_InvalidTransition(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	// Create repair still in PENDING status
	repair := newPendingRepairLog(workspaceID, inventoryID)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)

	result, err := svc.Complete(ctx, repair.ID(), workspaceID, nil)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrInvalidStatusTransition, err)
	mockRepo.AssertExpectations(t)
}

func TestUpdate_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("Save", ctx, repair).Return(nil)

	newDesc := "Updated description"
	cost := 5000
	input := UpdateInput{
		Description: &newDesc,
		Cost:        &cost,
	}

	result, err := svc.Update(ctx, repair.ID(), workspaceID, input)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "Updated description", result.Description())
	assert.Equal(t, &cost, result.Cost())
	mockRepo.AssertExpectations(t)
}

func TestUpdate_CompletedRepair(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	now := time.Now()
	// Create completed repair
	repair := Reconstruct(
		uuid.New(),
		workspaceID,
		inventoryID,
		StatusCompleted,
		"Test repair",
		nil, nil, nil, nil, &now, nil, nil,
		false, nil, false,
		now, now,
	)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)

	newDesc := "Updated description"
	input := UpdateInput{
		Description: &newDesc,
	}

	result, err := svc.Update(ctx, repair.ID(), workspaceID, input)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairAlreadyCompleted, err)
	mockRepo.AssertExpectations(t)
}

func TestDelete_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("Delete", ctx, repair.ID()).Return(nil)

	err := svc.Delete(ctx, repair.ID(), workspaceID)

	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestListByInventory_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()

	repairs := []*RepairLog{
		newPendingRepairLog(workspaceID, inventoryID),
		newInProgressRepairLog(workspaceID, inventoryID),
	}

	mockRepo.On("FindByInventory", ctx, workspaceID, inventoryID).Return(repairs, nil)

	result, err := svc.ListByInventory(ctx, workspaceID, inventoryID)

	assert.NoError(t, err)
	assert.Len(t, result, 2)
	mockRepo.AssertExpectations(t)
}

func TestListByWorkspace_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	pagination := shared.Pagination{Page: 1, PageSize: 10}

	repairs := []*RepairLog{
		newPendingRepairLog(workspaceID, inventoryID),
	}

	mockRepo.On("FindByWorkspace", ctx, workspaceID, pagination).Return(repairs, 1, nil)

	result, total, err := svc.ListByWorkspace(ctx, workspaceID, pagination)

	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, 1, total)
	mockRepo.AssertExpectations(t)
}

func TestListByStatus_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	pagination := shared.Pagination{Page: 1, PageSize: 10}

	repairs := []*RepairLog{
		newInProgressRepairLog(workspaceID, inventoryID),
	}

	mockRepo.On("FindByStatus", ctx, workspaceID, StatusInProgress, pagination).Return(repairs, nil)

	result, err := svc.ListByStatus(ctx, workspaceID, StatusInProgress, pagination)

	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, StatusInProgress, result[0].Status())
	mockRepo.AssertExpectations(t)
}

// ============ SetWarrantyClaim Tests ============

func TestSetWarrantyClaim_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("UpdateWarrantyClaim", ctx, repair.ID(), workspaceID, true).Return(nil)

	result, err := svc.SetWarrantyClaim(ctx, repair.ID(), workspaceID, true)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.True(t, result.IsWarrantyClaim())
	mockRepo.AssertExpectations(t)
}

func TestSetWarrantyClaim_SetToFalse(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	// Create repair with warranty claim already true
	repair := Reconstruct(
		uuid.New(), workspaceID, inventoryID, StatusPending,
		"Test", nil, nil, nil, nil, nil, nil, nil,
		true, nil, false, time.Now(), time.Now(),
	)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("UpdateWarrantyClaim", ctx, repair.ID(), workspaceID, false).Return(nil)

	result, err := svc.SetWarrantyClaim(ctx, repair.ID(), workspaceID, false)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.False(t, result.IsWarrantyClaim())
	mockRepo.AssertExpectations(t)
}

func TestSetWarrantyClaim_NotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	repairID := uuid.New()

	mockRepo.On("FindByID", ctx, repairID, workspaceID).Return(nil, ErrRepairLogNotFound)

	result, err := svc.SetWarrantyClaim(ctx, repairID, workspaceID, true)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairLogNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestSetWarrantyClaim_CompletedRepair(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	now := time.Now()
	// Create completed repair
	repair := Reconstruct(
		uuid.New(), workspaceID, inventoryID, StatusCompleted,
		"Test", nil, nil, nil, nil, &now, nil, nil,
		false, nil, false, now, now,
	)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)

	result, err := svc.SetWarrantyClaim(ctx, repair.ID(), workspaceID, true)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairAlreadyCompleted, err)
	mockRepo.AssertExpectations(t)
}

func TestSetWarrantyClaim_RepoError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)
	repoErr := errors.New("database: update failed")

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("UpdateWarrantyClaim", ctx, repair.ID(), workspaceID, true).Return(repoErr)

	result, err := svc.SetWarrantyClaim(ctx, repair.ID(), workspaceID, true)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, repoErr, err)
	mockRepo.AssertExpectations(t)
}

// ============ SetReminderDate Tests ============

func TestSetReminderDate_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)
	futureDate := time.Now().Add(7 * 24 * time.Hour)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("UpdateReminderDate", ctx, repair.ID(), workspaceID, &futureDate).Return(nil)

	result, err := svc.SetReminderDate(ctx, repair.ID(), workspaceID, &futureDate)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, futureDate, *result.ReminderDate())
	mockRepo.AssertExpectations(t)
}

func TestSetReminderDate_ClearReminder(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	existingReminder := time.Now().Add(7 * 24 * time.Hour)
	repair := Reconstruct(
		uuid.New(), workspaceID, inventoryID, StatusPending,
		"Test", nil, nil, nil, nil, nil, nil, nil,
		false, &existingReminder, false, time.Now(), time.Now(),
	)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("UpdateReminderDate", ctx, repair.ID(), workspaceID, (*time.Time)(nil)).Return(nil)

	result, err := svc.SetReminderDate(ctx, repair.ID(), workspaceID, nil)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Nil(t, result.ReminderDate())
	mockRepo.AssertExpectations(t)
}

func TestSetReminderDate_NotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	repairID := uuid.New()
	futureDate := time.Now().Add(7 * 24 * time.Hour)

	mockRepo.On("FindByID", ctx, repairID, workspaceID).Return(nil, ErrRepairLogNotFound)

	result, err := svc.SetReminderDate(ctx, repairID, workspaceID, &futureDate)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairLogNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestSetReminderDate_CompletedRepair(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	now := time.Now()
	futureDate := time.Now().Add(7 * 24 * time.Hour)
	repair := Reconstruct(
		uuid.New(), workspaceID, inventoryID, StatusCompleted,
		"Test", nil, nil, nil, nil, &now, nil, nil,
		false, nil, false, now, now,
	)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)

	result, err := svc.SetReminderDate(ctx, repair.ID(), workspaceID, &futureDate)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairAlreadyCompleted, err)
	mockRepo.AssertExpectations(t)
}

func TestSetReminderDate_RepoError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)
	futureDate := time.Now().Add(7 * 24 * time.Hour)
	repoErr := errors.New("database: update failed")

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("UpdateReminderDate", ctx, repair.ID(), workspaceID, &futureDate).Return(repoErr)

	result, err := svc.SetReminderDate(ctx, repair.ID(), workspaceID, &futureDate)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, repoErr, err)
	mockRepo.AssertExpectations(t)
}

func TestSetReminderDate_InProgressRepair(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newInProgressRepairLog(workspaceID, inventoryID)
	futureDate := time.Now().Add(7 * 24 * time.Hour)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("UpdateReminderDate", ctx, repair.ID(), workspaceID, &futureDate).Return(nil)

	result, err := svc.SetReminderDate(ctx, repair.ID(), workspaceID, &futureDate)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, futureDate, *result.ReminderDate())
	mockRepo.AssertExpectations(t)
}

// ============ GetTotalRepairCost Tests ============

func TestGetTotalRepairCost_Success(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	eur := "EUR"
	summaries := []RepairCostSummary{
		{CurrencyCode: &eur, TotalCostCents: 15000, RepairCount: 3},
	}

	mockRepo.On("GetTotalRepairCost", ctx, workspaceID, inventoryID).Return(summaries, nil)

	result, err := svc.GetTotalRepairCost(ctx, workspaceID, inventoryID)

	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, "EUR", *result[0].CurrencyCode)
	assert.Equal(t, 15000, result[0].TotalCostCents)
	assert.Equal(t, 3, result[0].RepairCount)
	mockRepo.AssertExpectations(t)
}

func TestGetTotalRepairCost_MultipleCurrencies(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	eur := "EUR"
	usd := "USD"
	summaries := []RepairCostSummary{
		{CurrencyCode: &eur, TotalCostCents: 15000, RepairCount: 3},
		{CurrencyCode: &usd, TotalCostCents: 5000, RepairCount: 1},
	}

	mockRepo.On("GetTotalRepairCost", ctx, workspaceID, inventoryID).Return(summaries, nil)

	result, err := svc.GetTotalRepairCost(ctx, workspaceID, inventoryID)

	assert.NoError(t, err)
	assert.Len(t, result, 2)
	mockRepo.AssertExpectations(t)
}

func TestGetTotalRepairCost_NoRepairs(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()

	mockRepo.On("GetTotalRepairCost", ctx, workspaceID, inventoryID).Return([]RepairCostSummary{}, nil)

	result, err := svc.GetTotalRepairCost(ctx, workspaceID, inventoryID)

	assert.NoError(t, err)
	assert.Len(t, result, 0)
	mockRepo.AssertExpectations(t)
}

func TestGetTotalRepairCost_NilCurrencyCode(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	// Some repairs might have nil currency code
	summaries := []RepairCostSummary{
		{CurrencyCode: nil, TotalCostCents: 5000, RepairCount: 2},
	}

	mockRepo.On("GetTotalRepairCost", ctx, workspaceID, inventoryID).Return(summaries, nil)

	result, err := svc.GetTotalRepairCost(ctx, workspaceID, inventoryID)

	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Nil(t, result[0].CurrencyCode)
	assert.Equal(t, 5000, result[0].TotalCostCents)
	mockRepo.AssertExpectations(t)
}

func TestGetTotalRepairCost_RepoError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repoErr := errors.New("database: query failed")

	mockRepo.On("GetTotalRepairCost", ctx, workspaceID, inventoryID).Return([]RepairCostSummary{}, repoErr)

	result, err := svc.GetTotalRepairCost(ctx, workspaceID, inventoryID)

	assert.Error(t, err)
	assert.Empty(t, result)
	assert.Equal(t, repoErr, err)
	mockRepo.AssertExpectations(t)
}

// ============ Additional Error Path Tests ============

func TestCreate_InvalidDescription(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	inv := newTestInventory(workspaceID, itemID, locationID)
	mockInvRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)

	input := CreateInput{
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
		Description: "   ", // whitespace only
	}

	repairLog, err := svc.Create(ctx, input)

	assert.Error(t, err)
	assert.Nil(t, repairLog)
	assert.Equal(t, ErrInvalidDescription, err)
	mockInvRepo.AssertExpectations(t)
}

func TestCreate_SaveError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	inv := newTestInventory(workspaceID, itemID, locationID)
	saveErr := errors.New("database: save failed")

	mockInvRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
	mockRepo.On("Save", ctx, mock.AnythingOfType("*repairlog.RepairLog")).Return(saveErr)

	input := CreateInput{
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
		Description: "Test repair",
	}

	repairLog, err := svc.Create(ctx, input)

	assert.Error(t, err)
	assert.Nil(t, repairLog)
	assert.Equal(t, saveErr, err)
	mockInvRepo.AssertExpectations(t)
	mockRepo.AssertExpectations(t)
}

func TestGetByID_NotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	repairID := uuid.New()

	mockRepo.On("FindByID", ctx, repairID, workspaceID).Return(nil, ErrRepairLogNotFound)

	result, err := svc.GetByID(ctx, repairID, workspaceID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairLogNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestUpdate_NotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	repairID := uuid.New()

	mockRepo.On("FindByID", ctx, repairID, workspaceID).Return(nil, ErrRepairLogNotFound)

	newDesc := "Updated"
	result, err := svc.Update(ctx, repairID, workspaceID, UpdateInput{Description: &newDesc})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairLogNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestUpdate_SaveError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)
	saveErr := errors.New("database: save failed")

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("Save", ctx, repair).Return(saveErr)

	newDesc := "Updated"
	result, err := svc.Update(ctx, repair.ID(), workspaceID, UpdateInput{Description: &newDesc})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, saveErr, err)
	mockRepo.AssertExpectations(t)
}

func TestUpdate_InvalidDescription(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)

	emptyDesc := "   "
	result, err := svc.Update(ctx, repair.ID(), workspaceID, UpdateInput{Description: &emptyDesc})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrInvalidDescription, err)
	mockRepo.AssertExpectations(t)
}

func TestStartRepair_NotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	repairID := uuid.New()

	mockRepo.On("FindByID", ctx, repairID, workspaceID).Return(nil, ErrRepairLogNotFound)

	result, err := svc.StartRepair(ctx, repairID, workspaceID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairLogNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestStartRepair_SaveError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)
	saveErr := errors.New("database: save failed")

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("Save", ctx, repair).Return(saveErr)

	result, err := svc.StartRepair(ctx, repair.ID(), workspaceID)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, saveErr, err)
	mockRepo.AssertExpectations(t)
}

func TestComplete_NotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	repairID := uuid.New()

	mockRepo.On("FindByID", ctx, repairID, workspaceID).Return(nil, ErrRepairLogNotFound)

	result, err := svc.Complete(ctx, repairID, workspaceID, nil)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, ErrRepairLogNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestComplete_SaveError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newInProgressRepairLog(workspaceID, inventoryID)
	saveErr := errors.New("database: save failed")

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("Save", ctx, repair).Return(saveErr)

	result, err := svc.Complete(ctx, repair.ID(), workspaceID, nil)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, saveErr, err)
	mockRepo.AssertExpectations(t)
}

func TestComplete_InventoryNotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := Reconstruct(
		uuid.New(), workspaceID, inventoryID, StatusInProgress,
		"Test", nil, nil, nil, nil, nil, nil, nil,
		false, nil, false, time.Now(), time.Now(),
	)

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockInvRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(nil, shared.ErrNotFound)

	newCondition := "EXCELLENT"
	result, err := svc.Complete(ctx, repair.ID(), workspaceID, &newCondition)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, shared.ErrNotFound, err)
	mockRepo.AssertExpectations(t)
	mockInvRepo.AssertExpectations(t)
}

func TestComplete_InventorySaveError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	repair := Reconstruct(
		uuid.New(), workspaceID, inventoryID, StatusInProgress,
		"Test", nil, nil, nil, nil, nil, nil, nil,
		false, nil, false, time.Now(), time.Now(),
	)
	inv := inventory.Reconstruct(
		inventoryID, workspaceID, itemID, locationID, nil,
		1, inventory.ConditionDamaged, inventory.StatusAvailable,
		nil, nil, nil, nil, nil, nil, false, time.Now(), time.Now(),
	)
	saveErr := errors.New("database: inventory save failed")

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockInvRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
	mockInvRepo.On("Save", ctx, inv).Return(saveErr)

	newCondition := "EXCELLENT"
	result, err := svc.Complete(ctx, repair.ID(), workspaceID, &newCondition)

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, saveErr, err)
	mockRepo.AssertExpectations(t)
	mockInvRepo.AssertExpectations(t)
}

func TestDelete_NotFound(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	repairID := uuid.New()

	mockRepo.On("FindByID", ctx, repairID, workspaceID).Return(nil, ErrRepairLogNotFound)

	err := svc.Delete(ctx, repairID, workspaceID)

	assert.Error(t, err)
	assert.Equal(t, ErrRepairLogNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestDelete_DeleteError(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repair := newPendingRepairLog(workspaceID, inventoryID)
	deleteErr := errors.New("database: delete failed")

	mockRepo.On("FindByID", ctx, repair.ID(), workspaceID).Return(repair, nil)
	mockRepo.On("Delete", ctx, repair.ID()).Return(deleteErr)

	err := svc.Delete(ctx, repair.ID(), workspaceID)

	assert.Error(t, err)
	assert.Equal(t, deleteErr, err)
	mockRepo.AssertExpectations(t)
}

func TestListByInventory_Error(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	repoErr := errors.New("database: query failed")

	mockRepo.On("FindByInventory", ctx, workspaceID, inventoryID).Return([]*RepairLog{}, repoErr)

	result, err := svc.ListByInventory(ctx, workspaceID, inventoryID)

	assert.Error(t, err)
	assert.Empty(t, result)
	assert.Equal(t, repoErr, err)
	mockRepo.AssertExpectations(t)
}

func TestListByWorkspace_Error(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	pagination := shared.Pagination{Page: 1, PageSize: 10}
	repoErr := errors.New("database: query failed")

	mockRepo.On("FindByWorkspace", ctx, workspaceID, pagination).Return([]*RepairLog{}, 0, repoErr)

	result, total, err := svc.ListByWorkspace(ctx, workspaceID, pagination)

	assert.Error(t, err)
	assert.Empty(t, result)
	assert.Equal(t, 0, total)
	assert.Equal(t, repoErr, err)
	mockRepo.AssertExpectations(t)
}

func TestListByStatus_Error(t *testing.T) {
	mockRepo := new(MockRepository)
	mockInvRepo := new(MockInventoryRepository)
	svc := NewService(mockRepo, mockInvRepo)

	ctx := context.Background()
	workspaceID := uuid.New()
	pagination := shared.Pagination{Page: 1, PageSize: 10}
	repoErr := errors.New("database: query failed")

	mockRepo.On("FindByStatus", ctx, workspaceID, StatusPending, pagination).Return([]*RepairLog{}, repoErr)

	result, err := svc.ListByStatus(ctx, workspaceID, StatusPending, pagination)

	assert.Error(t, err)
	assert.Empty(t, result)
	assert.Equal(t, repoErr, err)
	mockRepo.AssertExpectations(t)
}
