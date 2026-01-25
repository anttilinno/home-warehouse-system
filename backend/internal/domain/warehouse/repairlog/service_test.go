package repairlog

import (
	"context"
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
