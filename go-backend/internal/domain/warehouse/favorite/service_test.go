package favorite

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, favorite *Favorite) error {
	args := m.Called(ctx, favorite)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id uuid.UUID) (*Favorite, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Favorite), args.Error(1)
}

func (m *MockRepository) FindByUser(ctx context.Context, userID, workspaceID uuid.UUID) ([]*Favorite, error) {
	args := m.Called(ctx, userID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Favorite), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func (m *MockRepository) DeleteByTarget(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType FavoriteType, targetID uuid.UUID) error {
	args := m.Called(ctx, userID, workspaceID, favoriteType, targetID)
	return args.Error(0)
}

func (m *MockRepository) IsFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType FavoriteType, targetID uuid.UUID) (bool, error) {
	args := m.Called(ctx, userID, workspaceID, favoriteType, targetID)
	return args.Bool(0), args.Error(1)
}

// Helper functions
func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

// =============================================================================
// Entity Tests - FavoriteType
// =============================================================================

func TestFavoriteType_IsValid(t *testing.T) {
	tests := []struct {
		testName     string
		favoriteType FavoriteType
		expected     bool
	}{
		{"ITEM is valid", TypeItem, true},
		{"LOCATION is valid", TypeLocation, true},
		{"CONTAINER is valid", TypeContainer, true},
		{"empty string is invalid", FavoriteType(""), false},
		{"random string is invalid", FavoriteType("RANDOM"), false},
		{"lowercase is invalid", FavoriteType("item"), false},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.favoriteType.IsValid())
		})
	}
}

// =============================================================================
// Entity Tests - Favorite
// =============================================================================

func TestNewFavorite(t *testing.T) {
	userID := uuid.New()
	workspaceID := uuid.New()
	targetID := uuid.New()

	tests := []struct {
		testName     string
		userID       uuid.UUID
		workspaceID  uuid.UUID
		favoriteType FavoriteType
		targetID     uuid.UUID
		expectError  bool
		errorType    error
	}{
		{
			testName:     "valid favorite for item",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: TypeItem,
			targetID:     targetID,
			expectError:  false,
		},
		{
			testName:     "valid favorite for location",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: TypeLocation,
			targetID:     targetID,
			expectError:  false,
		},
		{
			testName:     "valid favorite for container",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: TypeContainer,
			targetID:     targetID,
			expectError:  false,
		},
		{
			testName:     "invalid user ID",
			userID:       uuid.Nil,
			workspaceID:  workspaceID,
			favoriteType: TypeItem,
			targetID:     targetID,
			expectError:  true,
		},
		{
			testName:     "invalid workspace ID",
			userID:       userID,
			workspaceID:  uuid.Nil,
			favoriteType: TypeItem,
			targetID:     targetID,
			expectError:  true,
		},
		{
			testName:     "invalid favorite type",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: FavoriteType("INVALID"),
			targetID:     targetID,
			expectError:  true,
			errorType:    ErrInvalidFavoriteType,
		},
		{
			testName:     "empty favorite type",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: FavoriteType(""),
			targetID:     targetID,
			expectError:  true,
			errorType:    ErrInvalidFavoriteType,
		},
		{
			testName:     "invalid target ID",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: TypeItem,
			targetID:     uuid.Nil,
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			favorite, err := NewFavorite(tt.userID, tt.workspaceID, tt.favoriteType, tt.targetID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, favorite)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, favorite)
				assert.NotEqual(t, uuid.Nil, favorite.ID())
				assert.Equal(t, tt.userID, favorite.UserID())
				assert.Equal(t, tt.workspaceID, favorite.WorkspaceID())
				assert.Equal(t, tt.favoriteType, favorite.FavoriteType())
				assert.Equal(t, tt.targetID, favorite.TargetID())
				assert.False(t, favorite.CreatedAt().IsZero())

				// Verify correct ID field is set
				switch tt.favoriteType {
				case TypeItem:
					assert.NotNil(t, favorite.ItemID())
					assert.Equal(t, tt.targetID, *favorite.ItemID())
					assert.Nil(t, favorite.LocationID())
					assert.Nil(t, favorite.ContainerID())
				case TypeLocation:
					assert.Nil(t, favorite.ItemID())
					assert.NotNil(t, favorite.LocationID())
					assert.Equal(t, tt.targetID, *favorite.LocationID())
					assert.Nil(t, favorite.ContainerID())
				case TypeContainer:
					assert.Nil(t, favorite.ItemID())
					assert.Nil(t, favorite.LocationID())
					assert.NotNil(t, favorite.ContainerID())
					assert.Equal(t, tt.targetID, *favorite.ContainerID())
				}
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	userID := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now()

	favorite := Reconstruct(
		id,
		userID,
		workspaceID,
		TypeItem,
		&itemID,
		nil,
		nil,
		now,
	)

	assert.Equal(t, id, favorite.ID())
	assert.Equal(t, userID, favorite.UserID())
	assert.Equal(t, workspaceID, favorite.WorkspaceID())
	assert.Equal(t, TypeItem, favorite.FavoriteType())
	assert.Equal(t, itemID, *favorite.ItemID())
	assert.Nil(t, favorite.LocationID())
	assert.Nil(t, favorite.ContainerID())
	assert.Equal(t, now, favorite.CreatedAt())
}

func TestReconstruct_Location(t *testing.T) {
	id := uuid.New()
	userID := uuid.New()
	workspaceID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	favorite := Reconstruct(
		id,
		userID,
		workspaceID,
		TypeLocation,
		nil,
		&locationID,
		nil,
		now,
	)

	assert.Equal(t, TypeLocation, favorite.FavoriteType())
	assert.Nil(t, favorite.ItemID())
	assert.Equal(t, locationID, *favorite.LocationID())
	assert.Nil(t, favorite.ContainerID())
	assert.Equal(t, locationID, favorite.TargetID())
}

func TestReconstruct_Container(t *testing.T) {
	id := uuid.New()
	userID := uuid.New()
	workspaceID := uuid.New()
	containerID := uuid.New()
	now := time.Now()

	favorite := Reconstruct(
		id,
		userID,
		workspaceID,
		TypeContainer,
		nil,
		nil,
		&containerID,
		now,
	)

	assert.Equal(t, TypeContainer, favorite.FavoriteType())
	assert.Nil(t, favorite.ItemID())
	assert.Nil(t, favorite.LocationID())
	assert.Equal(t, containerID, *favorite.ContainerID())
	assert.Equal(t, containerID, favorite.TargetID())
}

func TestFavorite_TargetID(t *testing.T) {
	itemID := uuid.New()
	locationID := uuid.New()
	containerID := uuid.New()

	tests := []struct {
		testName     string
		favoriteType FavoriteType
		itemID       *uuid.UUID
		locationID   *uuid.UUID
		containerID  *uuid.UUID
		expectedID   uuid.UUID
	}{
		{
			testName:     "item favorite",
			favoriteType: TypeItem,
			itemID:       &itemID,
			locationID:   nil,
			containerID:  nil,
			expectedID:   itemID,
		},
		{
			testName:     "location favorite",
			favoriteType: TypeLocation,
			itemID:       nil,
			locationID:   &locationID,
			containerID:  nil,
			expectedID:   locationID,
		},
		{
			testName:     "container favorite",
			favoriteType: TypeContainer,
			itemID:       nil,
			locationID:   nil,
			containerID:  &containerID,
			expectedID:   containerID,
		},
		{
			testName:     "item favorite with nil returns nil UUID",
			favoriteType: TypeItem,
			itemID:       nil,
			locationID:   nil,
			containerID:  nil,
			expectedID:   uuid.Nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			favorite := Reconstruct(
				uuid.New(),
				uuid.New(),
				uuid.New(),
				tt.favoriteType,
				tt.itemID,
				tt.locationID,
				tt.containerID,
				time.Now(),
			)
			assert.Equal(t, tt.expectedID, favorite.TargetID())
		})
	}
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_AddFavorite(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	workspaceID := uuid.New()
	targetID := uuid.New()

	tests := []struct {
		testName     string
		userID       uuid.UUID
		workspaceID  uuid.UUID
		favoriteType FavoriteType
		targetID     uuid.UUID
		setupMock    func(*MockRepository)
		expectError  bool
		expectNil    bool
	}{
		{
			testName:     "successful add",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: TypeItem,
			targetID:     targetID,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*favorite.Favorite")).Return(nil)
			},
			expectError: false,
			expectNil:   false,
		},
		{
			testName:     "already favorited - returns nil",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: TypeItem,
			targetID:     targetID,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(true, nil)
			},
			expectError: false,
			expectNil:   true,
		},
		{
			testName:     "IsFavorite returns error",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: TypeItem,
			targetID:     targetID,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(false, errors.New("database error"))
			},
			expectError: true,
		},
		{
			testName:     "invalid favorite type",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: FavoriteType("INVALID"),
			targetID:     targetID,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, FavoriteType("INVALID"), targetID).Return(false, nil)
			},
			expectError: true,
		},
		{
			testName:     "save returns error",
			userID:       userID,
			workspaceID:  workspaceID,
			favoriteType: TypeLocation,
			targetID:     targetID,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeLocation, targetID).Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*favorite.Favorite")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			favorite, err := svc.AddFavorite(ctx, tt.userID, tt.workspaceID, tt.favoriteType, tt.targetID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, favorite)
			} else if tt.expectNil {
				assert.NoError(t, err)
				assert.Nil(t, favorite)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, favorite)
				assert.Equal(t, tt.userID, favorite.UserID())
				assert.Equal(t, tt.workspaceID, favorite.WorkspaceID())
				assert.Equal(t, tt.favoriteType, favorite.FavoriteType())
				assert.Equal(t, tt.targetID, favorite.TargetID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_RemoveFavorite(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	workspaceID := uuid.New()
	targetID := uuid.New()

	tests := []struct {
		testName     string
		favoriteType FavoriteType
		setupMock    func(*MockRepository)
		expectError  bool
	}{
		{
			testName:     "successful remove",
			favoriteType: TypeItem,
			setupMock: func(m *MockRepository) {
				m.On("DeleteByTarget", ctx, userID, workspaceID, TypeItem, targetID).Return(nil)
			},
			expectError: false,
		},
		{
			testName:     "delete returns error",
			favoriteType: TypeItem,
			setupMock: func(m *MockRepository) {
				m.On("DeleteByTarget", ctx, userID, workspaceID, TypeItem, targetID).Return(errors.New("delete error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.RemoveFavorite(ctx, userID, workspaceID, tt.favoriteType, targetID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ToggleFavorite(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	workspaceID := uuid.New()
	targetID := uuid.New()

	tests := []struct {
		testName       string
		favoriteType   FavoriteType
		setupMock      func(*MockRepository)
		expectError    bool
		expectedResult bool
	}{
		{
			testName:     "toggle on - was not favorited",
			favoriteType: TypeItem,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(false, nil).Once()
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(false, nil).Once()
				m.On("Save", ctx, mock.AnythingOfType("*favorite.Favorite")).Return(nil)
			},
			expectError:    false,
			expectedResult: true,
		},
		{
			testName:     "toggle off - was favorited",
			favoriteType: TypeItem,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(true, nil)
				m.On("DeleteByTarget", ctx, userID, workspaceID, TypeItem, targetID).Return(nil)
			},
			expectError:    false,
			expectedResult: false,
		},
		{
			testName:     "IsFavorite returns error",
			favoriteType: TypeItem,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(false, errors.New("database error"))
			},
			expectError: true,
		},
		{
			testName:     "remove favorite returns error",
			favoriteType: TypeItem,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(true, nil)
				m.On("DeleteByTarget", ctx, userID, workspaceID, TypeItem, targetID).Return(errors.New("delete error"))
			},
			expectError: true,
		},
		{
			testName:     "add favorite returns error",
			favoriteType: TypeItem,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(false, nil).Once()
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(false, nil).Once()
				m.On("Save", ctx, mock.AnythingOfType("*favorite.Favorite")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			result, err := svc.ToggleFavorite(ctx, userID, workspaceID, tt.favoriteType, targetID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListFavorites(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "list with results",
			setupMock: func(m *MockRepository) {
				favorites := []*Favorite{
					{id: uuid.New(), userID: userID, workspaceID: workspaceID, favoriteType: TypeItem},
					{id: uuid.New(), userID: userID, workspaceID: workspaceID, favoriteType: TypeLocation},
					{id: uuid.New(), userID: userID, workspaceID: workspaceID, favoriteType: TypeContainer},
				}
				m.On("FindByUser", ctx, userID, workspaceID).Return(favorites, nil)
			},
			expectLen:   3,
			expectError: false,
		},
		{
			testName: "empty results",
			setupMock: func(m *MockRepository) {
				m.On("FindByUser", ctx, userID, workspaceID).Return([]*Favorite{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindByUser", ctx, userID, workspaceID).Return(nil, errors.New("database error"))
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

			favorites, err := svc.ListFavorites(ctx, userID, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, favorites)
			} else {
				assert.NoError(t, err)
				assert.Len(t, favorites, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_IsFavorite(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	workspaceID := uuid.New()
	targetID := uuid.New()

	tests := []struct {
		testName       string
		favoriteType   FavoriteType
		setupMock      func(*MockRepository)
		expectedResult bool
		expectError    bool
	}{
		{
			testName:     "is favorite - true",
			favoriteType: TypeItem,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeItem, targetID).Return(true, nil)
			},
			expectedResult: true,
			expectError:    false,
		},
		{
			testName:     "is favorite - false",
			favoriteType: TypeLocation,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeLocation, targetID).Return(false, nil)
			},
			expectedResult: false,
			expectError:    false,
		},
		{
			testName:     "repository returns error",
			favoriteType: TypeContainer,
			setupMock: func(m *MockRepository) {
				m.On("IsFavorite", ctx, userID, workspaceID, TypeContainer, targetID).Return(false, errors.New("database error"))
			},
			expectedResult: false,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			result, err := svc.IsFavorite(ctx, userID, workspaceID, tt.favoriteType, targetID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
