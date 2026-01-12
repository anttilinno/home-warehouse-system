package container_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
)

func TestNewContainer(t *testing.T) {
	workspaceID := uuid.New()
	locationID := uuid.New()

	tests := []struct {
		name        string
		wsID        uuid.UUID
		locID       uuid.UUID
		contName    string
		wantErr     bool
		errMsg      string
	}{
		{
			name:     "valid container",
			wsID:     workspaceID,
			locID:    locationID,
			contName: "Box A",
			wantErr:  false,
		},
		{
			name:     "missing name",
			wsID:     workspaceID,
			locID:    locationID,
			contName: "",
			wantErr:  true,
			errMsg:   "name",
		},
		{
			name:     "nil workspace ID",
			wsID:     uuid.Nil,
			locID:    locationID,
			contName: "Box A",
			wantErr:  true,
			errMsg:   "workspace_id",
		},
		{
			name:     "nil location ID",
			wsID:     workspaceID,
			locID:    uuid.Nil,
			contName: "Box A",
			wantErr:  true,
			errMsg:   "location_id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cont, err := container.NewContainer(tt.wsID, tt.locID, tt.contName, nil, nil, nil)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, cont)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, cont)
				assert.Equal(t, tt.wsID, cont.WorkspaceID())
				assert.Equal(t, tt.locID, cont.LocationID())
				assert.Equal(t, tt.contName, cont.Name())
				assert.False(t, cont.IsArchived())
			}
		})
	}
}

func TestContainer_Update(t *testing.T) {
	workspaceID := uuid.New()
	locationID := uuid.New()
	cont, err := container.NewContainer(workspaceID, locationID, "Original", nil, nil, nil)
	assert.NoError(t, err)

	newName := "Updated Name"
	description := "Updated description"

	err = cont.Update(newName, locationID, &description, nil)

	assert.NoError(t, err)
	assert.Equal(t, newName, cont.Name())
	assert.Equal(t, &description, cont.Description())
}

func TestContainer_Update_EmptyName(t *testing.T) {
	workspaceID := uuid.New()
	locationID := uuid.New()
	cont, err := container.NewContainer(workspaceID, locationID, "Original", nil, nil, nil)
	assert.NoError(t, err)

	err = cont.Update("", locationID, nil, nil)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name")
}

func TestContainer_Archive(t *testing.T) {
	workspaceID := uuid.New()
	locationID := uuid.New()
	cont, err := container.NewContainer(workspaceID, locationID, "Test", nil, nil, nil)
	assert.NoError(t, err)

	assert.False(t, cont.IsArchived())

	cont.Archive()

	assert.True(t, cont.IsArchived())
}

func TestContainer_Restore(t *testing.T) {
	workspaceID := uuid.New()
	locationID := uuid.New()
	cont, err := container.NewContainer(workspaceID, locationID, "Test", nil, nil, nil)
	assert.NoError(t, err)

	cont.Archive()
	assert.True(t, cont.IsArchived())

	cont.Restore()

	assert.False(t, cont.IsArchived())
}

func TestContainer_Reconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	locationID := uuid.New()
	description := "Test description"
	capacity := "Large"
	shortCode := "BOX-A"
	now := time.Now()

	cont := container.Reconstruct(
		id,
		workspaceID,
		locationID,
		"Test Container",
		&description,
		&capacity,
		&shortCode,
		false,
		now,
		now,
	)

	assert.NotNil(t, cont)
	assert.Equal(t, id, cont.ID())
	assert.Equal(t, workspaceID, cont.WorkspaceID())
	assert.Equal(t, locationID, cont.LocationID())
	assert.Equal(t, "Test Container", cont.Name())
	assert.Equal(t, &description, cont.Description())
	assert.Equal(t, &capacity, cont.Capacity())
	assert.Equal(t, &shortCode, cont.ShortCode())
	assert.False(t, cont.IsArchived())
}
