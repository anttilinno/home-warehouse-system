package label

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

func (m *MockRepository) Save(ctx context.Context, label *Label) error {
	args := m.Called(ctx, label)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Label, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Label), args.Error(1)
}

func (m *MockRepository) FindByName(ctx context.Context, workspaceID uuid.UUID, name string) (*Label, error) {
	args := m.Called(ctx, workspaceID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Label), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Label, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Label), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) NameExists(ctx context.Context, workspaceID uuid.UUID, name string) (bool, error) {
	args := m.Called(ctx, workspaceID, name)
	return args.Bool(0), args.Error(1)
}

func ptrString(s string) *string {
	return &s
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewLabel(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		name        string
		color       *string
		description *string
		expectError bool
		errorField  string
	}{
		{
			testName:    "valid label with color",
			workspaceID: workspaceID,
			name:        "Fragile",
			color:       ptrString("#FF0000"),
			description: ptrString("Handle with care"),
			expectError: false,
		},
		{
			testName:    "valid label without color",
			workspaceID: workspaceID,
			name:        "Heavy",
			color:       nil,
			description: ptrString("Requires two people"),
			expectError: false,
		},
		{
			testName:    "minimal label",
			workspaceID: workspaceID,
			name:        "New",
			color:       nil,
			description: nil,
			expectError: false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			name:        "Test Label",
			color:       ptrString("#FF0000"),
			description: nil,
			expectError: true,
			errorField:  "workspace_id",
		},
		{
			testName:    "empty name",
			workspaceID: workspaceID,
			name:        "",
			color:       ptrString("#FF0000"),
			description: nil,
			expectError: true,
			errorField:  "name",
		},
		{
			testName:    "invalid color format",
			workspaceID: workspaceID,
			name:        "Test Label",
			color:       ptrString("red"),
			description: nil,
			expectError: true,
			errorField:  "color",
		},
		{
			testName:    "invalid color short hex",
			workspaceID: workspaceID,
			name:        "Test Label",
			color:       ptrString("#F00"),
			description: nil,
			expectError: true,
			errorField:  "color",
		},
		{
			testName:    "invalid color lowercase",
			workspaceID: workspaceID,
			name:        "Test Label",
			color:       ptrString("#ff000"),
			description: nil,
			expectError: true,
			errorField:  "color",
		},
		{
			testName:    "valid color uppercase",
			workspaceID: workspaceID,
			name:        "Test Label",
			color:       ptrString("#FF0000"),
			description: nil,
			expectError: false,
		},
		{
			testName:    "valid color lowercase",
			workspaceID: workspaceID,
			name:        "Test Label",
			color:       ptrString("#ff0000"),
			description: nil,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			label, err := NewLabel(tt.workspaceID, tt.name, tt.color, tt.description)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, label)
				if domainErr, ok := err.(*shared.DomainError); ok && domainErr.Field != "" {
					assert.Equal(t, tt.errorField, domainErr.Field)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, label)
				assert.Equal(t, tt.workspaceID, label.WorkspaceID())
				assert.Equal(t, tt.name, label.Name())
				assert.Equal(t, tt.color, label.Color())
				assert.Equal(t, tt.description, label.Description())
				assert.False(t, label.IsArchived())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()

	label := Reconstruct(
		id,
		workspaceID,
		"Test Label",
		ptrString("#FF0000"),
		ptrString("Description"),
		true,
		now,
		now,
	)

	assert.Equal(t, id, label.ID())
	assert.Equal(t, workspaceID, label.WorkspaceID())
	assert.Equal(t, "Test Label", label.Name())
	assert.Equal(t, "#FF0000", *label.Color())
	assert.Equal(t, "Description", *label.Description())
	assert.True(t, label.IsArchived())
	assert.Equal(t, now, label.CreatedAt())
	assert.Equal(t, now, label.UpdatedAt())
}

func TestLabel_Update(t *testing.T) {
	label, err := NewLabel(uuid.New(), "Original Name", ptrString("#FF0000"), ptrString("Original desc"))
	assert.NoError(t, err)

	originalUpdatedAt := label.UpdatedAt()

	err = label.Update("Updated Name", ptrString("#00FF00"), ptrString("Updated description"))
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", label.Name())
	assert.Equal(t, "#00FF00", *label.Color())
	assert.Equal(t, "Updated description", *label.Description())
	assert.True(t, label.UpdatedAt().After(originalUpdatedAt))

	// Update with empty name
	err = label.Update("", nil, nil)
	assert.Error(t, err)
	assert.Equal(t, "Updated Name", label.Name()) // Should not change
}

func TestLabel_Archive(t *testing.T) {
	label, err := NewLabel(uuid.New(), "Test Label", nil, nil)
	assert.NoError(t, err)

	assert.False(t, label.IsArchived())
	originalUpdatedAt := label.UpdatedAt()

	label.Archive()

	assert.True(t, label.IsArchived())
	assert.True(t, label.UpdatedAt().After(originalUpdatedAt))
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
				Name:        "Fragile",
				Color:       ptrString("#FF0000"),
				Description: ptrString("Handle with care"),
			},
			setupMock: func(m *MockRepository) {
				m.On("NameExists", ctx, workspaceID, "Fragile").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*label.Label")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "creation without color",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "Heavy",
				Description: ptrString("Requires two people"),
			},
			setupMock: func(m *MockRepository) {
				m.On("NameExists", ctx, workspaceID, "Heavy").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*label.Label")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "name already taken",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "Taken",
			},
			setupMock: func(m *MockRepository) {
				m.On("NameExists", ctx, workspaceID, "Taken").Return(true, nil)
			},
			expectError: true,
			errorType:   ErrNameTaken,
		},
		{
			testName: "invalid input",
			input: CreateInput{
				WorkspaceID: uuid.Nil,
				Name:        "Invalid Label",
			},
			setupMock: func(m *MockRepository) {
				// NameExists is called before validation, but since validation fails
				// we need to mock it anyway to avoid the panic
				m.On("NameExists", ctx, uuid.Nil, "Invalid Label").Return(false, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			label, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, label)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, label)
				assert.Equal(t, tt.input.WorkspaceID, label.WorkspaceID())
				assert.Equal(t, tt.input.Name, label.Name())
				assert.Equal(t, tt.input.Color, label.Color())
				assert.Equal(t, tt.input.Description, label.Description())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	labelID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		labelID     uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "label found",
			labelID:     labelID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				label := &Label{id: labelID, workspaceID: workspaceID, name: "Test Label"}
				m.On("FindByID", ctx, labelID, workspaceID).Return(label, nil)
			},
			expectError: false,
		},
		{
			testName:    "label not found",
			labelID:     labelID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, labelID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrLabelNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			label, err := svc.GetByID(ctx, tt.labelID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, label)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, label)
				assert.Equal(t, tt.labelID, label.ID())
				assert.Equal(t, tt.workspaceID, label.WorkspaceID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	labels := []*Label{
		{id: uuid.New(), workspaceID: workspaceID, name: "Label 1", color: ptrString("#FF0000")},
		{id: uuid.New(), workspaceID: workspaceID, name: "Label 2", color: ptrString("#00FF00")},
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByWorkspace", ctx, workspaceID).Return(labels, nil)

	result, err := svc.ListByWorkspace(ctx, workspaceID)

	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, "Label 1", result[0].Name())
	assert.Equal(t, "#FF0000", *result[0].Color())
	assert.Equal(t, "Label 2", result[1].Name())
	assert.Equal(t, "#00FF00", *result[1].Color())

	mockRepo.AssertExpectations(t)
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	labelID := uuid.New()
	workspaceID := uuid.New()
	label := &Label{
		id:          labelID,
		workspaceID: workspaceID,
		name:        "Original Name",
		color:       ptrString("#FF0000"),
	}

	input := UpdateInput{
		Name:        "Updated Name",
		Color:       ptrString("#00FF00"),
		Description: ptrString("Updated description"),
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByID", ctx, labelID, workspaceID).Return(label, nil)
	mockRepo.On("NameExists", ctx, workspaceID, "Updated Name").Return(false, nil)
	mockRepo.On("Save", ctx, mock.Anything).Return(nil)

	updatedLabel, err := svc.Update(ctx, labelID, workspaceID, input)

	assert.NoError(t, err)
	assert.NotNil(t, updatedLabel)
	assert.Equal(t, "Updated Name", updatedLabel.Name())
	assert.Equal(t, "#00FF00", *updatedLabel.Color())
	assert.Equal(t, "Updated description", *updatedLabel.Description())

	mockRepo.AssertExpectations(t)
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	labelID := uuid.New()
	workspaceID := uuid.New()
	label := &Label{id: labelID, workspaceID: workspaceID, name: "Test Label"}

	tests := []struct {
		testName    string
		labelID     uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			testName:    "successful deletion",
			labelID:     labelID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, labelID, workspaceID).Return(label, nil)
				m.On("Delete", ctx, labelID).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "label not found",
			labelID:     uuid.New(),
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

			err := svc.Delete(ctx, tt.labelID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
