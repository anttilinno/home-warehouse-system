package workspace

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

func (m *MockRepository) Save(ctx context.Context, workspace *Workspace) error {
	args := m.Called(ctx, workspace)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id uuid.UUID) (*Workspace, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Workspace), args.Error(1)
}

func (m *MockRepository) FindBySlug(ctx context.Context, slug string) (*Workspace, error) {
	args := m.Called(ctx, slug)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Workspace), args.Error(1)
}

func (m *MockRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*Workspace, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Workspace), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	args := m.Called(ctx, slug)
	return args.Bool(0), args.Error(1)
}

func ptrString(s string) *string {
	return &s
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewWorkspace(t *testing.T) {
	tests := []struct {
		name        string
		nameInput   string
		slug        string
		description *string
		isPersonal  bool
		expectError bool
		errorField  string
	}{
		{
			name:        "valid workspace",
			nameInput:   "My Workspace",
			slug:        "my-workspace",
			description: ptrString("A test workspace"),
			isPersonal:  false,
			expectError: false,
		},
		{
			name:        "personal workspace",
			nameInput:   "Personal",
			slug:        "personal",
			description: nil,
			isPersonal:  true,
			expectError: false,
		},
		{
			name:        "empty name",
			nameInput:   "",
			slug:        "my-workspace",
			description: ptrString("A test workspace"),
			isPersonal:  false,
			expectError: true,
			errorField:  "name",
		},
		{
			name:        "empty slug",
			nameInput:   "My Workspace",
			slug:        "",
			description: ptrString("A test workspace"),
			isPersonal:  false,
			expectError: true,
			errorField:  "slug",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			workspace, err := NewWorkspace(tt.nameInput, tt.slug, tt.description, tt.isPersonal)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, workspace)
				if domainErr, ok := err.(*shared.DomainError); ok && domainErr.Field != "" {
					assert.Equal(t, tt.errorField, domainErr.Field)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, workspace)
				assert.Equal(t, tt.nameInput, workspace.Name())
				assert.Equal(t, tt.slug, workspace.Slug())
				assert.Equal(t, tt.description, workspace.Description())
				assert.Equal(t, tt.isPersonal, workspace.IsPersonal())
				assert.NotEmpty(t, workspace.ID())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	now := time.Now()

	workspace := Reconstruct(
		id,
		"My Workspace",
		"my-workspace",
		ptrString("A test workspace"),
		false,
		now,
		now,
	)

	assert.Equal(t, id, workspace.ID())
	assert.Equal(t, "My Workspace", workspace.Name())
	assert.Equal(t, "my-workspace", workspace.Slug())
	assert.Equal(t, "A test workspace", *workspace.Description())
	assert.False(t, workspace.IsPersonal())
	assert.Equal(t, now, workspace.CreatedAt())
	assert.Equal(t, now, workspace.UpdatedAt())
}

func TestWorkspace_Update(t *testing.T) {
	workspace, err := NewWorkspace("Original Name", "original-slug", ptrString("Original desc"), false)
	assert.NoError(t, err)

	originalUpdatedAt := workspace.UpdatedAt()

	// Update with valid data
	err = workspace.Update("Updated Name", ptrString("Updated description"))
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", workspace.Name())
	assert.Equal(t, "Updated description", *workspace.Description())
	assert.True(t, workspace.UpdatedAt().After(originalUpdatedAt))

	// Update with empty name
	err = workspace.Update("", ptrString("Updated description"))
	assert.Error(t, err)
	assert.Equal(t, "Updated Name", workspace.Name()) // Should not change
}

func TestWorkspace_Update_RemoveDescription(t *testing.T) {
	workspace, err := NewWorkspace("Name", "slug", ptrString("Description"), false)
	assert.NoError(t, err)

	err = workspace.Update("Updated Name", nil)
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", workspace.Name())
	assert.Nil(t, workspace.Description())
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Create(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name        string
		input       CreateWorkspaceInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name: "successful creation",
			input: CreateWorkspaceInput{
				Name:        "My Workspace",
				Slug:        "my-workspace",
				Description: ptrString("A test workspace"),
				IsPersonal:  false,
			},
			setupMock: func(m *MockRepository) {
				m.On("ExistsBySlug", ctx, "my-workspace").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*workspace.Workspace")).Return(nil)
			},
			expectError: false,
		},
		{
			name: "slug already taken",
			input: CreateWorkspaceInput{
				Name:        "My Workspace",
				Slug:        "taken-slug",
				Description: ptrString("A test workspace"),
				IsPersonal:  false,
			},
			setupMock: func(m *MockRepository) {
				m.On("ExistsBySlug", ctx, "taken-slug").Return(true, nil)
			},
			expectError: true,
			errorType:   ErrSlugTaken,
		},
		{
			name: "invalid input",
			input: CreateWorkspaceInput{
				Name:        "",
				Slug:        "my-workspace",
				Description: ptrString("A test workspace"),
				IsPersonal:  false,
			},
			setupMock: func(m *MockRepository) {
				m.On("ExistsBySlug", ctx, "my-workspace").Return(false, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo, nil) // nil memberRepo for tests without auto-add

			tt.setupMock(mockRepo)

			workspace, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, workspace)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, workspace)
				assert.Equal(t, tt.input.Name, workspace.Name())
				assert.Equal(t, tt.input.Slug, workspace.Slug())
				assert.Equal(t, tt.input.Description, workspace.Description())
				assert.Equal(t, tt.input.IsPersonal, workspace.IsPersonal())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		name        string
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name:        "workspace found",
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				workspace := &Workspace{id: workspaceID, name: "Test Workspace", slug: "test-workspace"}
				m.On("FindByID", ctx, workspaceID).Return(workspace, nil)
			},
			expectError: false,
		},
		{
			name:        "workspace not found",
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrWorkspaceNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo, nil)

			tt.setupMock(mockRepo)

			workspace, err := svc.GetByID(ctx, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, workspace)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, workspace)
				assert.Equal(t, tt.workspaceID, workspace.ID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetBySlug(t *testing.T) {
	ctx := context.Background()
	slug := "test-workspace"

	tests := []struct {
		name        string
		slug        string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name: "workspace found",
			slug: slug,
			setupMock: func(m *MockRepository) {
				workspace := &Workspace{id: uuid.New(), name: "Test Workspace", slug: slug}
				m.On("FindBySlug", ctx, slug).Return(workspace, nil)
			},
			expectError: false,
		},
		{
			name: "workspace not found",
			slug: slug,
			setupMock: func(m *MockRepository) {
				m.On("FindBySlug", ctx, slug).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrWorkspaceNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo, nil)

			tt.setupMock(mockRepo)

			workspace, err := svc.GetBySlug(ctx, tt.slug)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, workspace)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, workspace)
				assert.Equal(t, tt.slug, workspace.Slug())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetUserWorkspaces(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	workspaces := []*Workspace{
		{id: uuid.New(), name: "Workspace 1", slug: "workspace-1"},
		{id: uuid.New(), name: "Workspace 2", slug: "workspace-2"},
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo, nil)

	mockRepo.On("FindByUserID", ctx, userID).Return(workspaces, nil)

	result, err := svc.GetUserWorkspaces(ctx, userID)

	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, "Workspace 1", result[0].Name())
	assert.Equal(t, "Workspace 2", result[1].Name())

	mockRepo.AssertExpectations(t)
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	workspace, _ := NewWorkspace("Original Name", "original-slug", ptrString("Original desc"), false)

	tests := []struct {
		name        string
		workspaceID uuid.UUID
		input       UpdateWorkspaceInput
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			name:        "successful update",
			workspaceID: workspaceID,
			input: UpdateWorkspaceInput{
				Name:        "Updated Name",
				Description: ptrString("Updated description"),
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, workspaceID).Return(workspace, nil)
				m.On("Save", ctx, mock.MatchedBy(func(w *Workspace) bool {
					return w.Name() == "Updated Name"
				})).Return(nil)
			},
			expectError: false,
		},
		{
			name:        "workspace not found",
			workspaceID: uuid.New(),
			input: UpdateWorkspaceInput{
				Name:        "Updated Name",
				Description: ptrString("Updated description"),
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything).Return(nil, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo, nil)

			tt.setupMock(mockRepo)

			updatedWorkspace, err := svc.Update(ctx, tt.workspaceID, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, updatedWorkspace)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, updatedWorkspace)
				assert.Equal(t, tt.input.Name, updatedWorkspace.Name())
				assert.Equal(t, tt.input.Description, updatedWorkspace.Description())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		name        string
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name:        "successful deletion",
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				workspace, _ := NewWorkspace("Test", "test", nil, false)
				m.On("FindByID", ctx, workspaceID).Return(workspace, nil)
				m.On("Delete", ctx, workspaceID).Return(nil)
			},
			expectError: false,
		},
		{
			name:        "cannot delete personal workspace",
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				workspace, _ := NewWorkspace("Personal", "personal", nil, true)
				m.On("FindByID", ctx, workspaceID).Return(workspace, nil)
			},
			expectError: true,
			errorType:   ErrCannotDeletePersonal,
		},
		{
			name:        "workspace not found",
			workspaceID: uuid.New(),
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrWorkspaceNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo, nil)

			tt.setupMock(mockRepo)

			err := svc.Delete(ctx, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
