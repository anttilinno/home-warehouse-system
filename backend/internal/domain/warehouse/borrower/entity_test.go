package borrower_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
)

func TestNewBorrower(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		name    string
		wsID    uuid.UUID
		borName string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid borrower",
			wsID:    workspaceID,
			borName: "John Doe",
			wantErr: false,
		},
		{
			name:    "missing name",
			wsID:    workspaceID,
			borName: "",
			wantErr: true,
			errMsg:  "name",
		},
		{
			name:    "nil workspace ID",
			wsID:    uuid.Nil,
			borName: "John Doe",
			wantErr: true,
			errMsg:  "workspace_id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, err := borrower.NewBorrower(tt.wsID, tt.borName, nil, nil, nil)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, b)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, b)
				assert.Equal(t, tt.wsID, b.WorkspaceID())
				assert.Equal(t, tt.borName, b.Name())
				assert.False(t, b.IsArchived())
			}
		})
	}
}

func TestBorrower_WithContactInfo(t *testing.T) {
	workspaceID := uuid.New()
	email := "john@example.com"
	phone := "555-1234"
	notes := "Regular borrower"

	b, err := borrower.NewBorrower(workspaceID, "John Doe", &email, &phone, &notes)

	assert.NoError(t, err)
	assert.NotNil(t, b)
	assert.Equal(t, &email, b.Email())
	assert.Equal(t, &phone, b.Phone())
	assert.Equal(t, &notes, b.Notes())
}

func TestBorrower_Update(t *testing.T) {
	workspaceID := uuid.New()
	b, err := borrower.NewBorrower(workspaceID, "Original", nil, nil, nil)
	assert.NoError(t, err)

	newName := "Updated Name"
	email := "updated@example.com"

	err = b.Update(borrower.UpdateInput{
		Name:  newName,
		Email: &email,
	})

	assert.NoError(t, err)
	assert.Equal(t, newName, b.Name())
	assert.Equal(t, &email, b.Email())
}

func TestBorrower_Update_EmptyName(t *testing.T) {
	workspaceID := uuid.New()
	b, err := borrower.NewBorrower(workspaceID, "Original", nil, nil, nil)
	assert.NoError(t, err)

	err = b.Update(borrower.UpdateInput{
		Name: "",
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name")
}

func TestBorrower_Archive(t *testing.T) {
	workspaceID := uuid.New()
	b, err := borrower.NewBorrower(workspaceID, "Test", nil, nil, nil)
	assert.NoError(t, err)

	assert.False(t, b.IsArchived())

	b.Archive()

	assert.True(t, b.IsArchived())
}

func TestBorrower_Restore(t *testing.T) {
	workspaceID := uuid.New()
	b, err := borrower.NewBorrower(workspaceID, "Test", nil, nil, nil)
	assert.NoError(t, err)

	b.Archive()
	assert.True(t, b.IsArchived())

	b.Restore()

	assert.False(t, b.IsArchived())
}

func TestBorrower_Reconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	email := "test@example.com"
	phone := "555-1234"
	notes := "Test notes"
	now := time.Now()

	b := borrower.Reconstruct(
		id,
		workspaceID,
		"Test Borrower",
		&email,
		&phone,
		&notes,
		false,
		now,
		now,
	)

	assert.NotNil(t, b)
	assert.Equal(t, id, b.ID())
	assert.Equal(t, workspaceID, b.WorkspaceID())
	assert.Equal(t, "Test Borrower", b.Name())
	assert.Equal(t, &email, b.Email())
	assert.Equal(t, &phone, b.Phone())
	assert.Equal(t, &notes, b.Notes())
	assert.False(t, b.IsArchived())
}
