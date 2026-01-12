package company

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

func (m *MockRepository) Save(ctx context.Context, company *Company) error {
	args := m.Called(ctx, company)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Company, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Company), args.Error(1)
}

func (m *MockRepository) FindByName(ctx context.Context, workspaceID uuid.UUID, name string) (*Company, error) {
	args := m.Called(ctx, workspaceID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Company), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Company, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*Company), args.Int(1), args.Error(2)
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

func TestNewCompany(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		name        string
		website     *string
		notes       *string
		expectError bool
		errorField  string
	}{
		{
			testName:    "valid company",
			workspaceID: workspaceID,
			name:        "Acme Corp",
			website:     ptrString("https://acme.example.com"),
			notes:       ptrString("Reliable supplier"),
			expectError: false,
		},
		{
			testName:    "minimal company",
			workspaceID: workspaceID,
			name:        "Simple Corp",
			website:     nil,
			notes:       nil,
			expectError: false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			name:        "Test Company",
			website:     nil,
			notes:       nil,
			expectError: true,
			errorField:  "workspace_id",
		},
		{
			testName:    "empty name",
			workspaceID: workspaceID,
			name:        "",
			website:     nil,
			notes:       nil,
			expectError: true,
			errorField:  "name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			company, err := NewCompany(tt.workspaceID, tt.name, tt.website, tt.notes)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, company)
				if domainErr, ok := err.(*shared.DomainError); ok && domainErr.Field != "" {
					assert.Equal(t, tt.errorField, domainErr.Field)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, company)
				assert.Equal(t, tt.workspaceID, company.WorkspaceID())
				assert.Equal(t, tt.name, company.Name())
				assert.Equal(t, tt.website, company.Website())
				assert.Equal(t, tt.notes, company.Notes())
				assert.False(t, company.IsArchived())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()

	company := Reconstruct(
		id,
		workspaceID,
		"Test Company",
		ptrString("https://test.com"),
		ptrString("Test notes"),
		true,
		now,
		now,
	)

	assert.Equal(t, id, company.ID())
	assert.Equal(t, workspaceID, company.WorkspaceID())
	assert.Equal(t, "Test Company", company.Name())
	assert.Equal(t, "https://test.com", *company.Website())
	assert.Equal(t, "Test notes", *company.Notes())
	assert.True(t, company.IsArchived())
	assert.Equal(t, now, company.CreatedAt())
	assert.Equal(t, now, company.UpdatedAt())
}

func TestCompany_Update(t *testing.T) {
	company, err := NewCompany(uuid.New(), "Original Name", nil, nil)
	assert.NoError(t, err)

	originalUpdatedAt := company.UpdatedAt()

	err = company.Update("Updated Name", ptrString("https://updated.com"), ptrString("Updated notes"))
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", company.Name())
	assert.Equal(t, "https://updated.com", *company.Website())
	assert.Equal(t, "Updated notes", *company.Notes())
	assert.True(t, company.UpdatedAt().After(originalUpdatedAt))

	// Update with empty name
	err = company.Update("", nil, nil)
	assert.Error(t, err)
	assert.Equal(t, "Updated Name", company.Name()) // Should not change
}

func TestCompany_Archive(t *testing.T) {
	company, err := NewCompany(uuid.New(), "Test Company", nil, nil)
	assert.NoError(t, err)

	assert.False(t, company.IsArchived())
	originalUpdatedAt := company.UpdatedAt()

	company.Archive()

	assert.True(t, company.IsArchived())
	assert.True(t, company.UpdatedAt().After(originalUpdatedAt))
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
				Name:        "Acme Corp",
				Website:     ptrString("https://acme.example.com"),
				Notes:       ptrString("Good supplier"),
			},
			setupMock: func(m *MockRepository) {
				m.On("NameExists", ctx, workspaceID, "Acme Corp").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "name already taken",
			input: CreateInput{
				WorkspaceID: workspaceID,
				Name:        "Taken Corp",
			},
			setupMock: func(m *MockRepository) {
				m.On("NameExists", ctx, workspaceID, "Taken Corp").Return(true, nil)
			},
			expectError: true,
			errorType:   ErrNameTaken,
		},
		{
			testName: "invalid input",
			input: CreateInput{
				WorkspaceID: uuid.Nil,
				Name:        "Invalid Company",
			},
			setupMock: func(m *MockRepository) {
				// NameExists is called before validation, but since validation fails
				// we need to mock it anyway to avoid the panic
				m.On("NameExists", ctx, uuid.Nil, "Invalid Company").Return(false, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			company, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, company)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, company)
				assert.Equal(t, tt.input.WorkspaceID, company.WorkspaceID())
				assert.Equal(t, tt.input.Name, company.Name())
				assert.Equal(t, tt.input.Website, company.Website())
				assert.Equal(t, tt.input.Notes, company.Notes())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	companyID := uuid.New()
	workspaceID := uuid.New()
	repoErr := assert.AnError

	tests := []struct {
		testName    string
		companyID   uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "company found",
			companyID:   companyID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				company := &Company{id: companyID, workspaceID: workspaceID, name: "Test Company"}
				m.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
			},
			expectError: false,
		},
		{
			testName:    "company not found",
			companyID:   companyID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, companyID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrCompanyNotFound,
		},
		{
			testName:    "repository error",
			companyID:   companyID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, companyID, workspaceID).Return(nil, repoErr)
			},
			expectError: true,
			errorType:   repoErr,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			company, err := svc.GetByID(ctx, tt.companyID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, company)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, company)
				assert.Equal(t, tt.companyID, company.ID())
				assert.Equal(t, tt.workspaceID, company.WorkspaceID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Create_ErrorPaths(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	repoErr := assert.AnError

	t.Run("NameExists returns error", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("NameExists", ctx, workspaceID, "Test Corp").Return(false, repoErr)

		company, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			Name:        "Test Corp",
		})

		assert.Error(t, err)
		assert.Nil(t, company)
		assert.Equal(t, repoErr, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Save returns error", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("NameExists", ctx, workspaceID, "Test Corp").Return(false, nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(repoErr)

		company, err := svc.Create(ctx, CreateInput{
			WorkspaceID: workspaceID,
			Name:        "Test Corp",
		})

		assert.Error(t, err)
		assert.Nil(t, company)
		assert.Equal(t, repoErr, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_ListByWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	pagination := shared.Pagination{Page: 1, PageSize: 10}
	repoErr := assert.AnError

	t.Run("successful list", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company1 := &Company{id: uuid.New(), workspaceID: workspaceID, name: "Company 1"}
		company2 := &Company{id: uuid.New(), workspaceID: workspaceID, name: "Company 2"}
		companies := []*Company{company1, company2}

		mockRepo.On("FindByWorkspace", ctx, workspaceID, pagination).Return(companies, 2, nil)

		result, err := svc.ListByWorkspace(ctx, workspaceID, pagination)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Items, 2)
		assert.Equal(t, 2, result.Total)
		mockRepo.AssertExpectations(t)
	})

	t.Run("empty list", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByWorkspace", ctx, workspaceID, pagination).Return([]*Company{}, 0, nil)

		result, err := svc.ListByWorkspace(ctx, workspaceID, pagination)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Items, 0)
		assert.Equal(t, 0, result.Total)
		mockRepo.AssertExpectations(t)
	})

	t.Run("repository error", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByWorkspace", ctx, workspaceID, pagination).Return(nil, 0, repoErr)

		result, err := svc.ListByWorkspace(ctx, workspaceID, pagination)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, repoErr, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	companyID := uuid.New()
	workspaceID := uuid.New()
	repoErr := assert.AnError

	t.Run("successful update", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Original Name"}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(nil)

		result, err := svc.Update(ctx, companyID, workspaceID, UpdateInput{
			Name:    "Updated Name",
			Website: ptrString("https://example.com"),
			Notes:   ptrString("Some notes"),
		})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "Updated Name", result.Name())
		assert.Equal(t, "https://example.com", *result.Website())
		mockRepo.AssertExpectations(t)
	})

	t.Run("company not found", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(nil, nil)

		result, err := svc.Update(ctx, companyID, workspaceID, UpdateInput{Name: "Updated Name"})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrCompanyNotFound, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("invalid update input - empty name", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Original Name"}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)

		result, err := svc.Update(ctx, companyID, workspaceID, UpdateInput{Name: ""})

		assert.Error(t, err)
		assert.Nil(t, result)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Save returns error", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Original Name"}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(repoErr)

		result, err := svc.Update(ctx, companyID, workspaceID, UpdateInput{Name: "Updated Name"})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, repoErr, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_Archive(t *testing.T) {
	ctx := context.Background()
	companyID := uuid.New()
	workspaceID := uuid.New()
	repoErr := assert.AnError

	t.Run("successful archive", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Test Company"}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(nil)

		err := svc.Archive(ctx, companyID, workspaceID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("company not found", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(nil, nil)

		err := svc.Archive(ctx, companyID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrCompanyNotFound, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Save returns error", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Test Company"}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(repoErr)

		err := svc.Archive(ctx, companyID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, repoErr, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_Restore(t *testing.T) {
	ctx := context.Background()
	companyID := uuid.New()
	workspaceID := uuid.New()
	repoErr := assert.AnError

	t.Run("successful restore", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Test Company", isArchived: true}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(nil)

		err := svc.Restore(ctx, companyID, workspaceID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("company not found", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(nil, nil)

		err := svc.Restore(ctx, companyID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrCompanyNotFound, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Save returns error", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Test Company", isArchived: true}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(repoErr)

		err := svc.Restore(ctx, companyID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, repoErr, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	companyID := uuid.New()
	workspaceID := uuid.New()
	repoErr := assert.AnError

	t.Run("successful delete", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Test Company"}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
		mockRepo.On("Delete", ctx, companyID).Return(nil)

		err := svc.Delete(ctx, companyID, workspaceID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("company not found", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(nil, nil)

		err := svc.Delete(ctx, companyID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrCompanyNotFound, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Delete returns error", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		company := &Company{id: companyID, workspaceID: workspaceID, name: "Test Company"}
		mockRepo.On("FindByID", ctx, companyID, workspaceID).Return(company, nil)
		mockRepo.On("Delete", ctx, companyID).Return(repoErr)

		err := svc.Delete(ctx, companyID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, repoErr, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestCompany_Restore(t *testing.T) {
	company, err := NewCompany(uuid.New(), "Test Company", nil, nil)
	assert.NoError(t, err)

	company.Archive()
	assert.True(t, company.IsArchived())
	originalUpdatedAt := company.UpdatedAt()

	company.Restore()

	assert.False(t, company.IsArchived())
	assert.True(t, company.UpdatedAt().After(originalUpdatedAt) || company.UpdatedAt().Equal(originalUpdatedAt))
}
