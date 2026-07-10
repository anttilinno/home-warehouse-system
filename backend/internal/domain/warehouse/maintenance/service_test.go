package maintenance

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

// MockRepository is a mock implementation of the Repository interface.
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, schedule *Schedule) error {
	args := m.Called(ctx, schedule)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Schedule, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Schedule), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Schedule, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*Schedule), args.Int(1), args.Error(2)
}

func (m *MockRepository) FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*Schedule, error) {
	args := m.Called(ctx, workspaceID, inventoryID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Schedule), args.Error(1)
}

func (m *MockRepository) FindDue(ctx context.Context, workspaceID uuid.UUID, dueBy time.Time) ([]DueSchedule, error) {
	args := m.Called(ctx, workspaceID, dueBy)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]DueSchedule), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockRepository) CreateCompletionRepairLog(ctx context.Context, workspaceID, inventoryID uuid.UUID, description string, notes *string) error {
	args := m.Called(ctx, workspaceID, inventoryID, description, notes)
	return args.Error(0)
}

// MockInventoryRepository is a mock implementation of the inventory.Repository interface.
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

func (m *MockInventoryRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockInventoryRepository) FindExpiring(ctx context.Context, workspaceID uuid.UUID, withinDays int) ([]inventory.ExpiringInventory, error) {
	args := m.Called(ctx, workspaceID, withinDays)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]inventory.ExpiringInventory), args.Error(1)
}

func newTestService(repo *MockRepository, invRepo *MockInventoryRepository) *Service {
	return NewService(repo, invRepo, nil)
}

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	nextDue := time.Now().AddDate(0, 0, 30)

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		input := CreateInput{
			WorkspaceID:  workspaceID,
			InventoryID:  inventoryID,
			Title:        "Replace HVAC filter",
			IntervalDays: 90,
			NextDue:      nextDue,
		}

		invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(&inventory.Inventory{}, nil)
		repo.On("Save", ctx, mock.AnythingOfType("*maintenance.Schedule")).Return(nil)

		schedule, err := svc.Create(ctx, input)

		assert.NoError(t, err)
		assert.NotNil(t, schedule)
		assert.Equal(t, "Replace HVAC filter", schedule.Title())
		assert.True(t, schedule.IsActive())
		repo.AssertExpectations(t)
	})

	t.Run("validates inventory exists in workspace", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		input := CreateInput{
			WorkspaceID:  workspaceID,
			InventoryID:  inventoryID,
			Title:        "Replace HVAC filter",
			IntervalDays: 90,
			NextDue:      nextDue,
		}

		invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(nil, inventory.ErrInventoryNotFound)

		schedule, err := svc.Create(ctx, input)

		assert.ErrorIs(t, err, inventory.ErrInventoryNotFound)
		assert.Nil(t, schedule)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("error on invalid title", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		input := CreateInput{
			WorkspaceID:  workspaceID,
			InventoryID:  inventoryID,
			Title:        "   ",
			IntervalDays: 90,
			NextDue:      nextDue,
		}

		invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(&inventory.Inventory{}, nil)

		schedule, err := svc.Create(ctx, input)

		assert.ErrorIs(t, err, ErrInvalidTitle)
		assert.Nil(t, schedule)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("error on save", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		input := CreateInput{
			WorkspaceID:  workspaceID,
			InventoryID:  inventoryID,
			Title:        "Replace HVAC filter",
			IntervalDays: 90,
			NextDue:      nextDue,
		}

		invRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(&inventory.Inventory{}, nil)
		repo.On("Save", ctx, mock.AnythingOfType("*maintenance.Schedule")).Return(assert.AnError)

		schedule, err := svc.Create(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, schedule)
	})
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	id := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule, _ := NewSchedule(workspaceID, uuid.New(), "Filter", nil, 30, time.Now().AddDate(0, 0, 30))
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)

		result, err := svc.GetByID(ctx, id, workspaceID)

		assert.NoError(t, err)
		assert.Equal(t, schedule, result)
	})

	t.Run("not found", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		repo.On("FindByID", ctx, id, workspaceID).Return(nil, ErrScheduleNotFound)

		result, err := svc.GetByID(ctx, id, workspaceID)

		assert.ErrorIs(t, err, ErrScheduleNotFound)
		assert.Nil(t, result)
	})
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	id := uuid.New()

	newSchedule := func() *Schedule {
		s, _ := NewSchedule(workspaceID, uuid.New(), "Filter", nil, 30, time.Now().AddDate(0, 0, 30))
		return s
	}

	t.Run("updates details", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule := newSchedule()
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)
		repo.On("Save", ctx, schedule).Return(nil)

		newTitle := "Replace filter and check belts"
		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{Title: &newTitle})

		assert.NoError(t, err)
		assert.Equal(t, newTitle, result.Title())
	})

	t.Run("not found", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		repo.On("FindByID", ctx, id, workspaceID).Return(nil, ErrScheduleNotFound)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{})

		assert.ErrorIs(t, err, ErrScheduleNotFound)
		assert.Nil(t, result)
	})

	t.Run("can deactivate", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule := newSchedule()
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)
		repo.On("Save", ctx, schedule).Return(nil)

		isActive := false
		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{IsActive: &isActive})

		assert.NoError(t, err)
		assert.False(t, result.IsActive())
	})

	t.Run("error on invalid interval rejected before save", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule := newSchedule()
		badInterval := 0
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{IntervalDays: &badInterval})

		assert.ErrorIs(t, err, ErrInvalidInterval)
		assert.Nil(t, result)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("error on save", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule := newSchedule()
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)
		repo.On("Save", ctx, schedule).Return(assert.AnError)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{})

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	id := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule, _ := NewSchedule(workspaceID, uuid.New(), "Filter", nil, 30, time.Now().AddDate(0, 0, 30))
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)
		repo.On("Delete", ctx, id, workspaceID).Return(nil)

		err := svc.Delete(ctx, id, workspaceID)

		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("not found", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		repo.On("FindByID", ctx, id, workspaceID).Return(nil, ErrScheduleNotFound)

		err := svc.Delete(ctx, id, workspaceID)

		assert.ErrorIs(t, err, ErrScheduleNotFound)
		repo.AssertNotCalled(t, "Delete")
	})
}

func TestService_List(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule, _ := NewSchedule(workspaceID, uuid.New(), "Filter", nil, 30, time.Now().AddDate(0, 0, 30))
		pagination := shared.DefaultPagination()
		repo.On("FindByWorkspace", ctx, workspaceID, pagination).Return([]*Schedule{schedule}, 1, nil)

		result, total, err := svc.List(ctx, workspaceID, pagination)

		assert.NoError(t, err)
		assert.Equal(t, 1, total)
		assert.Len(t, result, 1)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		pagination := shared.DefaultPagination()
		repo.On("FindByWorkspace", ctx, workspaceID, pagination).Return(nil, 0, assert.AnError)

		result, total, err := svc.List(ctx, workspaceID, pagination)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, 0, total)
	})
}

func TestService_ListByInventory(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule, _ := NewSchedule(workspaceID, inventoryID, "Filter", nil, 30, time.Now().AddDate(0, 0, 30))
		repo.On("FindByInventory", ctx, workspaceID, inventoryID).Return([]*Schedule{schedule}, nil)

		result, err := svc.ListByInventory(ctx, workspaceID, inventoryID)

		assert.NoError(t, err)
		assert.Len(t, result, 1)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		repo.On("FindByInventory", ctx, workspaceID, inventoryID).Return(nil, assert.AnError)

		result, err := svc.ListByInventory(ctx, workspaceID, inventoryID)

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestService_ListDue(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		due := []DueSchedule{{ItemID: uuid.New(), ItemName: "Drill"}}
		repo.On("FindDue", ctx, workspaceID, mock.AnythingOfType("time.Time")).Return(due, nil)

		result, err := svc.ListDue(ctx, workspaceID, 7)

		assert.NoError(t, err)
		assert.Len(t, result, 1)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		repo.On("FindDue", ctx, workspaceID, mock.AnythingOfType("time.Time")).Return(nil, assert.AnError)

		result, err := svc.ListDue(ctx, workspaceID, 7)

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestService_Complete(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	id := uuid.New()

	t.Run("success creates completion log and advances next_due", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule, _ := NewSchedule(workspaceID, inventoryID, "Replace filter", nil, 30, time.Now().AddDate(0, 0, 30))
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)
		repo.On("CreateCompletionRepairLog", ctx, workspaceID, inventoryID, "Maintenance: Replace filter", (*string)(nil)).Return(nil)
		repo.On("Save", ctx, schedule).Return(nil)

		result, err := svc.Complete(ctx, id, workspaceID, nil)

		assert.NoError(t, err)
		assert.NotNil(t, result.LastCompletedAt())
		repo.AssertExpectations(t)
	})

	t.Run("not found", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		repo.On("FindByID", ctx, id, workspaceID).Return(nil, ErrScheduleNotFound)

		result, err := svc.Complete(ctx, id, workspaceID, nil)

		assert.ErrorIs(t, err, ErrScheduleNotFound)
		assert.Nil(t, result)
	})

	t.Run("rejects completing an inactive schedule", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule, _ := NewSchedule(workspaceID, inventoryID, "Replace filter", nil, 30, time.Now().AddDate(0, 0, 30))
		isActive := false
		_ = schedule.UpdateDetails(schedule.Title(), schedule.Notes(), schedule.IntervalDays(), schedule.NextDue(), isActive)
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)

		result, err := svc.Complete(ctx, id, workspaceID, nil)

		assert.ErrorIs(t, err, ErrScheduleInactive)
		assert.Nil(t, result)
		repo.AssertNotCalled(t, "CreateCompletionRepairLog")
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("rolls back schedule when repair log write fails", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule, _ := NewSchedule(workspaceID, inventoryID, "Replace filter", nil, 30, time.Now().AddDate(0, 0, 30))
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)
		repo.On("CreateCompletionRepairLog", ctx, workspaceID, inventoryID, "Maintenance: Replace filter", (*string)(nil)).Return(assert.AnError)

		result, err := svc.Complete(ctx, id, workspaceID, nil)

		assert.Error(t, err)
		assert.Nil(t, result)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("error on save", func(t *testing.T) {
		repo := new(MockRepository)
		invRepo := new(MockInventoryRepository)
		svc := newTestService(repo, invRepo)

		schedule, _ := NewSchedule(workspaceID, inventoryID, "Replace filter", nil, 30, time.Now().AddDate(0, 0, 30))
		repo.On("FindByID", ctx, id, workspaceID).Return(schedule, nil)
		repo.On("CreateCompletionRepairLog", ctx, workspaceID, inventoryID, "Maintenance: Replace filter", (*string)(nil)).Return(nil)
		repo.On("Save", ctx, schedule).Return(assert.AnError)

		result, err := svc.Complete(ctx, id, workspaceID, nil)

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}
