package borrower

import (
	"context"
	"errors"
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

func (m *MockRepository) Save(ctx context.Context, borrower *Borrower) error {
	args := m.Called(ctx, borrower)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Borrower, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Borrower), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Borrower, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*Borrower), args.Int(1), args.Error(2)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) HasActiveLoans(ctx context.Context, id uuid.UUID) (bool, error) {
	args := m.Called(ctx, id)
	return args.Bool(0), args.Error(1)
}

// Helper functions
func ptrString(s string) *string {
	return &s
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewBorrower(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		name        string
		email       *string
		phone       *string
		notes       *string
		expectError bool
		errorField  string
	}{
		{
			testName:    "valid borrower with all fields",
			workspaceID: workspaceID,
			name:        "John Doe",
			email:       ptrString("john@example.com"),
			phone:       ptrString("+1234567890"),
			notes:       ptrString("Friend from work"),
			expectError: false,
		},
		{
			testName:    "valid borrower with minimal fields",
			workspaceID: workspaceID,
			name:        "Jane Smith",
			email:       nil,
			phone:       nil,
			notes:       nil,
			expectError: false,
		},
		{
			testName:    "valid borrower with only email",
			workspaceID: workspaceID,
			name:        "Bob Wilson",
			email:       ptrString("bob@example.com"),
			phone:       nil,
			notes:       nil,
			expectError: false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			name:        "Test User",
			email:       nil,
			phone:       nil,
			notes:       nil,
			expectError: true,
			errorField:  "workspace_id",
		},
		{
			testName:    "empty name",
			workspaceID: workspaceID,
			name:        "",
			email:       nil,
			phone:       nil,
			notes:       nil,
			expectError: true,
			errorField:  "name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			borrower, err := NewBorrower(tt.workspaceID, tt.name, tt.email, tt.phone, tt.notes)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, borrower)
				if tt.errorField != "" {
					if domainErr, ok := err.(*shared.DomainError); ok {
						assert.Equal(t, tt.errorField, domainErr.Field)
					}
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, borrower)
				assert.NotEqual(t, uuid.Nil, borrower.ID())
				assert.Equal(t, tt.workspaceID, borrower.WorkspaceID())
				assert.Equal(t, tt.name, borrower.Name())
				assert.Equal(t, tt.email, borrower.Email())
				assert.Equal(t, tt.phone, borrower.Phone())
				assert.Equal(t, tt.notes, borrower.Notes())
				assert.False(t, borrower.IsArchived())
				assert.False(t, borrower.CreatedAt().IsZero())
				assert.False(t, borrower.UpdatedAt().IsZero())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()

	borrower := Reconstruct(
		id,
		workspaceID,
		"John Doe",
		ptrString("john@example.com"),
		ptrString("+1234567890"),
		ptrString("Notes"),
		false,
		now,
		now,
	)

	assert.Equal(t, id, borrower.ID())
	assert.Equal(t, workspaceID, borrower.WorkspaceID())
	assert.Equal(t, "John Doe", borrower.Name())
	assert.Equal(t, "john@example.com", *borrower.Email())
	assert.Equal(t, "+1234567890", *borrower.Phone())
	assert.Equal(t, "Notes", *borrower.Notes())
	assert.False(t, borrower.IsArchived())
	assert.Equal(t, now, borrower.CreatedAt())
	assert.Equal(t, now, borrower.UpdatedAt())
}

func TestReconstruct_MinimalFields(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()

	borrower := Reconstruct(
		id,
		workspaceID,
		"Jane Smith",
		nil,
		nil,
		nil,
		true,
		now,
		now,
	)

	assert.Equal(t, id, borrower.ID())
	assert.Equal(t, "Jane Smith", borrower.Name())
	assert.Nil(t, borrower.Email())
	assert.Nil(t, borrower.Phone())
	assert.Nil(t, borrower.Notes())
	assert.True(t, borrower.IsArchived())
}

func TestBorrower_Update(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		input       UpdateInput
		expectError bool
		errorField  string
	}{
		{
			testName: "update all fields",
			input: UpdateInput{
				Name:  "Updated Name",
				Email: ptrString("updated@example.com"),
				Phone: ptrString("+9876543210"),
				Notes: ptrString("Updated notes"),
			},
			expectError: false,
		},
		{
			testName: "update with minimal fields",
			input: UpdateInput{
				Name:  "Just Name",
				Email: nil,
				Phone: nil,
				Notes: nil,
			},
			expectError: false,
		},
		{
			testName: "empty name returns error",
			input: UpdateInput{
				Name:  "",
				Email: ptrString("test@example.com"),
			},
			expectError: true,
			errorField:  "name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			borrower, _ := NewBorrower(workspaceID, "Original Name", nil, nil, nil)
			originalUpdatedAt := borrower.UpdatedAt()
			time.Sleep(time.Millisecond)

			err := borrower.Update(tt.input)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorField != "" {
					if domainErr, ok := err.(*shared.DomainError); ok {
						assert.Equal(t, tt.errorField, domainErr.Field)
					}
				}
				// Name should not change on error
				assert.Equal(t, "Original Name", borrower.Name())
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.input.Name, borrower.Name())
				assert.Equal(t, tt.input.Email, borrower.Email())
				assert.Equal(t, tt.input.Phone, borrower.Phone())
				assert.Equal(t, tt.input.Notes, borrower.Notes())
				assert.True(t, borrower.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestBorrower_Archive(t *testing.T) {
	borrower, _ := NewBorrower(uuid.New(), "Test User", nil, nil, nil)
	assert.False(t, borrower.IsArchived())
	originalUpdatedAt := borrower.UpdatedAt()
	time.Sleep(time.Millisecond)

	borrower.Archive()

	assert.True(t, borrower.IsArchived())
	assert.True(t, borrower.UpdatedAt().After(originalUpdatedAt))
}

func TestBorrower_Restore(t *testing.T) {
	borrower, _ := NewBorrower(uuid.New(), "Test User", nil, nil, nil)
	borrower.Archive()
	assert.True(t, borrower.IsArchived())
	originalUpdatedAt := borrower.UpdatedAt()
	time.Sleep(time.Millisecond)

	borrower.Restore()

	assert.False(t, borrower.IsArchived())
	assert.True(t, borrower.UpdatedAt().After(originalUpdatedAt))
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
	}{
		{
			testName: "successful creation with all fields",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "John Doe",
				Email:       ptrString("john@example.com"),
				Phone:       ptrString("+1234567890"),
				Notes:       ptrString("Notes"),
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*borrower.Borrower")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful creation with minimal fields",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "Jane Smith",
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*borrower.Borrower")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "invalid workspace ID",
			input: CreateInput{
				WorkspaceID: uuid.Nil,
				Name:        "Test User",
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
		},
		{
			testName: "empty name",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "",
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
		},
		{
			testName: "save returns error",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "Test User",
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*borrower.Borrower")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			borrower, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, borrower)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, borrower)
				assert.Equal(t, tt.input.WorkspaceID, borrower.WorkspaceID())
				assert.Equal(t, tt.input.Name, borrower.Name())
				assert.Equal(t, tt.input.Email, borrower.Email())
				assert.Equal(t, tt.input.Phone, borrower.Phone())
				assert.Equal(t, tt.input.Notes, borrower.Notes())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	borrowerID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		borrowerID  uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "borrower found",
			borrowerID:  borrowerID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{id: borrowerID, workspaceID: workspaceID, name: "Test User"}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
			},
			expectError: false,
		},
		{
			testName:    "borrower not found - returns nil",
			borrowerID:  borrowerID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrBorrowerNotFound,
		},
		{
			testName:    "repository returns error",
			borrowerID:  borrowerID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			borrower, err := svc.GetByID(ctx, tt.borrowerID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, borrower)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, borrower)
				assert.Equal(t, tt.borrowerID, borrower.ID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	borrowerID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		borrowerID  uuid.UUID
		workspaceID uuid.UUID
		input       UpdateInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "successful update",
			borrowerID:  borrowerID,
			workspaceID: workspaceID,
			input: UpdateInput{
				Name:  "Updated Name",
				Email: ptrString("updated@example.com"),
				Phone: ptrString("+9876543210"),
				Notes: ptrString("Updated notes"),
			},
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Original Name",
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("Save", ctx, mock.AnythingOfType("*borrower.Borrower")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "borrower not found",
			borrowerID:  uuid.New(),
			workspaceID: workspaceID,
			input: UpdateInput{
				Name: "Updated Name",
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrBorrowerNotFound,
		},
		{
			testName:    "update with empty name",
			borrowerID:  borrowerID,
			workspaceID: workspaceID,
			input: UpdateInput{
				Name: "",
			},
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Original Name",
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
			},
			expectError: true,
		},
		{
			testName:    "save returns error",
			borrowerID:  borrowerID,
			workspaceID: workspaceID,
			input: UpdateInput{
				Name: "Updated Name",
			},
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Original Name",
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("Save", ctx, mock.AnythingOfType("*borrower.Borrower")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			borrower, err := svc.Update(ctx, tt.borrowerID, tt.workspaceID, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, borrower)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, borrower)
				assert.Equal(t, tt.input.Name, borrower.Name())
				assert.Equal(t, tt.input.Email, borrower.Email())
				assert.Equal(t, tt.input.Phone, borrower.Phone())
				assert.Equal(t, tt.input.Notes, borrower.Notes())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Archive(t *testing.T) {
	ctx := context.Background()
	borrowerID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful archive",
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Test User",
					isArchived:  false,
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("Save", ctx, mock.AnythingOfType("*borrower.Borrower")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "borrower not found",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrBorrowerNotFound,
		},
		{
			testName: "save returns error",
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Test User",
					isArchived:  false,
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("Save", ctx, mock.AnythingOfType("*borrower.Borrower")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Archive(ctx, borrowerID, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Restore(t *testing.T) {
	ctx := context.Background()
	borrowerID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful restore",
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Test User",
					isArchived:  true,
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("Save", ctx, mock.AnythingOfType("*borrower.Borrower")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "borrower not found",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrBorrowerNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Restore(ctx, borrowerID, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	borrowerID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful delete",
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Test User",
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("HasActiveLoans", ctx, borrowerID).Return(false, nil)
				m.On("Delete", ctx, borrowerID).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "borrower not found",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrBorrowerNotFound,
		},
		{
			testName: "borrower has active loans",
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Test User",
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("HasActiveLoans", ctx, borrowerID).Return(true, nil)
			},
			expectError: true,
			errorType:   ErrHasActiveLoans,
		},
		{
			testName: "HasActiveLoans returns error",
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Test User",
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("HasActiveLoans", ctx, borrowerID).Return(false, errors.New("database error"))
			},
			expectError: true,
		},
		{
			testName: "delete returns error",
			setupMock: func(m *MockRepository) {
				borrower := &Borrower{
					id:          borrowerID,
					workspaceID: workspaceID,
					name:        "Test User",
				}
				m.On("FindByID", ctx, borrowerID, workspaceID).Return(borrower, nil)
				m.On("HasActiveLoans", ctx, borrowerID).Return(false, nil)
				m.On("Delete", ctx, borrowerID).Return(errors.New("delete error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Delete(ctx, borrowerID, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_List(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectTotal int
		expectError bool
	}{
		{
			testName:   "list with results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				borrowers := []*Borrower{
					{id: uuid.New(), workspaceID: workspaceID, name: "User 1"},
					{id: uuid.New(), workspaceID: workspaceID, name: "User 2"},
					{id: uuid.New(), workspaceID: workspaceID, name: "User 3"},
				}
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(borrowers, 3, nil)
			},
			expectLen:   3,
			expectTotal: 3,
			expectError: false,
		},
		{
			testName:   "list with pagination",
			pagination: shared.Pagination{Page: 2, PageSize: 2},
			setupMock: func(m *MockRepository) {
				borrowers := []*Borrower{
					{id: uuid.New(), workspaceID: workspaceID, name: "User 3"},
				}
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 2, PageSize: 2}).Return(borrowers, 5, nil)
			},
			expectLen:   1,
			expectTotal: 5,
			expectError: false,
		},
		{
			testName:   "empty results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return([]*Borrower{}, 0, nil)
			},
			expectLen:   0,
			expectTotal: 0,
			expectError: false,
		},
		{
			testName:   "repository returns error",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, 0, errors.New("database error"))
			},
			expectLen:   0,
			expectTotal: 0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			borrowers, total, err := svc.List(ctx, workspaceID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, borrowers)
			} else {
				assert.NoError(t, err)
				assert.Len(t, borrowers, tt.expectLen)
				assert.Equal(t, tt.expectTotal, total)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
