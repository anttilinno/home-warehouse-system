package workspace_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
)

func TestNewWorkspace(t *testing.T) {
	description := "Test workspace description"

	tests := []struct {
		name        string
		wsName      string
		slug        string
		description *string
		isPersonal  bool
		wantErr     bool
		errMsg      string
	}{
		{
			name:        "valid workspace with all fields",
			wsName:      "Test Workspace",
			slug:        "test-workspace",
			description: &description,
			isPersonal:  false,
			wantErr:     false,
		},
		{
			name:        "valid workspace without description",
			wsName:      "Another Workspace",
			slug:        "another-workspace",
			description: nil,
			isPersonal:  false,
			wantErr:     false,
		},
		{
			name:        "valid personal workspace",
			wsName:      "Personal Workspace",
			slug:        "personal-ws",
			description: nil,
			isPersonal:  true,
			wantErr:     false,
		},
		{
			name:        "missing workspace name",
			wsName:      "",
			slug:        "test-workspace",
			description: nil,
			isPersonal:  false,
			wantErr:     true,
			errMsg:      "workspace name is required",
		},
		{
			name:        "missing slug",
			wsName:      "Test Workspace",
			slug:        "",
			description: nil,
			isPersonal:  false,
			wantErr:     true,
			errMsg:      "workspace slug is required",
		},
		{
			name:        "missing both name and slug",
			wsName:      "",
			slug:        "",
			description: nil,
			isPersonal:  false,
			wantErr:     true,
			errMsg:      "workspace name is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ws, err := workspace.NewWorkspace(tt.wsName, tt.slug, tt.description, tt.isPersonal)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, ws)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, ws)
				assert.Equal(t, tt.wsName, ws.Name())
				assert.Equal(t, tt.slug, ws.Slug())
				assert.Equal(t, tt.description, ws.Description())
				assert.Equal(t, tt.isPersonal, ws.IsPersonal())
				assert.NotEqual(t, uuid.Nil, ws.ID())
				assert.NotZero(t, ws.CreatedAt())
				assert.NotZero(t, ws.UpdatedAt())
			}
		})
	}
}

func TestWorkspace_Update(t *testing.T) {
	newDescription := "Updated description"
	emptyDescription := ""

	tests := []struct {
		name        string
		updateName  string
		description *string
		wantErr     bool
		errMsg      string
	}{
		{
			name:        "update name",
			updateName:  "Updated Name",
			description: nil,
			wantErr:     false,
		},
		{
			name:        "update name and description",
			updateName:  "Updated Name",
			description: &newDescription,
			wantErr:     false,
		},
		{
			name:        "update to empty description",
			updateName:  "Updated Name",
			description: &emptyDescription,
			wantErr:     false,
		},
		{
			name:        "remove description (nil)",
			updateName:  "Updated Name",
			description: nil,
			wantErr:     false,
		},
		{
			name:        "update to empty name",
			updateName:  "",
			description: &newDescription,
			wantErr:     true,
			errMsg:      "workspace name is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh workspace for each test
			originalDesc := "Original description"
			ws, _ := workspace.NewWorkspace("Original Name", "original-slug", &originalDesc, false)
			originalUpdatedAt := ws.UpdatedAt()
			time.Sleep(time.Millisecond) // Ensure time difference

			err := ws.Update(tt.updateName, tt.description)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.updateName, ws.Name())
				assert.Equal(t, tt.description, ws.Description())
				// Slug should remain unchanged
				assert.Equal(t, "original-slug", ws.Slug())
				// UpdatedAt should be changed
				assert.True(t, ws.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestWorkspace_Getters(t *testing.T) {
	description := "Test description"
	ws, err := workspace.NewWorkspace("Test Workspace", "test-ws", &description, true)
	assert.NoError(t, err)

	// Test all getters
	assert.NotEqual(t, uuid.Nil, ws.ID())
	assert.Equal(t, "Test Workspace", ws.Name())
	assert.Equal(t, "test-ws", ws.Slug())
	assert.Equal(t, &description, ws.Description())
	assert.True(t, ws.IsPersonal())
	assert.NotZero(t, ws.CreatedAt())
	assert.NotZero(t, ws.UpdatedAt())
}

func TestWorkspace_Reconstruct(t *testing.T) {
	id := uuid.New()
	name := "Reconstructed Workspace"
	slug := "reconstructed-ws"
	description := "Reconstructed description"
	isPersonal := false
	createdAt := time.Now().Add(-24 * time.Hour)
	updatedAt := time.Now()

	ws := workspace.Reconstruct(
		id,
		name,
		slug,
		&description,
		isPersonal,
		createdAt,
		updatedAt,
	)

	assert.NotNil(t, ws)
	assert.Equal(t, id, ws.ID())
	assert.Equal(t, name, ws.Name())
	assert.Equal(t, slug, ws.Slug())
	assert.Equal(t, &description, ws.Description())
	assert.Equal(t, isPersonal, ws.IsPersonal())
	assert.Equal(t, createdAt, ws.CreatedAt())
	assert.Equal(t, updatedAt, ws.UpdatedAt())
}

func TestWorkspace_ReconstructWithNilDescription(t *testing.T) {
	id := uuid.New()
	name := "Reconstructed Workspace"
	slug := "reconstructed-ws"
	createdAt := time.Now().Add(-24 * time.Hour)
	updatedAt := time.Now()

	ws := workspace.Reconstruct(
		id,
		name,
		slug,
		nil,
		false,
		createdAt,
		updatedAt,
	)

	assert.NotNil(t, ws)
	assert.Equal(t, id, ws.ID())
	assert.Equal(t, name, ws.Name())
	assert.Equal(t, slug, ws.Slug())
	assert.Nil(t, ws.Description())
	assert.False(t, ws.IsPersonal())
	assert.Equal(t, createdAt, ws.CreatedAt())
	assert.Equal(t, updatedAt, ws.UpdatedAt())
}

func TestWorkspace_SlugImmutable(t *testing.T) {
	description := "Test description"
	ws, err := workspace.NewWorkspace("Test Workspace", "original-slug", &description, false)
	assert.NoError(t, err)
	assert.Equal(t, "original-slug", ws.Slug())

	// Update the workspace
	newDescription := "New description"
	err = ws.Update("Updated Name", &newDescription)
	assert.NoError(t, err)

	// Slug should remain unchanged
	assert.Equal(t, "original-slug", ws.Slug())
	assert.Equal(t, "Updated Name", ws.Name())
	assert.Equal(t, &newDescription, ws.Description())
}

func TestWorkspace_PersonalFlagImmutable(t *testing.T) {
	description := "Test description"
	ws, err := workspace.NewWorkspace("Test Workspace", "test-ws", &description, true)
	assert.NoError(t, err)
	assert.True(t, ws.IsPersonal())

	// Update the workspace
	newDescription := "New description"
	err = ws.Update("Updated Name", &newDescription)
	assert.NoError(t, err)

	// IsPersonal should remain unchanged
	assert.True(t, ws.IsPersonal())
}
