package activity

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, log *ActivityLog) error {
	args := m.Called(ctx, log)
	return args.Error(0)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*ActivityLog), args.Error(1)
}

func (m *MockRepository) FindByEntity(ctx context.Context, workspaceID uuid.UUID, entityType EntityType, entityID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error) {
	args := m.Called(ctx, workspaceID, entityType, entityID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*ActivityLog), args.Error(1)
}

func (m *MockRepository) FindByUser(ctx context.Context, workspaceID, userID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error) {
	args := m.Called(ctx, workspaceID, userID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*ActivityLog), args.Error(1)
}

func (m *MockRepository) FindRecentActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*ActivityLog, error) {
	args := m.Called(ctx, workspaceID, since)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*ActivityLog), args.Error(1)
}

// Helper functions
func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

// =============================================================================
// Entity Tests - Action
// =============================================================================

func TestAction_IsValid(t *testing.T) {
	tests := []struct {
		testName string
		action   Action
		expected bool
	}{
		{"CREATE is valid", ActionCreate, true},
		{"UPDATE is valid", ActionUpdate, true},
		{"DELETE is valid", ActionDelete, true},
		{"MOVE is valid", ActionMove, true},
		{"LOAN is valid", ActionLoan, true},
		{"RETURN is valid", ActionReturn, true},
		{"empty string is invalid", Action(""), false},
		{"random string is invalid", Action("RANDOM"), false},
		{"lowercase is invalid", Action("create"), false},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.action.IsValid())
		})
	}
}

// =============================================================================
// Entity Tests - EntityType
// =============================================================================

func TestEntityType_IsValid(t *testing.T) {
	tests := []struct {
		testName   string
		entityType EntityType
		expected   bool
	}{
		{"ITEM is valid", EntityItem, true},
		{"INVENTORY is valid", EntityInventory, true},
		{"LOCATION is valid", EntityLocation, true},
		{"CONTAINER is valid", EntityContainer, true},
		{"CATEGORY is valid", EntityCategory, true},
		{"LABEL is valid", EntityLabel, true},
		{"LOAN is valid", EntityLoan, true},
		{"BORROWER is valid", EntityBorrower, true},
		{"COMPANY is valid", EntityCompany, true},
		{"empty string is invalid", EntityType(""), false},
		{"random string is invalid", EntityType("RANDOM"), false},
		{"lowercase is invalid", EntityType("item"), false},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.entityType.IsValid())
		})
	}
}

// =============================================================================
// Entity Tests - ActivityLog
// =============================================================================

func TestNewActivityLog(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		userID      *uuid.UUID
		action      Action
		entityType  EntityType
		entityID    uuid.UUID
		entityName  string
		changes     map[string]interface{}
		metadata    map[string]interface{}
		expectError bool
		errorType   error
	}{
		{
			testName:    "valid activity log with all fields",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      ActionCreate,
			entityType:  EntityItem,
			entityID:    entityID,
			entityName:  "Test Item",
			changes:     map[string]interface{}{"name": "Test Item", "sku": "SKU-001"},
			metadata:    map[string]interface{}{"ip": "192.168.1.1"},
			expectError: false,
		},
		{
			testName:    "valid activity log without user",
			workspaceID: workspaceID,
			userID:      nil,
			action:      ActionUpdate,
			entityType:  EntityInventory,
			entityID:    entityID,
			entityName:  "Inventory #1",
			changes:     map[string]interface{}{"quantity": 10},
			metadata:    nil,
			expectError: false,
		},
		{
			testName:    "valid activity log - delete action",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      ActionDelete,
			entityType:  EntityLocation,
			entityID:    entityID,
			entityName:  "Warehouse A",
			changes:     nil,
			metadata:    nil,
			expectError: false,
		},
		{
			testName:    "valid activity log - move action",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      ActionMove,
			entityType:  EntityInventory,
			entityID:    entityID,
			entityName:  "Item moved",
			changes:     map[string]interface{}{"from": "Location A", "to": "Location B"},
			metadata:    nil,
			expectError: false,
		},
		{
			testName:    "valid activity log - loan action",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      ActionLoan,
			entityType:  EntityLoan,
			entityID:    entityID,
			entityName:  "Loan to John",
			changes:     map[string]interface{}{"borrower": "John Doe", "quantity": 1},
			metadata:    nil,
			expectError: false,
		},
		{
			testName:    "valid activity log - return action",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      ActionReturn,
			entityType:  EntityLoan,
			entityID:    entityID,
			entityName:  "Returned item",
			changes:     nil,
			metadata:    nil,
			expectError: false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			userID:      &userID,
			action:      ActionCreate,
			entityType:  EntityItem,
			entityID:    entityID,
			entityName:  "Test",
			changes:     nil,
			metadata:    nil,
			expectError: true,
		},
		{
			testName:    "invalid action",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      Action("INVALID"),
			entityType:  EntityItem,
			entityID:    entityID,
			entityName:  "Test",
			changes:     nil,
			metadata:    nil,
			expectError: true,
			errorType:   ErrInvalidAction,
		},
		{
			testName:    "empty action",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      Action(""),
			entityType:  EntityItem,
			entityID:    entityID,
			entityName:  "Test",
			changes:     nil,
			metadata:    nil,
			expectError: true,
			errorType:   ErrInvalidAction,
		},
		{
			testName:    "invalid entity type",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      ActionCreate,
			entityType:  EntityType("INVALID"),
			entityID:    entityID,
			entityName:  "Test",
			changes:     nil,
			metadata:    nil,
			expectError: true,
			errorType:   ErrInvalidEntityType,
		},
		{
			testName:    "empty entity type",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      ActionCreate,
			entityType:  EntityType(""),
			entityID:    entityID,
			entityName:  "Test",
			changes:     nil,
			metadata:    nil,
			expectError: true,
			errorType:   ErrInvalidEntityType,
		},
		{
			testName:    "invalid entity ID",
			workspaceID: workspaceID,
			userID:      &userID,
			action:      ActionCreate,
			entityType:  EntityItem,
			entityID:    uuid.Nil,
			entityName:  "Test",
			changes:     nil,
			metadata:    nil,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			log, err := NewActivityLog(
				tt.workspaceID,
				tt.userID,
				tt.action,
				tt.entityType,
				tt.entityID,
				tt.entityName,
				tt.changes,
				tt.metadata,
			)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, log)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, log)
				assert.NotEqual(t, uuid.Nil, log.ID())
				assert.Equal(t, tt.workspaceID, log.WorkspaceID())
				assert.Equal(t, tt.userID, log.UserID())
				assert.Equal(t, tt.action, log.Action())
				assert.Equal(t, tt.entityType, log.EntityType())
				assert.Equal(t, tt.entityID, log.EntityID())
				assert.Equal(t, tt.entityName, log.EntityName())
				assert.Equal(t, tt.changes, log.Changes())
				assert.Equal(t, tt.metadata, log.Metadata())
				assert.False(t, log.CreatedAt().IsZero())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()
	now := time.Now()
	changes := map[string]interface{}{"field": "value"}
	metadata := map[string]interface{}{"key": "meta"}

	log := Reconstruct(
		id,
		workspaceID,
		&userID,
		ActionUpdate,
		EntityItem,
		entityID,
		"Test Item",
		changes,
		metadata,
		now,
	)

	assert.Equal(t, id, log.ID())
	assert.Equal(t, workspaceID, log.WorkspaceID())
	assert.Equal(t, userID, *log.UserID())
	assert.Equal(t, ActionUpdate, log.Action())
	assert.Equal(t, EntityItem, log.EntityType())
	assert.Equal(t, entityID, log.EntityID())
	assert.Equal(t, "Test Item", log.EntityName())
	assert.Equal(t, changes, log.Changes())
	assert.Equal(t, metadata, log.Metadata())
	assert.Equal(t, now, log.CreatedAt())
}

func TestReconstruct_MinimalFields(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	entityID := uuid.New()
	now := time.Now()

	log := Reconstruct(
		id,
		workspaceID,
		nil, // no user
		ActionCreate,
		EntityInventory,
		entityID,
		"",  // no name
		nil, // no changes
		nil, // no metadata
		now,
	)

	assert.Equal(t, id, log.ID())
	assert.Nil(t, log.UserID())
	assert.Empty(t, log.EntityName())
	assert.Nil(t, log.Changes())
	assert.Nil(t, log.Metadata())
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Log(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()

	tests := []struct {
		testName    string
		input       LogInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful log",
			input: LogInput{
				WorkspaceID: workspaceID,
				UserID:      &userID,
				Action:      ActionCreate,
				EntityType:  EntityItem,
				EntityID:    entityID,
				EntityName:  "New Item",
				Changes:     map[string]interface{}{"name": "New Item"},
				Metadata:    map[string]interface{}{"source": "web"},
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*activity.ActivityLog")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful log - minimal fields",
			input: LogInput{
				WorkspaceID: workspaceID,
				Action:      ActionDelete,
				EntityType:  EntityLocation,
				EntityID:    entityID,
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*activity.ActivityLog")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "invalid workspace ID",
			input: LogInput{
				WorkspaceID: uuid.Nil,
				Action:      ActionCreate,
				EntityType:  EntityItem,
				EntityID:    entityID,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
		},
		{
			testName: "invalid action",
			input: LogInput{
				WorkspaceID: workspaceID,
				Action:      Action("INVALID"),
				EntityType:  EntityItem,
				EntityID:    entityID,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
			errorType:   ErrInvalidAction,
		},
		{
			testName: "invalid entity type",
			input: LogInput{
				WorkspaceID: workspaceID,
				Action:      ActionCreate,
				EntityType:  EntityType("INVALID"),
				EntityID:    entityID,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
			errorType:   ErrInvalidEntityType,
		},
		{
			testName: "save returns error",
			input: LogInput{
				WorkspaceID: workspaceID,
				Action:      ActionCreate,
				EntityType:  EntityItem,
				EntityID:    entityID,
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*activity.ActivityLog")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Log(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName:   "list with results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				logs := []*ActivityLog{
					{id: uuid.New(), workspaceID: workspaceID, action: ActionCreate},
					{id: uuid.New(), workspaceID: workspaceID, action: ActionUpdate},
					{id: uuid.New(), workspaceID: workspaceID, action: ActionDelete},
				}
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(logs, nil)
			},
			expectLen:   3,
			expectError: false,
		},
		{
			testName:   "empty results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return([]*ActivityLog{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName:   "repository returns error",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			logs, err := svc.ListByWorkspace(ctx, workspaceID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, logs)
			} else {
				assert.NoError(t, err)
				assert.Len(t, logs, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByEntity(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	entityID := uuid.New()

	tests := []struct {
		testName    string
		entityType  EntityType
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName:   "list with results",
			entityType: EntityItem,
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				logs := []*ActivityLog{
					{id: uuid.New(), workspaceID: workspaceID, entityType: EntityItem, entityID: entityID},
					{id: uuid.New(), workspaceID: workspaceID, entityType: EntityItem, entityID: entityID},
				}
				m.On("FindByEntity", ctx, workspaceID, EntityItem, entityID, shared.Pagination{Page: 1, PageSize: 10}).Return(logs, nil)
			},
			expectLen:   2,
			expectError: false,
		},
		{
			testName:   "repository returns error",
			entityType: EntityInventory,
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByEntity", ctx, workspaceID, EntityInventory, entityID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			logs, err := svc.ListByEntity(ctx, workspaceID, tt.entityType, entityID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, logs)
			} else {
				assert.NoError(t, err)
				assert.Len(t, logs, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByUser(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		testName    string
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName:   "list with results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				logs := []*ActivityLog{
					{id: uuid.New(), workspaceID: workspaceID, userID: &userID, action: ActionCreate},
					{id: uuid.New(), workspaceID: workspaceID, userID: &userID, action: ActionUpdate},
				}
				m.On("FindByUser", ctx, workspaceID, userID, shared.Pagination{Page: 1, PageSize: 10}).Return(logs, nil)
			},
			expectLen:   2,
			expectError: false,
		},
		{
			testName:   "repository returns error",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByUser", ctx, workspaceID, userID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			logs, err := svc.ListByUser(ctx, workspaceID, userID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, logs)
			} else {
				assert.NoError(t, err)
				assert.Len(t, logs, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetRecentActivity(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	since := time.Now().Add(-24 * time.Hour)

	tests := []struct {
		testName    string
		since       time.Time
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "recent activity found",
			since:    since,
			setupMock: func(m *MockRepository) {
				logs := []*ActivityLog{
					{id: uuid.New(), workspaceID: workspaceID, action: ActionCreate, createdAt: time.Now()},
					{id: uuid.New(), workspaceID: workspaceID, action: ActionUpdate, createdAt: time.Now()},
					{id: uuid.New(), workspaceID: workspaceID, action: ActionMove, createdAt: time.Now()},
					{id: uuid.New(), workspaceID: workspaceID, action: ActionDelete, createdAt: time.Now()},
				}
				m.On("FindRecentActivity", ctx, workspaceID, since).Return(logs, nil)
			},
			expectLen:   4,
			expectError: false,
		},
		{
			testName: "no recent activity",
			since:    since,
			setupMock: func(m *MockRepository) {
				m.On("FindRecentActivity", ctx, workspaceID, since).Return([]*ActivityLog{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName: "repository returns error",
			since:    since,
			setupMock: func(m *MockRepository) {
				m.On("FindRecentActivity", ctx, workspaceID, since).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			logs, err := svc.GetRecentActivity(ctx, workspaceID, tt.since)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, logs)
			} else {
				assert.NoError(t, err)
				assert.Len(t, logs, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
