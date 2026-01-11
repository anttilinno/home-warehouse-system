package location

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

func (m *MockRepository) Save(ctx context.Context, location *Location) error {
	args := m.Called(ctx, location)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Location, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Location), args.Error(1)
}

func (m *MockRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*Location, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Location), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Location, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*Location), args.Int(1), args.Error(2)
}

func (m *MockRepository) FindRootLocations(ctx context.Context, workspaceID uuid.UUID) ([]*Location, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Location), args.Error(1)
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

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewLocation(t *testing.T) {
	workspaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		testName       string
		workspaceID    uuid.UUID
		locationName   string
		parentLocation *uuid.UUID
		zone           *string
		shelf          *string
		bin            *string
		description    *string
		shortCode      *string
		expectError    bool
		errorField     string
	}{
		{
			testName:       "valid location",
			workspaceID:    workspaceID,
			locationName:   "Warehouse A",
			parentLocation: &parentID,
			zone:           ptrString("Zone 1"),
			shelf:          ptrString("Shelf A"),
			bin:            ptrString("Bin 01"),
			description:    ptrString("Main storage area"),
			shortCode:      ptrString("WHA"),
			expectError:    false,
		},
		{
			testName:       "root location without parent",
			workspaceID:    workspaceID,
			locationName:   "Main Warehouse",
			parentLocation: nil,
			zone:           nil,
			shelf:          nil,
			bin:            nil,
			description:    ptrString("Root location"),
			shortCode:      nil,
			expectError:    false,
		},
		{
			testName:       "invalid workspace ID",
			workspaceID:    uuid.Nil,
			locationName:   "Warehouse A",
			parentLocation: nil,
			zone:           nil,
			shelf:          nil,
			bin:            nil,
			description:    nil,
			shortCode:      nil,
			expectError:    true,
			errorField:     "workspace_id",
		},
		{
			testName:       "empty name",
			workspaceID:    workspaceID,
			locationName:   "",
			parentLocation: nil,
			zone:           nil,
			shelf:          nil,
			bin:            nil,
			description:    nil,
			shortCode:      nil,
			expectError:    true,
			errorField:     "name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			location, err := NewLocation(tt.workspaceID, tt.locationName, tt.parentLocation, tt.zone, tt.shelf, tt.bin, tt.description, tt.shortCode)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, location)
				if domainErr, ok := err.(*shared.DomainError); ok && domainErr.Field != "" {
					assert.Equal(t, tt.errorField, domainErr.Field)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, location)
				assert.Equal(t, tt.workspaceID, location.WorkspaceID())
				assert.Equal(t, tt.locationName, location.Name())
				assert.Equal(t, tt.parentLocation, location.ParentLocation())
				assert.Equal(t, tt.zone, location.Zone())
				assert.Equal(t, tt.shelf, location.Shelf())
				assert.Equal(t, tt.bin, location.Bin())
				assert.Equal(t, tt.description, location.Description())
				assert.Equal(t, tt.shortCode, location.ShortCode())
				assert.False(t, location.IsArchived())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	parentID := uuid.New()
	now := time.Now()

	location := Reconstruct(
		id,
		workspaceID,
		"Warehouse A",
		&parentID,
		ptrString("Zone 1"),
		ptrString("Shelf A"),
		ptrString("Bin 01"),
		ptrString("Description"),
		ptrString("WHA"),
		true,
		now,
		now,
	)

	assert.Equal(t, id, location.ID())
	assert.Equal(t, workspaceID, location.WorkspaceID())
	assert.Equal(t, "Warehouse A", location.Name())
	assert.Equal(t, &parentID, location.ParentLocation())
	assert.Equal(t, "Zone 1", *location.Zone())
	assert.Equal(t, "Shelf A", *location.Shelf())
	assert.Equal(t, "Bin 01", *location.Bin())
	assert.Equal(t, "Description", *location.Description())
	assert.Equal(t, "WHA", *location.ShortCode())
	assert.True(t, location.IsArchived())
	assert.Equal(t, now, location.CreatedAt())
	assert.Equal(t, now, location.UpdatedAt())
}

func TestLocation_Update(t *testing.T) {
	parentID := uuid.New()
	location, err := NewLocation(uuid.New(), "Original Name", &parentID, nil, nil, nil, nil, nil)
	assert.NoError(t, err)

	originalUpdatedAt := location.UpdatedAt()

	// Update with valid data
	newParentID := uuid.New()
	err = location.Update("Updated Name", &newParentID, ptrString("New Zone"), ptrString("New Shelf"), ptrString("New Bin"), ptrString("New Description"))
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", location.Name())
	assert.Equal(t, &newParentID, location.ParentLocation())
	assert.Equal(t, "New Zone", *location.Zone())
	assert.Equal(t, "New Shelf", *location.Shelf())
	assert.Equal(t, "New Bin", *location.Bin())
	assert.Equal(t, "New Description", *location.Description())
	assert.True(t, location.UpdatedAt().After(originalUpdatedAt))

	// Update with empty name
	err = location.Update("", nil, nil, nil, nil, nil)
	assert.Error(t, err)
	assert.Equal(t, "Updated Name", location.Name()) // Should not change
}

func TestLocation_Archive(t *testing.T) {
	location, err := NewLocation(uuid.New(), "Test Location", nil, nil, nil, nil, nil, nil)
	assert.NoError(t, err)

	assert.False(t, location.IsArchived())
	originalUpdatedAt := location.UpdatedAt()

	location.Archive()

	assert.True(t, location.IsArchived())
	assert.True(t, location.UpdatedAt().After(originalUpdatedAt))
}

func TestLocation_Restore(t *testing.T) {
	location, err := NewLocation(uuid.New(), "Test Location", nil, nil, nil, nil, nil, nil)
	assert.NoError(t, err)

	location.Archive()
	assert.True(t, location.IsArchived())
	originalUpdatedAt := location.UpdatedAt()

	location.Restore()

	assert.False(t, location.IsArchived())
	assert.True(t, location.UpdatedAt().After(originalUpdatedAt))
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

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
				Name:        "Warehouse A",
				Zone:        ptrString("Zone 1"),
				Shelf:       ptrString("Shelf A"),
				ShortCode:   ptrString("WHA"),
			},
			setupMock: func(m *MockRepository) {
				m.On("ShortCodeExists", ctx, workspaceID, "WHA").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "creation without short code",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "Warehouse B",
				Zone:        ptrString("Zone 2"),
			},
			setupMock: func(m *MockRepository) {
				// No ShortCodeExists call expected
				m.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "short code already taken",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "Warehouse C",
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
				Name:        "Invalid Location",
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

			location, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, location)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, location)
				assert.Equal(t, tt.input.WorkspaceID, location.WorkspaceID())
				assert.Equal(t, tt.input.Name, location.Name())
				assert.Equal(t, tt.input.Zone, location.Zone())
				assert.Equal(t, tt.input.Shelf, location.Shelf())
				assert.Equal(t, tt.input.ShortCode, location.ShortCode())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	locationID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		locationID  uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "location found",
			locationID:  locationID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				location := &Location{id: locationID, workspaceID: workspaceID, name: "Test Location"}
				m.On("FindByID", ctx, locationID, workspaceID).Return(location, nil)
			},
			expectError: false,
		},
		{
			testName:    "location not found",
			locationID:  locationID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, locationID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrLocationNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			location, err := svc.GetByID(ctx, tt.locationID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, location)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, location)
				assert.Equal(t, tt.locationID, location.ID())
				assert.Equal(t, tt.workspaceID, location.WorkspaceID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	pagination := shared.Pagination{Page: 1, PageSize: 10}

	locations := []*Location{
		{id: uuid.New(), workspaceID: workspaceID, name: "Location 1"},
		{id: uuid.New(), workspaceID: workspaceID, name: "Location 2"},
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByWorkspace", ctx, workspaceID, pagination).Return(locations, 2, nil)

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
	locationID := uuid.New()
	workspaceID := uuid.New()
	location := &Location{id: locationID, workspaceID: workspaceID, name: "Test Location"}

	tests := []struct {
		testName    string
		locationID  uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			testName:    "successful archive",
			locationID:  locationID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, locationID, workspaceID).Return(location, nil)
				m.On("Save", ctx, mock.Anything).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "location not found",
			locationID:  uuid.New(),
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

			err := svc.Archive(ctx, tt.locationID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	locationID := uuid.New()
	workspaceID := uuid.New()
	location := &Location{id: locationID, workspaceID: workspaceID, name: "Test Location"}

	tests := []struct {
		name        string
		locationID  uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			name:        "successful deletion",
			locationID:  locationID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, locationID, workspaceID).Return(location, nil)
				m.On("Delete", ctx, locationID).Return(nil)
			},
			expectError: false,
		},
		{
			name:        "location not found",
			locationID:  uuid.New(),
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Delete(ctx, tt.locationID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// =============================================================================
// Breadcrumb Tests
// =============================================================================

func TestService_GetBreadcrumb(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	// Create a 3-level hierarchy: Root -> Parent -> Child
	rootID := uuid.New()
	parentID := uuid.New()
	childID := uuid.New()

	rootLocation := &Location{id: rootID, workspaceID: workspaceID, name: "Root", parentLocation: nil, shortCode: ptrString("ROOT")}
	parentLocation := &Location{id: parentID, workspaceID: workspaceID, name: "Parent", parentLocation: &rootID, shortCode: ptrString("PARENT")}
	childLocation := &Location{id: childID, workspaceID: workspaceID, name: "Child", parentLocation: &parentID, shortCode: nil}

	tests := []struct {
		name           string
		locationID     uuid.UUID
		setupMock      func(*MockRepository)
		expectedLength int
		expectedFirst  string
		expectedLast   string
		expectError    bool
	}{
		{
			name:       "nested location breadcrumb trail",
			locationID: childID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, childID, workspaceID).Return(childLocation, nil)
				m.On("FindByID", ctx, parentID, workspaceID).Return(parentLocation, nil)
				m.On("FindByID", ctx, rootID, workspaceID).Return(rootLocation, nil)
			},
			expectedLength: 3,
			expectedFirst:  "Root",
			expectedLast:   "Child",
			expectError:    false,
		},
		{
			name:       "root location returns single item",
			locationID: rootID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, rootID, workspaceID).Return(rootLocation, nil)
			},
			expectedLength: 1,
			expectedFirst:  "Root",
			expectedLast:   "Root",
			expectError:    false,
		},
		{
			name:       "non-existent location returns empty breadcrumb",
			locationID: uuid.New(),
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectedLength: 0,
			expectError:    false,
		},
		{
			name:       "circular reference prevention",
			locationID: childID,
			setupMock: func(m *MockRepository) {
				// Create a cycle: child -> parent -> child (bad data)
				cyclicParent := &Location{id: parentID, workspaceID: workspaceID, name: "Parent", parentLocation: &childID}
				cyclicChild := &Location{id: childID, workspaceID: workspaceID, name: "Child", parentLocation: &parentID}
				m.On("FindByID", ctx, childID, workspaceID).Return(cyclicChild, nil).Once()
				m.On("FindByID", ctx, parentID, workspaceID).Return(cyclicParent, nil).Once()
				// After visiting child again, it should stop due to visited check
			},
			expectedLength: 2, // Should stop at cycle, not infinite loop
			expectedFirst:  "Parent",
			expectedLast:   "Child",
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			breadcrumb, err := svc.GetBreadcrumb(ctx, tt.locationID, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Len(t, breadcrumb, tt.expectedLength)

				if tt.expectedLength > 0 {
					assert.Equal(t, tt.expectedFirst, breadcrumb[0].Name)
					assert.Equal(t, tt.expectedLast, breadcrumb[len(breadcrumb)-1].Name)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetBreadcrumb_IncludesShortCode(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locationID := uuid.New()

	location := &Location{
		id:          locationID,
		workspaceID: workspaceID,
		name:        "Warehouse A",
		shortCode:   ptrString("WHA"),
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByID", ctx, locationID, workspaceID).Return(location, nil)

	breadcrumb, err := svc.GetBreadcrumb(ctx, locationID, workspaceID)

	assert.NoError(t, err)
	assert.Len(t, breadcrumb, 1)
	assert.Equal(t, "Warehouse A", breadcrumb[0].Name)
	assert.NotNil(t, breadcrumb[0].ShortCode)
	assert.Equal(t, "WHA", *breadcrumb[0].ShortCode)

	mockRepo.AssertExpectations(t)
}
