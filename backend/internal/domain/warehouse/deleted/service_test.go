package deleted

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
)

// MockRepository implements Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, record *DeletedRecord) error {
	args := m.Called(ctx, record)
	return args.Error(0)
}

func (m *MockRepository) FindSince(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*DeletedRecord, error) {
	args := m.Called(ctx, workspaceID, since)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*DeletedRecord), args.Error(1)
}

func (m *MockRepository) CleanupOld(ctx context.Context, before time.Time) error {
	args := m.Called(ctx, before)
	return args.Error(0)
}

// ============================================================================
// Entity Tests
// ============================================================================

func TestNewDeletedRecord(t *testing.T) {
	workspaceID := uuid.New()
	entityID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		entityType  activity.EntityType
		entityID    uuid.UUID
		deletedBy   *uuid.UUID
		wantErr     bool
		errContains string
	}{
		{
			testName:    "valid deleted record with user",
			workspaceID: workspaceID,
			entityType:  activity.EntityItem,
			entityID:    entityID,
			deletedBy:   &userID,
			wantErr:     false,
		},
		{
			testName:    "valid deleted record without user",
			workspaceID: workspaceID,
			entityType:  activity.EntityInventory,
			entityID:    entityID,
			deletedBy:   nil,
			wantErr:     false,
		},
		{
			testName:    "valid deleted record - location type",
			workspaceID: workspaceID,
			entityType:  activity.EntityLocation,
			entityID:    entityID,
			deletedBy:   &userID,
			wantErr:     false,
		},
		{
			testName:    "valid deleted record - container type",
			workspaceID: workspaceID,
			entityType:  activity.EntityContainer,
			entityID:    entityID,
			deletedBy:   &userID,
			wantErr:     false,
		},
		{
			testName:    "valid deleted record - category type",
			workspaceID: workspaceID,
			entityType:  activity.EntityCategory,
			entityID:    entityID,
			deletedBy:   nil,
			wantErr:     false,
		},
		{
			testName:    "valid deleted record - label type",
			workspaceID: workspaceID,
			entityType:  activity.EntityLabel,
			entityID:    entityID,
			deletedBy:   nil,
			wantErr:     false,
		},
		{
			testName:    "valid deleted record - loan type",
			workspaceID: workspaceID,
			entityType:  activity.EntityLoan,
			entityID:    entityID,
			deletedBy:   &userID,
			wantErr:     false,
		},
		{
			testName:    "valid deleted record - borrower type",
			workspaceID: workspaceID,
			entityType:  activity.EntityBorrower,
			entityID:    entityID,
			deletedBy:   &userID,
			wantErr:     false,
		},
		{
			testName:    "valid deleted record - company type",
			workspaceID: workspaceID,
			entityType:  activity.EntityCompany,
			entityID:    entityID,
			deletedBy:   nil,
			wantErr:     false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			entityType:  activity.EntityItem,
			entityID:    entityID,
			deletedBy:   &userID,
			wantErr:     true,
			errContains: "workspace_id",
		},
		{
			testName:    "invalid entity type",
			workspaceID: workspaceID,
			entityType:  activity.EntityType("INVALID"),
			entityID:    entityID,
			deletedBy:   &userID,
			wantErr:     true,
			errContains: "entity_type",
		},
		{
			testName:    "empty entity type",
			workspaceID: workspaceID,
			entityType:  activity.EntityType(""),
			entityID:    entityID,
			deletedBy:   &userID,
			wantErr:     true,
			errContains: "entity_type",
		},
		{
			testName:    "invalid entity ID",
			workspaceID: workspaceID,
			entityType:  activity.EntityItem,
			entityID:    uuid.Nil,
			deletedBy:   &userID,
			wantErr:     true,
			errContains: "entity_id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			record, err := NewDeletedRecord(tt.workspaceID, tt.entityType, tt.entityID, tt.deletedBy)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
				assert.Nil(t, record)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, record)
				assert.NotEqual(t, uuid.Nil, record.ID())
				assert.Equal(t, tt.workspaceID, record.WorkspaceID())
				assert.Equal(t, tt.entityType, record.EntityType())
				assert.Equal(t, tt.entityID, record.EntityID())
				assert.Equal(t, tt.deletedBy, record.DeletedBy())
				assert.False(t, record.DeletedAt().IsZero())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	entityID := uuid.New()
	userID := uuid.New()
	deletedAt := time.Now()

	record := Reconstruct(id, workspaceID, activity.EntityItem, entityID, deletedAt, &userID)

	assert.NotNil(t, record)
	assert.Equal(t, id, record.ID())
	assert.Equal(t, workspaceID, record.WorkspaceID())
	assert.Equal(t, activity.EntityItem, record.EntityType())
	assert.Equal(t, entityID, record.EntityID())
	assert.Equal(t, deletedAt, record.DeletedAt())
	assert.Equal(t, &userID, record.DeletedBy())
}

func TestReconstruct_WithoutUser(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	entityID := uuid.New()
	deletedAt := time.Now()

	record := Reconstruct(id, workspaceID, activity.EntityInventory, entityID, deletedAt, nil)

	assert.NotNil(t, record)
	assert.Equal(t, id, record.ID())
	assert.Equal(t, workspaceID, record.WorkspaceID())
	assert.Equal(t, activity.EntityInventory, record.EntityType())
	assert.Equal(t, entityID, record.EntityID())
	assert.Equal(t, deletedAt, record.DeletedAt())
	assert.Nil(t, record.DeletedBy())
}

// ============================================================================
// Service Tests
// ============================================================================

func TestNewService(t *testing.T) {
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)

	assert.NotNil(t, service)
}

func TestService_RecordDeletion(t *testing.T) {
	workspaceID := uuid.New()
	entityID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		entityType  activity.EntityType
		entityID    uuid.UUID
		deletedBy   *uuid.UUID
		mockSetup   func(*MockRepository)
		wantErr     bool
		errContains string
	}{
		{
			testName:    "successful record deletion",
			workspaceID: workspaceID,
			entityType:  activity.EntityItem,
			entityID:    entityID,
			deletedBy:   &userID,
			mockSetup: func(m *MockRepository) {
				m.On("Save", mock.Anything, mock.AnythingOfType("*deleted.DeletedRecord")).Return(nil)
			},
			wantErr: false,
		},
		{
			testName:    "successful record deletion without user",
			workspaceID: workspaceID,
			entityType:  activity.EntityInventory,
			entityID:    entityID,
			deletedBy:   nil,
			mockSetup: func(m *MockRepository) {
				m.On("Save", mock.Anything, mock.AnythingOfType("*deleted.DeletedRecord")).Return(nil)
			},
			wantErr: false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			entityType:  activity.EntityItem,
			entityID:    entityID,
			deletedBy:   &userID,
			mockSetup:   func(m *MockRepository) {},
			wantErr:     true,
			errContains: "workspace_id",
		},
		{
			testName:    "invalid entity type",
			workspaceID: workspaceID,
			entityType:  activity.EntityType("INVALID"),
			entityID:    entityID,
			deletedBy:   &userID,
			mockSetup:   func(m *MockRepository) {},
			wantErr:     true,
			errContains: "entity_type",
		},
		{
			testName:    "invalid entity ID",
			workspaceID: workspaceID,
			entityType:  activity.EntityItem,
			entityID:    uuid.Nil,
			deletedBy:   &userID,
			mockSetup:   func(m *MockRepository) {},
			wantErr:     true,
			errContains: "entity_id",
		},
		{
			testName:    "save returns error",
			workspaceID: workspaceID,
			entityType:  activity.EntityItem,
			entityID:    entityID,
			deletedBy:   &userID,
			mockSetup: func(m *MockRepository) {
				m.On("Save", mock.Anything, mock.AnythingOfType("*deleted.DeletedRecord")).Return(errors.New("database error"))
			},
			wantErr:     true,
			errContains: "database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			err := service.RecordDeletion(context.Background(), tt.workspaceID, tt.entityType, tt.entityID, tt.deletedBy)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetDeletedSince(t *testing.T) {
	workspaceID := uuid.New()
	since := time.Now().Add(-24 * time.Hour)

	record1 := Reconstruct(uuid.New(), workspaceID, activity.EntityItem, uuid.New(), time.Now().Add(-12*time.Hour), nil)
	record2 := Reconstruct(uuid.New(), workspaceID, activity.EntityInventory, uuid.New(), time.Now().Add(-6*time.Hour), nil)

	tests := []struct {
		testName  string
		mockSetup func(*MockRepository)
		wantErr   bool
		wantCount int
	}{
		{
			testName: "get deleted records with results",
			mockSetup: func(m *MockRepository) {
				m.On("FindSince", mock.Anything, workspaceID, since).Return([]*DeletedRecord{record1, record2}, nil)
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			testName: "empty results",
			mockSetup: func(m *MockRepository) {
				m.On("FindSince", mock.Anything, workspaceID, since).Return([]*DeletedRecord{}, nil)
			},
			wantErr:   false,
			wantCount: 0,
		},
		{
			testName: "repository returns error",
			mockSetup: func(m *MockRepository) {
				m.On("FindSince", mock.Anything, workspaceID, since).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			records, err := service.GetDeletedSince(context.Background(), workspaceID, since)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, records)
			} else {
				assert.NoError(t, err)
				assert.Len(t, records, tt.wantCount)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_CleanupOld(t *testing.T) {
	before := time.Now().Add(-30 * 24 * time.Hour)

	tests := []struct {
		testName    string
		mockSetup   func(*MockRepository)
		wantErr     bool
		errContains string
	}{
		{
			testName: "successful cleanup",
			mockSetup: func(m *MockRepository) {
				m.On("CleanupOld", mock.Anything, before).Return(nil)
			},
			wantErr: false,
		},
		{
			testName: "repository returns error",
			mockSetup: func(m *MockRepository) {
				m.On("CleanupOld", mock.Anything, before).Return(errors.New("database error"))
			},
			wantErr:     true,
			errContains: "database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			tt.mockSetup(mockRepo)
			service := NewService(mockRepo)

			err := service.CleanupOld(context.Background(), before)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// ============================================================================
// Getter Tests
// ============================================================================

func TestDeletedRecord_Getters(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	entityID := uuid.New()
	userID := uuid.New()
	deletedAt := time.Now()

	record := Reconstruct(id, workspaceID, activity.EntityItem, entityID, deletedAt, &userID)

	t.Run("ID", func(t *testing.T) {
		assert.Equal(t, id, record.ID())
	})

	t.Run("WorkspaceID", func(t *testing.T) {
		assert.Equal(t, workspaceID, record.WorkspaceID())
	})

	t.Run("EntityType", func(t *testing.T) {
		assert.Equal(t, activity.EntityItem, record.EntityType())
	})

	t.Run("EntityID", func(t *testing.T) {
		assert.Equal(t, entityID, record.EntityID())
	})

	t.Run("DeletedAt", func(t *testing.T) {
		assert.Equal(t, deletedAt, record.DeletedAt())
	})

	t.Run("DeletedBy", func(t *testing.T) {
		assert.Equal(t, &userID, record.DeletedBy())
	})
}
