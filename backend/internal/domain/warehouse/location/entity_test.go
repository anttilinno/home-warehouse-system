package location_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
)

func TestNewLocation(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		name       string
		wsID       uuid.UUID
		locName    string
		shortCode  string
		wantErr    bool
		errMsg     string
	}{
		{
			name:      "valid location with minimal fields",
			wsID:      workspaceID,
			locName:   "Warehouse A",
			shortCode: "WH-A",
			wantErr:   false,
		},
		{
			name:      "missing location name",
			wsID:      workspaceID,
			locName:   "",
			shortCode: "WH-A",
			wantErr:   true,
			errMsg:    "name",
		},
		{
			name:      "nil workspace ID",
			wsID:      uuid.Nil,
			locName:   "Location",
			shortCode: "LOC-1",
			wantErr:   true,
			errMsg:    "workspace_id",
		},
		{
			name:      "missing short code",
			wsID:      workspaceID,
			locName:   "Warehouse B",
			shortCode: "",
			wantErr:   true,
			errMsg:    "short_code",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loc, err := location.NewLocation(tt.wsID, tt.locName, nil, nil, tt.shortCode)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, loc)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, loc)
				assert.Equal(t, tt.wsID, loc.WorkspaceID())
				assert.Equal(t, tt.locName, loc.Name())
				assert.Equal(t, tt.shortCode, loc.ShortCode())
				assert.NotEqual(t, uuid.Nil, loc.ID())
				assert.False(t, loc.IsArchived())
			}
		})
	}
}

func TestNewLocation_WithOptionalFields(t *testing.T) {
	workspaceID := uuid.New()
	parentID := uuid.New()
	description := "Main storage"
	shortCode := "WH-A-1-5"

	loc, err := location.NewLocation(workspaceID, "Test Location", &parentID, &description, shortCode)

	assert.NoError(t, err)
	assert.NotNil(t, loc)
	assert.Equal(t, "Test Location", loc.Name())
	assert.Equal(t, &parentID, loc.ParentLocation())
	assert.Equal(t, &description, loc.Description())
	assert.Equal(t, shortCode, loc.ShortCode())
}

func TestLocation_Update(t *testing.T) {
	workspaceID := uuid.New()
	loc, err := location.NewLocation(workspaceID, "Original Name", nil, nil, "LOC-1")
	assert.NoError(t, err)

	newName := "Updated Name"
	description := "Updated description"

	err = loc.Update(newName, nil, &description)

	assert.NoError(t, err)
	assert.Equal(t, newName, loc.Name())
	assert.Equal(t, &description, loc.Description())
}

func TestLocation_Update_EmptyName(t *testing.T) {
	workspaceID := uuid.New()
	loc, err := location.NewLocation(workspaceID, "Original Name", nil, nil, "LOC-2")
	assert.NoError(t, err)

	err = loc.Update("", nil, nil)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name")
}

func TestLocation_Archive(t *testing.T) {
	workspaceID := uuid.New()
	loc, err := location.NewLocation(workspaceID, "Test Location", nil, nil, "LOC-3")
	assert.NoError(t, err)

	assert.False(t, loc.IsArchived())

	loc.Archive()

	assert.True(t, loc.IsArchived())
}

func TestLocation_Restore(t *testing.T) {
	workspaceID := uuid.New()
	loc, err := location.NewLocation(workspaceID, "Test Location", nil, nil, "LOC-4")
	assert.NoError(t, err)

	loc.Archive()
	assert.True(t, loc.IsArchived())

	loc.Restore()

	assert.False(t, loc.IsArchived())
}

func TestLocation_Reconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	parentID := uuid.New()
	description := "Storage area"
	shortCode := "WH-A"
	now := time.Now()

	loc := location.Reconstruct(
		id,
		workspaceID,
		"Test Location",
		&parentID,
		&description,
		shortCode,
		false,
		now,
		now,
	)

	assert.NotNil(t, loc)
	assert.Equal(t, id, loc.ID())
	assert.Equal(t, workspaceID, loc.WorkspaceID())
	assert.Equal(t, "Test Location", loc.Name())
	assert.Equal(t, &parentID, loc.ParentLocation())
	assert.Equal(t, &description, loc.Description())
	assert.Equal(t, shortCode, loc.ShortCode())
	assert.False(t, loc.IsArchived())
}
