package container

import (
	"context"
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

func (m *MockRepository) Save(ctx context.Context, container *Container) error {
	args := m.Called(ctx, container)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Container, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Container), args.Error(1)
}

func (m *MockRepository) FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*Container, error) {
	args := m.Called(ctx, workspaceID, locationID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Container), args.Error(1)
}

func (m *MockRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*Container, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Container), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Container, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*Container), args.Int(1), args.Error(2)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	return args.Bool(0), args.Error(1)
}

func ptrString(s string) *string {
	return &s
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewContainer(t *testing.T) {
	workspaceID := uuid.New()
	locationID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		locationID  uuid.UUID
		name        string
		description *string
		capacity    *string
		shortCode   *string
		expectError bool
		errorField  string
	}{
		{
			testName:    "valid container",
			workspaceID: workspaceID,
			locationID:  locationID,
			name:        "Box A1",
			description: ptrString("Small storage box"),
			capacity:    ptrString("50 items"),
			shortCode:   ptrString("BA1"),
			expectError: false,
		},
		{
			testName:    "minimal container",
			workspaceID: workspaceID,
			locationID:  locationID,
			name:        "Simple Box",
			description: nil,
			capacity:    nil,
			shortCode:   nil,
			expectError: false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			locationID:  locationID,
			name:        "Test Container",
			description: nil,
			capacity:    nil,
			shortCode:   nil,
			expectError: true,
			errorField:  "workspace_id",
		},
		{
			testName:    "invalid location ID",
			workspaceID: workspaceID,
			locationID:  uuid.Nil,
			name:        "Test Container",
			description: nil,
			capacity:    nil,
			shortCode:   nil,
			expectError: true,
			errorField:  "location_id",
		},
		{
			testName:    "empty name",
			workspaceID: workspaceID,
			locationID:  locationID,
			name:        "",
			description: nil,
			capacity:    nil,
			shortCode:   nil,
			expectError: true,
			errorField:  "name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			container, err := NewContainer(tt.workspaceID, tt.locationID, tt.name, tt.description, tt.capacity, tt.shortCode)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, container)
				if domainErr, ok := err.(*shared.DomainError); ok && domainErr.Field != "" {
					assert.Equal(t, tt.errorField, domainErr.Field)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, container)
				assert.Equal(t, tt.workspaceID, container.WorkspaceID())
				assert.Equal(t, tt.locationID, container.LocationID())
				assert.Equal(t, tt.name, container.Name())
				assert.Equal(t, tt.description, container.Description())
				assert.Equal(t, tt.capacity, container.Capacity())
				assert.Equal(t, tt.shortCode, container.ShortCode())
				assert.False(t, container.IsArchived())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	container := Reconstruct(
		id,
		workspaceID,
		locationID,
		"Test Container",
		ptrString("Description"),
		ptrString("Capacity"),
		ptrString("CODE"),
		true,
		now,
		now,
	)

	assert.Equal(t, id, container.ID())
	assert.Equal(t, workspaceID, container.WorkspaceID())
	assert.Equal(t, locationID, container.LocationID())
	assert.Equal(t, "Test Container", container.Name())
	assert.Equal(t, "Description", *container.Description())
	assert.Equal(t, "Capacity", *container.Capacity())
	assert.Equal(t, "CODE", *container.ShortCode())
	assert.True(t, container.IsArchived())
	assert.Equal(t, now, container.CreatedAt())
	assert.Equal(t, now, container.UpdatedAt())
}

func TestContainer_Update(t *testing.T) {
	container, err := NewContainer(uuid.New(), uuid.New(), "Original Name", nil, nil, nil)
	assert.NoError(t, err)

	originalUpdatedAt := container.UpdatedAt()

	newLocationID := uuid.New()
	err = container.Update("Updated Name", newLocationID, ptrString("New Description"), ptrString("New Capacity"))
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", container.Name())
	assert.Equal(t, newLocationID, container.LocationID())
	assert.Equal(t, "New Description", *container.Description())
	assert.Equal(t, "New Capacity", *container.Capacity())
	assert.True(t, container.UpdatedAt().After(originalUpdatedAt))

	// Update with empty name
	err = container.Update("", uuid.New(), nil, nil)
	assert.Error(t, err)
	assert.Equal(t, "Updated Name", container.Name()) // Should not change
}

func TestContainer_Archive(t *testing.T) {
	container, err := NewContainer(uuid.New(), uuid.New(), "Test Container", nil, nil, nil)
	assert.NoError(t, err)

	assert.False(t, container.IsArchived())
	originalUpdatedAt := container.UpdatedAt()

	container.Archive()

	assert.True(t, container.IsArchived())
	assert.True(t, container.UpdatedAt().After(originalUpdatedAt))
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locationID := uuid.New()

	tests := []struct {
		testName    string
		input       CreateInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful creation",
			input: CreateInput{
				WorkspaceID: workspaceID,
				LocationID:  locationID,
				Name:        "Box A1",
				Description: ptrString("Small box"),
				Capacity:    ptrString("50 items"),
				ShortCode:   ptrString("BA1"),
			},
			setupMock: func(m *MockRepository) {
				m.On("ShortCodeExists", ctx, workspaceID, "BA1").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*container.Container")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "creation without short code",
			input: CreateInput{
				WorkspaceID: workspaceID,
				LocationID:  locationID,
				Name:        "Simple Box",
			},
			setupMock: func(m *MockRepository) {
				// No ShortCodeExists call expected
				m.On("Save", ctx, mock.AnythingOfType("*container.Container")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "short code already taken",
			input: CreateInput{
				WorkspaceID: workspaceID,
				LocationID:  locationID,
				Name:        "Box B1",
				ShortCode:   ptrString("TAKEN"),
			},
			setupMock: func(m *MockRepository) {
				m.On("ShortCodeExists", ctx, workspaceID, "TAKEN").Return(true, nil)
			},
			expectError: true,
			errorType:   ErrShortCodeTaken,
		},
		{
			testName: "invalid input",
			input: CreateInput{
				WorkspaceID: uuid.Nil,
				LocationID:  locationID,
				Name:        "Invalid Container",
			},
			setupMock: func(m *MockRepository) {
				// ShortCodeExists not called due to validation failure
				// Save not called due to entity creation failure
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			container, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, container)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, container)
				assert.Equal(t, tt.input.WorkspaceID, container.WorkspaceID())
				assert.Equal(t, tt.input.LocationID, container.LocationID())
				assert.Equal(t, tt.input.Name, container.Name())
				assert.Equal(t, tt.input.Description, container.Description())
				assert.Equal(t, tt.input.Capacity, container.Capacity())
				assert.Equal(t, tt.input.ShortCode, container.ShortCode())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	containerID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		containerID uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "container found",
			containerID: containerID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				container := &Container{id: containerID, workspaceID: workspaceID, name: "Test Container"}
				m.On("FindByID", ctx, containerID, workspaceID).Return(container, nil)
			},
			expectError: false,
		},
		{
			testName:    "container not found",
			containerID: containerID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, containerID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrContainerNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			container, err := svc.GetByID(ctx, tt.containerID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, container)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, container)
				assert.Equal(t, tt.containerID, container.ID())
				assert.Equal(t, tt.workspaceID, container.WorkspaceID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	pagination := shared.Pagination{Page: 1, PageSize: 10}

	containers := []*Container{
		{id: uuid.New(), workspaceID: workspaceID, name: "Container 1"},
		{id: uuid.New(), workspaceID: workspaceID, name: "Container 2"},
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByWorkspace", ctx, workspaceID, pagination).Return(containers, 2, nil)

	result, err := svc.ListByWorkspace(ctx, workspaceID, pagination)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Items, 2)
	assert.Equal(t, 2, result.Total)
	assert.Equal(t, 1, result.Page)

	mockRepo.AssertExpectations(t)
}

func TestService_Archive(t *testing.T) {
	ctx := context.Background()
	containerID := uuid.New()
	workspaceID := uuid.New()
	container := &Container{id: containerID, workspaceID: workspaceID, name: "Test Container"}

	tests := []struct {
		testName    string
		containerID uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			testName:    "successful archive",
			containerID: containerID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, containerID, workspaceID).Return(container, nil)
				m.On("Save", ctx, mock.Anything).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "container not found",
			containerID: uuid.New(),
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Archive(ctx, tt.containerID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	containerID := uuid.New()
	workspaceID := uuid.New()
	container := &Container{
		id:          containerID,
		workspaceID: workspaceID,
		name:        "Original Name",
		locationID:  uuid.New(),
	}

	newLocationID := uuid.New()
	input := UpdateInput{
		Name:        "Updated Name",
		LocationID:  newLocationID,
		Description: ptrString("Updated description"),
		Capacity:    ptrString("100 items"),
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByID", ctx, containerID, workspaceID).Return(container, nil)
	mockRepo.On("Save", ctx, mock.Anything).Return(nil)

	updatedContainer, err := svc.Update(ctx, containerID, workspaceID, input)

	assert.NoError(t, err)
	assert.NotNil(t, updatedContainer)
	assert.Equal(t, "Updated Name", updatedContainer.Name())
	assert.Equal(t, newLocationID, updatedContainer.LocationID())
	assert.Equal(t, "Updated description", *updatedContainer.Description())
	assert.Equal(t, "100 items", *updatedContainer.Capacity())

	mockRepo.AssertExpectations(t)
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	containerID := uuid.New()
	workspaceID := uuid.New()
	container := &Container{id: containerID, workspaceID: workspaceID, name: "Test Container"}

	tests := []struct {
		testName    string
		containerID uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			testName:    "successful deletion",
			containerID: containerID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, containerID, workspaceID).Return(container, nil)
				m.On("Delete", ctx, containerID).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "container not found",
			containerID: uuid.New(),
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Delete(ctx, tt.containerID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
